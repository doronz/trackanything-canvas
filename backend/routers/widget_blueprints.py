"""
Widget Blueprints API router for pluggable widget system.
Handles CRUD operations for widget blueprints/templates.
"""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, model_validator
from sqlalchemy import or_
from sqlalchemy.orm import Session

from database import WidgetBlueprint, get_db

router = APIRouter(prefix="/api/widget-blueprints", tags=["Widget Blueprints"])


# Pydantic models for request/response
class WidgetBlueprintCreate(BaseModel):
    name: str
    description: Optional[str] = None
    widget_version: Optional[str] = "2.0"
    # Universal Widget System fields
    data_source: Optional[dict] = None
    data_schema: Optional[dict] = None
    view_schema: Optional[dict] = None
    # Legacy compatibility fields
    widgetEngine: Optional[str] = None  # For backward compatibility
    widget_schema: Optional[dict] = None  # For backward compatibility (renamed from schema)
    settings: dict
    widget_metadata: Optional[dict] = None
    is_public: bool = False


class WidgetBlueprintUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    widget_version: Optional[str] = None
    # Universal Widget System fields
    data_source: Optional[dict] = None
    data_schema: Optional[dict] = None
    view_schema: Optional[dict] = None
    # Legacy compatibility fields
    widgetEngine: Optional[str] = None
    widget_schema: Optional[dict] = None  # For backward compatibility (renamed from schema)
    settings: Optional[dict] = None
    widget_metadata: Optional[dict] = None
    is_public: Optional[bool] = None


class WidgetBlueprintResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    widget_version: Optional[str] = "2.0"
    # Universal Widget System fields
    data_source: Optional[dict] = None
    data_schema: Optional[dict] = None
    view_schema: Optional[dict] = None
    # Legacy compatibility fields (for backward compatibility)
    widgetEngine: Optional[str] = None
    widget_schema: Optional[dict] = None  # For backward compatibility (renamed from schema)
    settings: dict
    widget_metadata: Optional[dict]
    is_public: bool
    install_count: int
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="before")
    @classmethod
    def extract_fields(cls, data):
        # If data is a SQLAlchemy model instance, extract and map fields
        if hasattr(data, "data_source"):  # New Universal Widget System
            return {
                "id": data.id,
                "name": data.name,
                "description": data.description,
                "widget_version": getattr(data, "widget_version", "2.0"),
                "data_source": data.data_source,
                "data_schema": data.data_schema,
                "view_schema": data.view_schema,
                "settings": data.settings,
                "widget_metadata": data.widget_metadata,
                "is_public": data.is_public,
                "install_count": data.install_count,
                "created_at": data.created_at,
                "updated_at": data.updated_at,
            }
        elif hasattr(data, "widget_engine"):  # Legacy Core Engine System
            return {
                "id": data.id,
                "name": data.name,
                "description": data.description,
                "widget_version": getattr(data, "widget_version", "1.0"),
                "widgetEngine": data.widget_engine,
                "widget_schema": getattr(data, "schema", None),  # Map schema to widget_schema
                "settings": data.settings,
                "widget_metadata": data.widget_metadata,
                "is_public": data.is_public,
                "install_count": data.install_count,
                "created_at": data.created_at,
                "updated_at": data.updated_at,
            }
        return data

    model_config = ConfigDict(from_attributes=True)


