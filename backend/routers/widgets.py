"""
Widget management API routes.
This module handles CRUD operations for widgets on dashboards.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from database import Widget, WidgetBlueprint, WidgetConnection, get_db

router = APIRouter()


def widget_to_response(widget: Widget, db: Session) -> Dict[str, Any]:
    """Convert a Widget model to response format with blueprint data."""

    # Load blueprint data (required for all widgets now)
    widget_blueprint = None
    blueprint = db.query(WidgetBlueprint).filter(WidgetBlueprint.id == widget.widget_blueprint_id).first()
    if blueprint:
        # Handle Universal Widget System (v2.0) and Legacy widgets
        if getattr(blueprint, "widget_version", "1.0") == "2.0":
            # Universal Widget System format - use camelCase for frontend compatibility
            widget_blueprint = {
                "id": blueprint.id,
                "name": blueprint.name,
                "description": blueprint.description,
                "widgetVersion": blueprint.widget_version,
                "dataSource": blueprint.data_source,
                "dataSchema": blueprint.data_schema,
                "viewSchema": blueprint.view_schema,
                "settings": blueprint.settings,
                "widget_metadata": blueprint.widget_metadata,
            }
        else:
            # Legacy widget compatibility - extract from metadata if available
            legacy_engine = getattr(blueprint, "widget_metadata", {}).get("legacy_widget_engine")
            legacy_schema = getattr(blueprint, "widget_metadata", {}).get("legacy_schema")

            widget_blueprint = {
                "id": blueprint.id,
                "name": blueprint.name,
                "description": blueprint.description,
                "schema": legacy_schema or {},
                "widgetEngine": legacy_engine or "UnknownEngine",
                "settings": blueprint.settings,
                "widget_metadata": blueprint.widget_metadata,
                # Also include Universal fields for compatibility
                "widgetVersion": getattr(blueprint, "widget_version", "1.0"),
                "dataSource": getattr(blueprint, "data_source", {}),
                "dataSchema": getattr(blueprint, "data_schema", {}),
                "viewSchema": getattr(blueprint, "view_schema", {}),
            }

    widget_dict = {
        "id": widget.id,
        "dashboard_id": widget.dashboard_id,
        "title": widget.title,
        "init_prompt": widget.init_prompt,
        "x": widget.x,
        "y": widget.y,
        "width": widget.width,
        "height": widget.height,
        "z_index": widget.z_index,
        "color": widget.color,
        "shape": widget.shape,
        "content": widget.content,
        "settings": widget.settings,
        "widget_blueprint_id": widget.widget_blueprint_id,
        "widget_blueprint": widget_blueprint,
        "created_at": widget.created_at,
        "updated_at": widget.updated_at,
    }

    return widget_dict


# Pydantic models for request/response


class WidgetCreate(BaseModel):
    dashboard_id: int
    widget_blueprint_id: int  # Required for all widgets
    title: Optional[str] = None
    init_prompt: Optional[str] = None
    x: float
    y: float
    width: float = 512
    height: float = 384
    color: Optional[str] = "#ffffff"
    shape: str = "rectangle"
    content: Optional[Dict[str, Any]] = {}
    settings: Optional[Dict[str, Any]] = {}


class WidgetUpdate(BaseModel):
    title: Optional[str] = None
    init_prompt: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    z_index: Optional[int] = None
    color: Optional[str] = None
    shape: Optional[str] = None
    content: Optional[Dict[str, Any]] = None
    settings: Optional[Dict[str, Any]] = None


class WidgetResponse(BaseModel):
    id: int
    dashboard_id: int
    title: Optional[str]
    init_prompt: Optional[str] = None
    x: float
    y: float
    width: float
    height: float
    z_index: int
    color: Optional[str]
    shape: str
    content: Optional[Dict[str, Any]]
    settings: Optional[Dict[str, Any]]
    widget_blueprint_id: int
    widget_blueprint: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


@router.get("/dashboard/{dashboard_id}", response_model=List[WidgetResponse])
async def list_dashboard_widgets(dashboard_id: int, db: Session = Depends(get_db)):
    """List all widgets for a specific dashboard."""
    widgets = db.query(Widget).filter(Widget.dashboard_id == dashboard_id).order_by(Widget.z_index.asc()).all()
    return [widget_to_response(widget, db) for widget in widgets]


@router.post("/", response_model=WidgetResponse)
async def create_widget(widget: WidgetCreate, db: Session = Depends(get_db)):
    """Create a new widget on a dashboard."""
    import logging

    logger = logging.getLogger(__name__)

    try:
        logger.debug(f"Creating widget with data: {widget.model_dump()}")

        # Validate required fields
        if not widget.widget_blueprint_id:
            logger.error("Missing widget_blueprint_id")
            raise HTTPException(status_code=422, detail="widget_blueprint_id is required")

        if not widget.dashboard_id:
            logger.error("Missing dashboard_id")
            raise HTTPException(status_code=422, detail="dashboard_id is required")

        # Check if blueprint exists
        blueprint = db.query(WidgetBlueprint).filter(WidgetBlueprint.id == widget.widget_blueprint_id).first()
        if not blueprint:
            logger.error(f"Blueprint not found with id: {widget.widget_blueprint_id}")
            raise HTTPException(status_code=422, detail=f"Blueprint with id {widget.widget_blueprint_id} not found")

        logger.debug(f"Found blueprint: {blueprint.name} (version: {getattr(blueprint, 'widget_version', 'unknown')})")

        # Get the highest z_index for this dashboard
        max_z = db.query(Widget).filter(Widget.dashboard_id == widget.dashboard_id).count()

        # Use blueprint default dimensions if not specified or use defaults
        blueprint_settings = blueprint.settings or {}
        default_width = blueprint_settings.get("defaultWidth", 512)
        default_height = blueprint_settings.get("defaultHeight", 384)

        # Use provided dimensions or blueprint defaults
        final_width = widget.width if widget.width != 512 else default_width
        final_height = widget.height if widget.height != 384 else default_height

        db_widget = Widget(
            dashboard_id=widget.dashboard_id,
            widget_blueprint_id=widget.widget_blueprint_id,
            title=widget.title,
            x=widget.x,
            y=widget.y,
            width=final_width,
            height=final_height,
            z_index=max_z + 1,
            color=widget.color,
            shape=widget.shape,
            content=widget.content or {},
            settings=widget.settings or {},
        )

        logger.debug(f"Created widget object: {db_widget}")

        db.add(db_widget)
        db.commit()
        db.refresh(db_widget)

        logger.debug(f"Successfully created widget with id: {db_widget.id}")
        return widget_to_response(db_widget, db)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating widget: {str(e)}")
        logger.error(f"Widget data: {widget.model_dump()}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create widget: {str(e)}")


@router.get("/{widget_id}", response_model=WidgetResponse)
async def get_widget(widget_id: int, db: Session = Depends(get_db)):
    """Get a specific widget by ID."""
    widget = db.query(Widget).filter(Widget.id == widget_id).first()
    if not widget:
        raise HTTPException(status_code=404, detail="Widget not found")
    return widget_to_response(widget, db)


@router.put("/{widget_id}", response_model=WidgetResponse)
async def update_widget(widget_id: int, widget_update: WidgetUpdate, db: Session = Depends(get_db)):
    """Update widget properties and content."""
    widget = db.query(Widget).filter(Widget.id == widget_id).first()
    if not widget:
        raise HTTPException(status_code=404, detail="Widget not found")

    update_data = widget_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(widget, field, value)

    widget.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(widget)
    return widget_to_response(widget, db)


@router.delete("/{widget_id}")
async def delete_widget(widget_id: int, db: Session = Depends(get_db)):
    """Delete a widget from the dashboard."""
    widget = db.query(Widget).filter(Widget.id == widget_id).first()
    if not widget:
        raise HTTPException(status_code=404, detail="Widget not found")

    # Delete all connections where this widget is either source or target
    connections_to_delete = (
        db.query(WidgetConnection)
        .filter((WidgetConnection.source_widget_id == widget_id) | (WidgetConnection.target_widget_id == widget_id))
        .all()
    )

    for connection in connections_to_delete:
        db.delete(connection)

    # Delete the widget
    db.delete(widget)
    db.commit()

    return {"message": "Widget deleted successfully", "deleted_connections": len(connections_to_delete)}


@router.post("/{widget_id}/duplicate")
async def duplicate_widget(widget_id: int, db: Session = Depends(get_db)):
    """Duplicate a widget with offset position."""
    original = db.query(Widget).filter(Widget.id == widget_id).first()
    if not original:
        raise HTTPException(status_code=404, detail="Widget not found")

    # Get the highest z_index for this dashboard
    max_z = db.query(Widget).filter(Widget.dashboard_id == original.dashboard_id).count()

    new_widget = Widget(
        dashboard_id=original.dashboard_id,
        widget_blueprint_id=original.widget_blueprint_id,
        title=f"{original.title} (Copy)" if original.title else None,
        x=original.x + 20,  # Offset position
        y=original.y + 20,
        width=original.width,
        height=original.height,
        z_index=max_z + 1,
        color=original.color,
        shape=original.shape,
        content=original.content,
        settings=original.settings,
    )
    db.add(new_widget)
    db.commit()
    db.refresh(new_widget)

    return {"id": new_widget.id, "message": "Widget duplicated successfully"}


@router.post("/bulk-update")
async def bulk_update_widgets(widgets_data: List[WidgetUpdate], db: Session = Depends(get_db)):
    """Bulk update multiple widgets (useful for drag operations)."""
    updated_widgets = []

    for i, widget_data in enumerate(widgets_data):
        widget_id = widget_data.id if hasattr(widget_data, "id") else None
        if not widget_id:
            continue

        widget = db.query(Widget).filter(Widget.id == widget_id).first()
        if widget:
            update_data = widget_data.model_dump(exclude_unset=True)
            for field, value in update_data.items():
                if field != "id":
                    setattr(widget, field, value)
            widget.updated_at = datetime.utcnow()
            updated_widgets.append(widget)

    db.commit()
    return {"message": f"Updated {len(updated_widgets)} widgets"}


# Widget Export/Import Models


class WidgetExportData(BaseModel):
    # Widget instance data
    title: Optional[str]
    x: float
    y: float
    width: float
    height: float
    z_index: int
    color: Optional[str]
    shape: str
    content: Dict[str, Any]
    settings: Dict[str, Any]

    # Blueprint data for fallback
    widget_blueprint_id: int
    widget_blueprint: Dict[str, Any]  # Full blueprint data

    # Export metadata
    export_version: str = "2.0"  # Updated for pluggable system
    exported_at: str
    exported_by: str = "Canvas MCP Client"


class WidgetImportData(BaseModel):
    # Widget instance data
    title: Optional[str] = None
    x: float
    y: float
    width: float = 300
    height: float = 200
    color: Optional[str] = "#ffffff"
    shape: str = "rectangle"
    content: Optional[Dict[str, Any]] = {}
    settings: Optional[Dict[str, Any]] = {}

    # Blueprint data
    widget_blueprint_id: Optional[int] = None  # If blueprint exists
    widget_blueprint: Optional[Dict[str, Any]] = None  # Fallback blueprint data

    # Target dashboard
    dashboard_id: int


@router.post("/{widget_id}/export", response_model=WidgetExportData)
async def export_widget(widget_id: int, db: Session = Depends(get_db)):
    """Export a widget with all its data and blueprint information."""
    widget = db.query(Widget).filter(Widget.id == widget_id).first()
    if not widget:
        raise HTTPException(status_code=404, detail="Widget not found")

    # Get blueprint data
    blueprint = db.query(WidgetBlueprint).filter(WidgetBlueprint.id == widget.widget_blueprint_id).first()
    if not blueprint:
        raise HTTPException(status_code=404, detail="Widget blueprint not found")

    # Handle both Universal Widget System (v2.0) and Legacy widgets
    blueprint_data = {
        "id": blueprint.id,
        "name": blueprint.name,
        "description": blueprint.description,
        "widget_metadata": blueprint.widget_metadata,
        "is_public": blueprint.is_public,
    }

    # Check if this is a Universal Widget System (v2.0) or Legacy widget
    if getattr(blueprint, "widget_version", "1.0") == "2.0":
        # Universal Widget System format
        blueprint_data.update(
            {
                "widget_version": blueprint.widget_version,
                "data_source": blueprint.data_source,
                "data_schema": blueprint.data_schema,
                "view_schema": blueprint.view_schema,
                "settings": blueprint.settings,
            }
        )
    else:
        # Legacy widget compatibility
        legacy_schema = None
        if hasattr(blueprint, "widget_metadata") and blueprint.widget_metadata:
            legacy_schema = blueprint.widget_metadata.get("legacy_schema")
        blueprint_data.update(
            {
                "widget_engine": getattr(blueprint, "widget_engine", None),
                "schema": legacy_schema,  # Now retrieved from widget_metadata
                "settings": blueprint.settings,
            }
        )

    return WidgetExportData(
        title=widget.title,
        x=widget.x,
        y=widget.y,
        width=widget.width,
        height=widget.height,
        z_index=widget.z_index,
        color=widget.color,
        shape=widget.shape,
        content=widget.content,
        settings=widget.settings,
        widget_blueprint_id=widget.widget_blueprint_id,
        widget_blueprint=blueprint_data,
        exported_at=datetime.utcnow().isoformat(),
    )


@router.post("/import", response_model=WidgetResponse)
async def import_widget(import_data: WidgetImportData, db: Session = Depends(get_db)):
    """Import a widget, creating blueprint if necessary."""

    blueprint_id = import_data.widget_blueprint_id

    # If no blueprint_id provided, try to find or create blueprint from fallback data
    if not blueprint_id and import_data.widget_blueprint:
        blueprint_data = import_data.widget_blueprint

        # Try to find existing blueprint by name and engine
        existing_blueprint = (
            db.query(WidgetBlueprint)
            .filter(
                WidgetBlueprint.name == blueprint_data.get("name"),
                WidgetBlueprint.widget_engine == blueprint_data.get("widget_engine"),
            )
            .first()
        )

        if existing_blueprint:
            blueprint_id = existing_blueprint.id
        else:
            # Create new blueprint from fallback data using Universal Widget System
            new_blueprint = WidgetBlueprint(
                name=blueprint_data.get("name", "Imported Widget"),
                description=blueprint_data.get("description", "Imported from widget export"),
                widget_version="2.0",  # Universal Widget System
                data_source=blueprint_data.get("data_source", {"type": "userInput"}),
                data_schema=blueprint_data.get("data_schema", {"fields": []}),
                view_schema=blueprint_data.get("view_schema", {"displayComponent": "Table", "mappings": {}}),
                settings=blueprint_data.get("settings", {}),
                widget_metadata=blueprint_data.get("widget_metadata", {}),
                is_public=False,  # Imported blueprints are private by default
            )
            db.add(new_blueprint)
            db.commit()
            db.refresh(new_blueprint)
            blueprint_id = new_blueprint.id

    if not blueprint_id:
        raise HTTPException(status_code=400, detail="No widget blueprint provided or blueprint data is incomplete")

    # Create the widget
    widget_create = WidgetCreate(
        dashboard_id=import_data.dashboard_id,
        widget_blueprint_id=blueprint_id,
        title=import_data.title,
        x=import_data.x,
        y=import_data.y,
        width=import_data.width,
        height=import_data.height,
        color=import_data.color,
        shape=import_data.shape,
        content=import_data.content or {},
        settings=import_data.settings or {},
    )

    return await create_widget(widget_create, db)
