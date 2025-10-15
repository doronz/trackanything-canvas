"""
Dashboard management API routes.
This module handles CRUD operations for dashboards including canvas state management.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from database import Dashboard, Widget, WidgetBlueprint, WidgetConnection, get_db

router = APIRouter()

# Pydantic models for request/response


class DashboardCreate(BaseModel):
    name: str
    description: Optional[str] = None


class DashboardUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    canvas_state: Optional[dict] = None


class DashboardResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    thumbnail: Optional[str]
    canvas_state: Optional[dict]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


@router.get("/", response_model=List[DashboardResponse])
async def list_dashboards(db: Session = Depends(get_db)):
    """List all dashboards with thumbnails and metadata."""
    dashboards = db.query(Dashboard).order_by(Dashboard.updated_at.desc()).all()
    return dashboards


@router.post("/", response_model=DashboardResponse)
async def create_dashboard(dashboard: DashboardCreate, db: Session = Depends(get_db)):
    """Create a new dashboard with default canvas state."""
    default_canvas_state = {"zoom": 1.0, "pan": {"x": 0, "y": 0}, "viewport": {"width": 1920, "height": 1080}}

    db_dashboard = Dashboard(name=dashboard.name, description=dashboard.description, canvas_state=default_canvas_state)
    db.add(db_dashboard)
    db.commit()
    db.refresh(db_dashboard)
    return db_dashboard


@router.get("/{dashboard_id}", response_model=DashboardResponse)
async def get_dashboard(dashboard_id: int, db: Session = Depends(get_db)):
    """Get a specific dashboard by ID."""
    dashboard = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return dashboard


@router.put("/{dashboard_id}", response_model=DashboardResponse)
async def update_dashboard(dashboard_id: int, dashboard_update: DashboardUpdate, db: Session = Depends(get_db)):
    """Update dashboard metadata and canvas state."""
    dashboard = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    update_data = dashboard_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(dashboard, field, value)

    dashboard.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(dashboard)
    return dashboard


@router.delete("/{dashboard_id}")
async def delete_dashboard(dashboard_id: int, db: Session = Depends(get_db)):
    """Delete a dashboard and all its widgets."""
    dashboard = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    # Delete all widgets in this dashboard
    db.query(Widget).filter(Widget.dashboard_id == dashboard_id).delete()

    # Delete the dashboard
    db.delete(dashboard)
    db.commit()

    return {"message": "Dashboard deleted successfully"}


@router.post("/{dashboard_id}/duplicate", response_model=DashboardResponse)
async def duplicate_dashboard(dashboard_id: int, db: Session = Depends(get_db)):
    """Duplicate a dashboard with all its widgets."""
    original = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
    if not original:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    # Create new dashboard
    new_dashboard = Dashboard(
        name=f"{original.name} (Copy)", description=original.description, canvas_state=original.canvas_state
    )
    db.add(new_dashboard)
    db.commit()
    db.refresh(new_dashboard)

    # Copy all widgets
    widgets = db.query(Widget).filter(Widget.dashboard_id == dashboard_id).all()
    for widget in widgets:
        new_widget = Widget(
            dashboard_id=new_dashboard.id,
            widget_blueprint_id=widget.widget_blueprint_id,
            title=widget.title,
            x=widget.x + 20,  # Offset slightly
            y=widget.y + 20,
            width=widget.width,
            height=widget.height,
            z_index=widget.z_index,
            color=widget.color,
            shape=widget.shape,
            content=widget.content,
            settings=widget.settings,
        )
        db.add(new_widget)

    db.commit()
    db.refresh(new_dashboard)
    return new_dashboard


# Dashboard Export/Import


class DashboardExportData(BaseModel):
    """Model for exported dashboard data."""

    export_version: str = "2.0"
    dashboard: Dict[str, Any]
    widgets: List[Dict[str, Any]]
    connections: List[Dict[str, Any]] = []
    exported_at: str
    export_metadata: Dict[str, Any]


class DashboardImportData(BaseModel):
    """Model for imported dashboard data."""

    name: str
    description: Optional[str] = None
    canvas_state: Optional[Dict[str, Any]] = None
    widgets: List[Dict[str, Any]]
    connections: List[Dict[str, Any]] = []


@router.post("/{dashboard_id}/export", response_model=DashboardExportData)
async def export_dashboard(dashboard_id: int, db: Session = Depends(get_db)):
    """
    Export a dashboard with all its widgets and blueprint information.
    This creates a complete snapshot that can be imported elsewhere.
    """
    dashboard = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")

    # Get all widgets in this dashboard
    widgets = db.query(Widget).filter(Widget.dashboard_id == dashboard_id).all()

    # Get all widget IDs for this dashboard
    widget_ids = [w.id for w in widgets]

    # Get all connections between widgets in this dashboard
    connections = (
        db.query(WidgetConnection)
        .filter(WidgetConnection.source_widget_id.in_(widget_ids), WidgetConnection.target_widget_id.in_(widget_ids))
        .all()
    )

    # Build export data for each widget
    widgets_data = []
    for widget in widgets:
        # Get blueprint data
        blueprint = db.query(WidgetBlueprint).filter(WidgetBlueprint.id == widget.widget_blueprint_id).first()

        widget_data = {
            "id": widget.id,  # Include widget ID for connection mapping
            "title": widget.title,
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
        }

        # Include blueprint information
        if blueprint:
            blueprint_data = {
                "id": blueprint.id,
                "name": blueprint.name,
                "description": blueprint.description,
                "widget_metadata": blueprint.widget_metadata,
                "is_public": blueprint.is_public,
            }

            # Check if this is a Universal Widget System (v2.0) or Legacy widget
            if getattr(blueprint, "widget_version", "1.0") == "2.0":
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
                        "schema": legacy_schema,
                        "settings": blueprint.settings,
                    }
                )

            widget_data["widget_blueprint"] = blueprint_data

        widgets_data.append(widget_data)

    # Build connections data
    connections_data = []
    for connection in connections:
        connections_data.append(
            {
                "source_widget_id": connection.source_widget_id,
                "target_widget_id": connection.target_widget_id,
                "connection_type": connection.connection_type,
                "mapping_config": connection.mapping_config,
                "ai_conversion_prompt": connection.ai_conversion_prompt,
                "is_active": connection.is_active,
                "visual_config": connection.visual_config,
            }
        )

    # Build the export data
    export_data = DashboardExportData(
        export_version="2.0",
        dashboard={
            "name": dashboard.name,
            "description": dashboard.description,
            "canvas_state": dashboard.canvas_state,
        },
        widgets=widgets_data,
        connections=connections_data,
        exported_at=datetime.utcnow().isoformat(),
        export_metadata={
            "original_dashboard_id": dashboard.id,
            "widget_count": len(widgets_data),
            "connection_count": len(connections_data),
            "exported_by": "Canvas MCP Client",
        },
    )

    return export_data


@router.post("/import")
async def import_dashboard(import_data: DashboardImportData, db: Session = Depends(get_db)):
    """
    Import a dashboard from exported data.
    Creates a new dashboard with all its widgets.
    """
    # Create the new dashboard
    new_dashboard = Dashboard(
        name=import_data.name,
        description=import_data.description,
        canvas_state=import_data.canvas_state
        or {"zoom": 1.0, "pan": {"x": 0, "y": 0}, "viewport": {"width": 1920, "height": 1080}},
    )
    db.add(new_dashboard)
    db.commit()
    db.refresh(new_dashboard)

    # Import all widgets
    imported_widgets = []
    widget_id_mapping = {}  # Map old widget IDs to new widget IDs

    for widget_data in import_data.widgets:
        # Get or create blueprint
        blueprint_id = widget_data.get("widget_blueprint_id")
        blueprint_data = widget_data.get("widget_blueprint")

        # If blueprint data is provided but blueprint doesn't exist, create it
        if blueprint_data and not db.query(WidgetBlueprint).filter(WidgetBlueprint.id == blueprint_id).first():
            # Check if a public blueprint with the same name exists
            existing_blueprint = (
                db.query(WidgetBlueprint)
                .filter(WidgetBlueprint.name == blueprint_data["name"], WidgetBlueprint.is_public == True)
                .first()
            )

            if existing_blueprint:
                blueprint_id = existing_blueprint.id
            else:
                # TODO: For now, skip widgets with missing blueprints
                # In a production system, you might want to create the blueprint
                continue

        # Create the widget
        new_widget = Widget(
            dashboard_id=new_dashboard.id,
            widget_blueprint_id=blueprint_id,
            title=widget_data.get("title"),
            x=widget_data.get("x", 100),
            y=widget_data.get("y", 100),
            width=widget_data.get("width", 300),
            height=widget_data.get("height", 200),
            z_index=widget_data.get("z_index", 1),
            color=widget_data.get("color", "#ffffff"),
            shape=widget_data.get("shape", "rectangle"),
            content=widget_data.get("content", {}),
            settings=widget_data.get("settings", {}),
        )
        db.add(new_widget)
        db.flush()  # Flush to get the new widget ID

        # Map old widget ID to new widget ID
        # We need to track the original widget ID from the export
        # The widget_data should include an 'id' field for the original widget
        if "id" in widget_data or "original_id" in widget_data:
            original_id = widget_data.get("id") or widget_data.get("original_id")
            widget_id_mapping[original_id] = new_widget.id

        imported_widgets.append(new_widget)

    db.commit()

    # Now import connections with the new widget IDs
    imported_connections = []
    for connection_data in import_data.connections:
        old_source_id = connection_data.get("source_widget_id")
        old_target_id = connection_data.get("target_widget_id")

        # Map old IDs to new IDs
        new_source_id = widget_id_mapping.get(old_source_id)
        new_target_id = widget_id_mapping.get(old_target_id)

        # Only create connection if both widgets exist
        if new_source_id and new_target_id:
            new_connection = WidgetConnection(
                source_widget_id=new_source_id,
                target_widget_id=new_target_id,
                connection_type=connection_data.get("connection_type", "data_flow"),
                mapping_config=connection_data.get("mapping_config"),
                ai_conversion_prompt=connection_data.get("ai_conversion_prompt"),
                is_active=connection_data.get("is_active", True),
                visual_config=connection_data.get("visual_config"),
            )
            db.add(new_connection)
            imported_connections.append(new_connection)

    db.commit()

    return {
        "message": "Dashboard imported successfully",
        "dashboard_id": new_dashboard.id,
        "widget_count": len(imported_widgets),
        "connection_count": len(imported_connections),
    }