@router.get("/", response_model=List[WidgetBlueprintResponse])
async def get_widget_blueprints(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    public_only: bool = Query(False),
    db: Session = Depends(get_db),
):
    """Get all widget blueprints with optional filtering."""
    query = db.query(WidgetBlueprint)

    if public_only:
        query = query.filter(WidgetBlueprint.is_public.is_(True))

    if search:
        query = query.filter(
            or_(WidgetBlueprint.name.ilike(f"%{search}%"), WidgetBlueprint.description.ilike(f"%{search}%"))
        )

    if category:
        # Search in widget_metadata JSON for category
        query = query.filter(WidgetBlueprint.widget_metadata.op("->>")("category").ilike(f"%{category}%"))

    blueprints = (
        query.order_by(WidgetBlueprint.install_count.desc(), WidgetBlueprint.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return blueprints


@router.get("/{blueprint_id}", response_model=WidgetBlueprintResponse)
async def get_widget_blueprint(blueprint_id: int, db: Session = Depends(get_db)):
    """Get a specific widget blueprint by ID."""
    blueprint = db.query(WidgetBlueprint).filter(WidgetBlueprint.id == blueprint_id).first()
    if not blueprint:
        raise HTTPException(status_code=404, detail="Widget blueprint not found")

    return blueprint


@router.post("/", response_model=WidgetBlueprintResponse)
async def create_widget_blueprint(blueprint_data: WidgetBlueprintCreate, db: Session = Depends(get_db)):
    """Create a new widget blueprint."""

    # Determine if this is a Universal Widget or Legacy Widget
    is_universal = (
        blueprint_data.data_source is not None
        and blueprint_data.data_schema is not None
        and blueprint_data.view_schema is not None
    )

    if is_universal:
        # Create Universal Widget Blueprint
        blueprint = WidgetBlueprint(
            name=blueprint_data.name,
            description=blueprint_data.description,
            widget_version=blueprint_data.widget_version or "2.0",
            data_source=blueprint_data.data_source,
            data_schema=blueprint_data.data_schema,
            view_schema=blueprint_data.view_schema,
            settings=blueprint_data.settings,
            widget_metadata=blueprint_data.widget_metadata or {},
            is_public=blueprint_data.is_public,
        )
    else:
        # Create Legacy Widget Blueprint (backward compatibility)
        if not blueprint_data.widgetEngine or not blueprint_data.widget_schema:
            raise HTTPException(
                status_code=400,
                detail="Either Universal Widget fields (data_source, data_schema, view_schema) or Legacy fields (widgetEngine, widget_schema) must be provided",
            )

        blueprint = WidgetBlueprint(
            name=blueprint_data.name,
            description=blueprint_data.description,
            widget_version="1.0",  # Legacy version
            # For legacy widgets, we'll store minimal universal schemas for compatibility
            data_source={"type": "userInput"},
            data_schema={"fields": []},
            view_schema={"displayComponent": "Legacy", "mappings": {}},
            settings=blueprint_data.settings,
            widget_metadata={
                **(blueprint_data.widget_metadata or {}),
                "legacy_widget_engine": blueprint_data.widgetEngine,
                "legacy_schema": blueprint_data.widget_schema,
            },
            is_public=blueprint_data.is_public,
        )

    db.add(blueprint)
    db.commit()
    db.refresh(blueprint)

    return blueprint


@router.put("/{blueprint_id}", response_model=WidgetBlueprintResponse)
async def update_widget_blueprint(
    blueprint_id: int, blueprint_data: WidgetBlueprintUpdate, db: Session = Depends(get_db)
):
    """Update an existing widget blueprint."""
    blueprint = db.query(WidgetBlueprint).filter(WidgetBlueprint.id == blueprint_id).first()
    if not blueprint:
        raise HTTPException(status_code=404, detail="Widget blueprint not found")

    # Update only provided fields
    update_data = blueprint_data.model_dump(exclude_unset=True)

    # Handle Universal Widget System fields
    for field, value in update_data.items():
        if field in ["data_source", "data_schema", "view_schema", "widget_version"]:
            setattr(blueprint, field, value)
        elif field == "widgetEngine":
            # Legacy compatibility - store in metadata
            if not blueprint.widget_metadata:
                blueprint.widget_metadata = {}
            blueprint.widget_metadata["legacy_widget_engine"] = value
        elif field == "widget_schema":
            # Legacy compatibility - store in metadata
            if not blueprint.widget_metadata:
                blueprint.widget_metadata = {}
            blueprint.widget_metadata["legacy_schema"] = value
        else:
            setattr(blueprint, field, value)

    blueprint.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(blueprint)

    return blueprint


@router.delete("/{blueprint_id}")
async def delete_widget_blueprint(blueprint_id: int, db: Session = Depends(get_db)):
    """Delete a widget blueprint."""
    blueprint = db.query(WidgetBlueprint).filter(WidgetBlueprint.id == blueprint_id).first()
    if not blueprint:
        raise HTTPException(status_code=404, detail="Widget blueprint not found")

    db.delete(blueprint)
    db.commit()

    return {"message": "Widget blueprint deleted successfully"}


@router.post("/{blueprint_id}/install")
async def install_widget_blueprint(blueprint_id: int, db: Session = Depends(get_db)):
    """Increment install count when a blueprint is used."""
    blueprint = db.query(WidgetBlueprint).filter(WidgetBlueprint.id == blueprint_id).first()
    if not blueprint:
        raise HTTPException(status_code=404, detail="Widget blueprint not found")

    blueprint.install_count += 1
    db.commit()

    return {"message": "Install count incremented", "install_count": blueprint.install_count}
