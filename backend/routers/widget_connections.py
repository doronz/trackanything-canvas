"""
Widget connections API routes.
This module handles CRUD operations for widget connections and AI-powered data conversion.
"""

import html
import inspect
import json
import re
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

import requests
from bs4 import BeautifulSoup
from fastapi import APIRouter, Depends, HTTPException
from markdownify import markdownify as md
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from database import AIConfig, Widget, WidgetBlueprint, WidgetConnection, get_db
from services.ai_conversion_service import AIConversionService

from .widgets import widget_to_response

router = APIRouter()


def truncate_text(text: str, max_length: int = 200) -> str:
    """Truncate text for logging purposes."""
    if not text:
        return "(empty)"
    if len(text) <= max_length:
        return text
    return text[:max_length] + f"... (truncated, total length: {len(text)} chars)"


def truncate_json(data: Any, max_length: int = 500) -> str:
    """Truncate JSON for logging purposes."""
    if data is None:
        return "(none)"
    json_str = json.dumps(data, indent=2)
    if len(json_str) <= max_length:
        return json_str
    return json_str[:max_length] + f"... (truncated, total length: {len(json_str)} chars)"


def log_with_location(message: str, trace_id: Optional[str] = None):
    """Log a message with file location information."""
    frame = inspect.currentframe().f_back
    filename = frame.f_code.co_filename.split("/")[-1]  # Get just the filename, not full path
    line_number = frame.f_lineno

    if trace_id:
        print(f"[TRACE:{trace_id}] [{filename}:{line_number}] {message}")
    else:
        print(f"[{filename}:{line_number}] {message}")


def convert_html_to_markdown(html_content: str) -> str:
    """Convert HTML content to markdown format using the markdownify library."""
    if not html_content or not isinstance(html_content, str):
        return ""

    try:
        # Use markdownify with optimal settings for webpage content
        markdown_text = md(
            html_content,
            heading_style="ATX",  # Use # style headers (more standard)
            bullets="*+-",  # Use varied bullet styles for nested lists
            autolinks=True,  # Convert matching href text to autolinks
            escape_misc=False,  # Don't escape special chars unnecessarily
            wrap=True,  # Wrap long lines
            wrap_width=80,  # Wrap at 80 characters
        )

        # Clean up excessive newlines while preserving structure
        markdown_text = re.sub(r"\n{3,}", "\n\n", markdown_text)

        # Ensure there's content or provide a default
        if not markdown_text.strip():
            return "# Webpage Content\n\nContent could not be converted to markdown."

        return markdown_text.strip()

    except Exception as e:
        # Fallback to a simple conversion if markdownify fails
        print(f"Error converting HTML to markdown: {e}")
        # Remove HTML tags as fallback
        text = re.sub(r"<[^>]+>", "", html_content)
        text = html.unescape(text)
        return text.strip() or "# Webpage Content\n\nContent could not be converted to markdown."


def fetch_webpage_content(url: str) -> str:
    """Fetch and extract readable content from a webpage URL."""
    if not url or not isinstance(url, str):
        return ""

    try:
        # Add a schema if missing
        if not url.startswith(("http://", "https://")):
            url = "https://" + url

        # Set headers to mimic a real browser
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate",
            "Connection": "keep-alive",
        }

        # Make the request with timeout
        response = requests.get(url, headers=headers, timeout=10, allow_redirects=True)
        response.raise_for_status()

        # Parse HTML content
        soup = BeautifulSoup(response.content, "html.parser")

        # Remove script and style elements
        for script in soup(["script", "style", "nav", "footer", "header", "aside"]):
            script.decompose()

        # Try to find main content areas
        content_selectors = [
            "main",
            "article",
            '[role="main"]',
            ".content",
            ".main-content",
            "#content",
            "#main-content",
            ".post-content",
            ".entry-content",
            ".article-content",
        ]

        main_content = None
        for selector in content_selectors:
            elements = soup.select(selector)
            if elements:
                main_content = elements[0]
                break

        # If no main content found, use body
        if not main_content:
            main_content = soup.find("body") or soup

        # Extract title
        title_tag = soup.find("title")
        title = title_tag.get_text().strip() if title_tag else ""

        # Extract meta description
        meta_desc = soup.find("meta", attrs={"name": "description"})
        description = meta_desc.get("content", "").strip() if meta_desc else ""

        # Build structured HTML content
        html_parts = []

        if title:
            html_parts.append(f"<h1>{html.escape(title)}</h1>")

        if description:
            html_parts.append(f"<p><em>{html.escape(description)}</em></p>")

        # Extract text content from main content
        if main_content:
            # Get text content while preserving some structure
            for p in main_content.find_all(["p", "h1", "h2", "h3", "h4", "h5", "h6"]):
                text = p.get_text().strip()
                if text and len(text) > 10:  # Filter out very short paragraphs
                    tag_name = p.name
                    if tag_name in ["h1", "h2", "h3", "h4", "h5", "h6"]:
                        html_parts.append(f"<{tag_name}>{html.escape(text)}</{tag_name}>")
                    else:
                        html_parts.append(f"<p>{html.escape(text)}</p>")

            # Extract lists
            for ul in main_content.find_all(["ul", "ol"]):
                list_items = []
                for li in ul.find_all("li"):
                    text = li.get_text().strip()
                    if text:
                        list_items.append(f"<li>{html.escape(text)}</li>")

                if list_items:
                    tag_name = ul.name
                    html_parts.append(f'<{tag_name}>{"".join(list_items)}</{tag_name}>')

        # Add source URL
        html_parts.append(f'<p><a href="{html.escape(url)}">Source: {html.escape(url)}</a></p>')

        return "\n".join(html_parts)

    except requests.RequestException as e:
        print(f"Error fetching webpage {url}: {e}")
        # Fallback to just the URL
        return f'<h1>Webpage</h1><p><a href="{html.escape(url)}">{html.escape(url)}</a></p>'
    except Exception as e:
        print(f"Error parsing webpage {url}: {e}")
        # Fallback to just the URL
        return f'<h1>Webpage</h1><p><a href="{html.escape(url)}">{html.escape(url)}</a></p>'


# Pydantic models for request/response


class WidgetConnectionCreate(BaseModel):
    source_widget_id: int
    target_widget_id: int
    connection_type: str = "data_flow"
    mapping_config: Optional[Dict[str, Any]] = None
    ai_conversion_prompt: Optional[str] = None
    visual_config: Optional[Dict[str, Any]] = None


class WidgetConnectionUpdate(BaseModel):
    connection_type: Optional[str] = None
    mapping_config: Optional[Dict[str, Any]] = None
    ai_conversion_prompt: Optional[str] = None
    is_active: Optional[bool] = None
    visual_config: Optional[Dict[str, Any]] = None


class WidgetConnectionResponse(BaseModel):
    id: int
    source_widget_id: int
    target_widget_id: int
    connection_type: str
    mapping_config: Optional[Dict[str, Any]]
    ai_conversion_prompt: Optional[str]
    is_active: bool
    visual_config: Optional[Dict[str, Any]]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CreateConnectionWithAIRequest(BaseModel):
    source_widget_id: int
    target_widget_type: str  # Type of widget to create
    source_data: str  # Text data to convert
    ai_config_id: Optional[int] = None  # AI configuration to use
    transformation_prompt: Optional[str] = None  # Optional AI prompt to transform source data before conversion
    position: Dict[str, float]  # Where to place the new widget
    direction: Optional[str] = None  # Connection direction (right, left, top, bottom)


class CreateEmptyWidgetRequest(BaseModel):
    source_widget_id: int
    target_widget_type: str  # Type of widget to create
    position: Dict[str, float]  # Where to place the new widget
    direction: Optional[str] = None  # Connection direction (right, left, top, bottom)


@router.get("/dashboard/{dashboard_id}", response_model=List[WidgetConnectionResponse])
async def list_dashboard_connections(dashboard_id: int, db: Session = Depends(get_db)):
    """List all connections for widgets in a specific dashboard."""
    # Get all widgets in the dashboard
    widget_ids_query = db.query(Widget.id).filter(Widget.dashboard_id == dashboard_id)

    # Get connections where either source or target is in this dashboard
    connections = (
        db.query(WidgetConnection)
        .filter(
            (WidgetConnection.source_widget_id.in_(widget_ids_query))
            | (WidgetConnection.target_widget_id.in_(widget_ids_query))
        )
        .all()
    )

    return connections


@router.get("/ai-config-status")
async def get_ai_config_status(db: Session = Depends(get_db)):
    """Check if AI configuration is available for widget connections."""
    # First try to get the default AI config
    ai_config = db.query(AIConfig).filter(AIConfig.is_default.is_(True)).first()

    # If no default, use any available AI config
    if not ai_config:
        ai_config = db.query(AIConfig).first()

    if not ai_config:
        return {
            "available": False,
            "message": "No AI configuration found. Please configure an AI provider first.",
            "has_configs": False,
        }

    # Ollama doesn't require API key, but other providers do
    if ai_config.provider.lower() != "ollama" and not ai_config.api_key_encrypted:
        return {
            "available": False,
            "message": "AI configuration has no API key. Please add an API key.",
            "has_configs": True,
        }

    # Determine if this is the default config or just any available config
    config_status = "Default AI configuration" if ai_config.is_default else f"Using {ai_config.name}"

    return {
        "available": True,
        "message": config_status,
        "config_name": ai_config.name,
        "provider": ai_config.provider,
        "model": ai_config.model,
    }


@router.get("/{connection_id}", response_model=WidgetConnectionResponse)
async def get_connection(connection_id: int, db: Session = Depends(get_db)):
    """Get a specific connection by ID."""
    connection = db.query(WidgetConnection).filter(WidgetConnection.id == connection_id).first()
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    return connection


@router.post("/", response_model=WidgetConnectionResponse)
async def create_connection(connection: WidgetConnectionCreate, db: Session = Depends(get_db)):
    """Create a new widget connection."""
    # Verify both widgets exist
    source_widget = db.query(Widget).filter(Widget.id == connection.source_widget_id).first()
    target_widget = db.query(Widget).filter(Widget.id == connection.target_widget_id).first()

    if not source_widget:
        raise HTTPException(status_code=404, detail="Source widget not found")
    if not target_widget:
        raise HTTPException(status_code=404, detail="Target widget not found")

    # Check if connection already exists
    existing = (
        db.query(WidgetConnection)
        .filter(
            WidgetConnection.source_widget_id == connection.source_widget_id,
            WidgetConnection.target_widget_id == connection.target_widget_id,
        )
        .first()
    )

    if existing:
        raise HTTPException(status_code=400, detail="Connection already exists between these widgets")

    db_connection = WidgetConnection(
        source_widget_id=connection.source_widget_id,
        target_widget_id=connection.target_widget_id,
        connection_type=connection.connection_type,
        mapping_config=connection.mapping_config or {},
        ai_conversion_prompt=connection.ai_conversion_prompt,
        visual_config=connection.visual_config or {},
        is_active=True,
    )

    db.add(db_connection)
    db.commit()
    db.refresh(db_connection)
    return db_connection


@router.put("/{connection_id}", response_model=WidgetConnectionResponse)
async def update_connection(
    connection_id: int, connection_update: WidgetConnectionUpdate, db: Session = Depends(get_db)
):
    """Update a widget connection."""
    connection = db.query(WidgetConnection).filter(WidgetConnection.id == connection_id).first()
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")

    update_data = connection_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(connection, field, value)

    connection.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(connection)
    return connection


@router.delete("/{connection_id}")
async def delete_connection(connection_id: int, db: Session = Depends(get_db)):
    """Delete a widget connection."""
    connection = db.query(WidgetConnection).filter(WidgetConnection.id == connection_id).first()
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")

    db.delete(connection)
    db.commit()
    return {"message": "Connection deleted successfully"}


@router.post("/create-with-ai")
async def create_connection_with_ai(request: CreateConnectionWithAIRequest, db: Session = Depends(get_db)):
    """Create a new widget with AI-converted data and connect it to the source widget."""
    # Generate unique trace ID for this flow
    trace_id = str(uuid.uuid4())[:8]

    print(f"\n{'='*80}")
    log_with_location(f"🚀 WIDGET CONNECTION FLOW STARTED", trace_id)
    print(f"{'='*80}")
    log_with_location(f"⏰ Timestamp: {datetime.utcnow().isoformat()}", trace_id)
    log_with_location(f"📊 Request Details:", trace_id)
    log_with_location(f"  - Source Widget ID: {request.source_widget_id}", trace_id)
    log_with_location(f"  - Target Widget Type: {request.target_widget_type}", trace_id)
    log_with_location(f"  - AI Config ID: {request.ai_config_id or '(default)'}", trace_id)
    log_with_location(f"  - Position: x={request.position.get('x')}, y={request.position.get('y')}", trace_id)
    log_with_location(f"  - Direction: {request.direction or '(none)'}", trace_id)
    print(f"{'='*80}\n")

    # Verify source widget exists
    log_with_location(f"🔍 Step 1: Verifying source widget...", trace_id)
    source_widget = db.query(Widget).filter(Widget.id == request.source_widget_id).first()
    if not source_widget:
        log_with_location(f"❌ ERROR: Source widget not found", trace_id)
        raise HTTPException(status_code=404, detail="Source widget not found")

    log_with_location(f"✅ Source widget found:", trace_id)
    log_with_location(f"  - Title: {source_widget.title}", trace_id)
    log_with_location(f"  - Dashboard ID: {source_widget.dashboard_id}", trace_id)
    log_with_location(f"  - Blueprint ID: {source_widget.widget_blueprint_id}", trace_id)
    log_with_location(f"  - Content Preview: {truncate_json(source_widget.content, 300)}\n", trace_id)

    # Get the dashboard ID from source widget
    dashboard_id = source_widget.dashboard_id

    # Check if AI configuration is available
    log_with_location(f"🔍 Step 2: Checking AI configuration...", trace_id)
    if request.ai_config_id:
        ai_config = db.query(AIConfig).filter(AIConfig.id == request.ai_config_id).first()
        log_with_location(f"  - Using specified AI Config ID: {request.ai_config_id}", trace_id)
    else:
        ai_config = db.query(AIConfig).filter(AIConfig.is_default.is_(True)).first()
        log_with_location(f"  - Using default AI Config", trace_id)

    if not ai_config:
        log_with_location(f"❌ ERROR: No AI configuration found", trace_id)
        raise HTTPException(status_code=400, detail="No AI configuration found. Please configure an AI provider first.")

    log_with_location(f"✅ AI Configuration:", trace_id)
    log_with_location(f"  - ID: {ai_config.id}", trace_id)
    log_with_location(f"  - Name: {ai_config.name}", trace_id)
    log_with_location(f"  - Provider: {ai_config.provider}", trace_id)
    log_with_location(f"  - Model: {ai_config.model}", trace_id)
    log_with_location(f"  - Has API Key: {'Yes' if ai_config.api_key_encrypted else 'No (Ollama)'}\n", trace_id)

    # Ollama doesn't require API key, but other providers do
    if ai_config.provider.lower() != "ollama" and not ai_config.api_key_encrypted:
        log_with_location(f"❌ ERROR: AI configuration missing API key", trace_id)
        raise HTTPException(
            status_code=400, detail="AI configuration has no API key. Please add an API key to your AI configuration."
        )

    try:
        # Initialize AI conversion service
        log_with_location(f"🔍 Step 3: Initializing AI conversion service...", trace_id)
        ai_service = AIConversionService()
        ai_service.set_trace_id(trace_id)  # Pass trace ID to service
        log_with_location(f"✅ AI service initialized\n", trace_id)

        # Get the target widget blueprint for schema information
        log_with_location(f"🔍 Step 4: Retrieving target widget blueprint...", trace_id)
        target_blueprint = await ai_service.get_blueprint_for_widget_type(request.target_widget_type, db)

        if not target_blueprint:
            log_with_location(f"❌ ERROR: No blueprint found for widget type: {request.target_widget_type}", trace_id)
            raise HTTPException(
                status_code=400, detail=f"No blueprint found for widget type: {request.target_widget_type}"
            )

        log_with_location(f"✅ Target Blueprint found:", trace_id)
        log_with_location(f"  - ID: {target_blueprint.id}", trace_id)
        log_with_location(f"  - Name: {target_blueprint.name}", trace_id)
        log_with_location(f"  - Version: {target_blueprint.widget_version}", trace_id)
        log_with_location(
            f"  - Category: {target_blueprint.widget_metadata.get('category') if target_blueprint.widget_metadata else 'N/A'}\n",
            trace_id,
        )

        # Convert text data to structured data using AI with schema
        # Handle both legacy 'schema' (now in widget_metadata) and Universal Widget System 'data_schema'
        legacy_schema = None
        if hasattr(target_blueprint, "widget_metadata") and target_blueprint.widget_metadata:
            legacy_schema = target_blueprint.widget_metadata.get("legacy_schema")
        target_schema = legacy_schema or getattr(target_blueprint, "data_schema", None)

        log_with_location(f"📋 Step 5: Preparing input data for AI conversion...", trace_id)
        log_with_location(f"  - Transformation Prompt: {request.transformation_prompt or '(none)'}", trace_id)
        log_with_location(f"  - Source Data Length: {len(request.source_data)} chars", trace_id)
        log_with_location(f"  - Source Data Preview: {truncate_text(request.source_data, 200)}", trace_id)
        log_with_location(f"  - Target Schema: {truncate_json(target_schema, 400)}\n", trace_id)

        log_with_location(f"🤖 Step 6: Starting AI conversion...", trace_id)
        converted_data = await ai_service.convert_text_to_widget_data(
            text_data=request.source_data,
            target_widget_type=request.target_widget_type,
            target_schema=target_schema,
            ai_config_id=ai_config.id,
            transformation_prompt=request.transformation_prompt,
            db=db,
        )

        log_with_location(f"\n✅ Step 7: AI conversion completed successfully", trace_id)
        log_with_location(f"  - Output Data Type: {type(converted_data).__name__}", trace_id)
        log_with_location(
            f"  - Output Data Keys: {list(converted_data.keys()) if isinstance(converted_data, dict) else 'N/A'}",
            trace_id,
        )
        log_with_location(f"  - Output Data Preview: {truncate_json(converted_data, 500)}\n", trace_id)

        # Get the highest z_index for this dashboard
        max_z = db.query(Widget).filter(Widget.dashboard_id == dashboard_id).count()

        log_with_location(f"🔍 Step 8: Creating target widget in database...", trace_id)
        # Create the target widget
        target_widget = Widget(
            dashboard_id=dashboard_id,
            title=f"{request.target_widget_type.replace('_', ' ').title()} from {source_widget.title}",
            x=request.position.get("x", 100),
            y=request.position.get("y", 100),
            width=400,
            height=300,
            z_index=max_z + 1,
            color="#ffffff",
            shape="rounded",
            content=converted_data,
            settings={},
            widget_blueprint_id=target_blueprint.id,
        )

        db.add(target_widget)
        db.flush()  # Get the ID without committing

        log_with_location(f"✅ Target widget created:", trace_id)
        log_with_location(f"  - Widget ID: {target_widget.id}", trace_id)
        log_with_location(f"  - Title: {target_widget.title}", trace_id)
        log_with_location(f"  - Position: ({target_widget.x}, {target_widget.y})", trace_id)
        log_with_location(f"  - Z-Index: {target_widget.z_index}\n", trace_id)

        log_with_location(f"🔍 Step 9: Creating connection between widgets...", trace_id)
        # Create the connection
        connection = WidgetConnection(
            source_widget_id=request.source_widget_id,
            target_widget_id=target_widget.id,
            connection_type="ai_conversion",
            mapping_config={
                "source_data_path": "content",
                "conversion_type": request.target_widget_type,
                "ai_generated": True,
                "transformation_prompt": request.transformation_prompt,  # Store the transformation prompt
            },
            ai_conversion_prompt=f"Convert to {request.target_widget_type}"
            + (f" (with transformation: {request.transformation_prompt})" if request.transformation_prompt else ""),
            visual_config={
                "line_style": "curved",
                "color": "#6B7280",
                "width": 2,
                "source_direction": request.direction or "right",
            },
            is_active=True,
        )

        db.add(connection)
        db.commit()
        db.refresh(target_widget)
        db.refresh(connection)

        log_with_location(f"✅ Connection created:", trace_id)
        log_with_location(f"  - Connection ID: {connection.id}", trace_id)
        log_with_location(f"  - Type: {connection.connection_type}", trace_id)
        log_with_location(
            f"  - Source → Target: {connection.source_widget_id} → {connection.target_widget_id}", trace_id
        )
        log_with_location(f"  - Direction: {request.direction or 'right'}\n", trace_id)

        print(f"{'='*80}")
        log_with_location(f"🎉 WIDGET CONNECTION FLOW COMPLETED SUCCESSFULLY", trace_id)
        print(f"{'='*80}")
        log_with_location(f"⏱️  Duration: Complete", trace_id)
        log_with_location(f"📊 Summary:", trace_id)
        log_with_location(f"  - Created Widget ID: {target_widget.id}", trace_id)
        log_with_location(f"  - Created Connection ID: {connection.id}", trace_id)
        log_with_location(f"  - AI Provider Used: {ai_config.provider} ({ai_config.model})", trace_id)
        log_with_location(f"  - Transformation Applied: {'Yes' if request.transformation_prompt else 'No'}", trace_id)
        print(f"{'='*80}\n")

        return {
            "message": "Widget and connection created successfully",
            "target_widget": widget_to_response(target_widget, db),
            "connection": {
                "id": connection.id,
                "source_widget_id": connection.source_widget_id,
                "target_widget_id": connection.target_widget_id,
                "connection_type": connection.connection_type,
                "mapping_config": connection.mapping_config,
                "ai_conversion_prompt": connection.ai_conversion_prompt,
                "visual_config": connection.visual_config,
                "is_active": connection.is_active,
                "created_at": connection.created_at.isoformat() if connection.created_at else None,
                "updated_at": connection.updated_at.isoformat() if connection.updated_at else None,
            },
        }

    except Exception as e:
        log_with_location(f"\n❌ FATAL ERROR in widget connection flow", trace_id)
        log_with_location(f"  - Error Type: {type(e).__name__}", trace_id)
        log_with_location(f"  - Error Message: {str(e)}", trace_id)
        log_with_location(f"  - Rolling back database transaction...", trace_id)
        print(f"{'='*80}\n")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"AI conversion failed: {str(e)}")


@router.post("/create-with-empty-widget")
async def create_connection_with_empty_widget(request: CreateEmptyWidgetRequest, db: Session = Depends(get_db)):
    """Create a new empty widget and connect it to the source widget."""
    # Verify source widget exists
    source_widget = db.query(Widget).filter(Widget.id == request.source_widget_id).first()
    if not source_widget:
        raise HTTPException(status_code=404, detail="Source widget not found")

    # Get the dashboard ID from source widget
    dashboard_id = source_widget.dashboard_id

    try:
        # Get the target widget blueprint for the widget type
        # Universal Widget System: Find blueprint by name
        target_widget_name = request.target_widget_type.replace("_", " ").title()
        target_blueprint = (
            db.query(WidgetBlueprint).filter(WidgetBlueprint.name.ilike(f"%{target_widget_name}%")).first()
        )

        # Fallback to broader name search
        if not target_blueprint:
            target_blueprint = (
                db.query(WidgetBlueprint)
                .filter(WidgetBlueprint.name.ilike(f"%{request.target_widget_type.replace('_', ' ')}%"))
                .first()
            )

        if not target_blueprint:
            raise HTTPException(
                status_code=400, detail=f"No blueprint found for widget type: {request.target_widget_type}"
            )

        # Get the highest z_index for this dashboard
        max_z = db.query(Widget).filter(Widget.dashboard_id == dashboard_id).count()

        # Create empty content based on widget type
        empty_content = {}
        if request.target_widget_type == "sticky_note":
            empty_content = {"text": ""}
        elif request.target_widget_type == "markdown_editor":
            empty_content = {"markdown": "", "lastSaved": ""}
        elif request.target_widget_type == "todo_list":
            empty_content = {"items": []}
        elif request.target_widget_type == "table":
            empty_content = {"data": [], "columns": []}
        elif request.target_widget_type == "kanban":
            empty_content = {"columns": []}
        elif request.target_widget_type == "data_widget":
            empty_content = {"data": []}
        elif request.target_widget_type == "flash_card":
            empty_content = {"cards": []}

        # Create the target widget
        target_widget = Widget(
            dashboard_id=dashboard_id,
            title=f"Empty {request.target_widget_type.replace('_', ' ').title()}",
            x=request.position.get("x", 100),
            y=request.position.get("y", 100),
            width=400,
            height=300,
            z_index=max_z + 1,
            color="#ffffff",
            shape="rounded",
            content=empty_content,
            settings={},
            widget_blueprint_id=target_blueprint.id,
        )

        db.add(target_widget)
        db.flush()  # Get the ID without committing

        # Create the connection
        connection = WidgetConnection(
            source_widget_id=request.source_widget_id,
            target_widget_id=target_widget.id,
            connection_type="empty_widget",
            mapping_config={"conversion_type": request.target_widget_type, "empty_widget": True},
            ai_conversion_prompt=None,
            visual_config={
                "line_style": "dashed",
                "color": "#6B7280",
                "width": 2,
                "source_direction": request.direction or "right",
            },
            is_active=True,
        )

        db.add(connection)
        db.commit()
        db.refresh(target_widget)
        db.refresh(connection)

        return {
            "message": "Empty widget and connection created successfully",
            "target_widget": widget_to_response(target_widget, db),
            "connection": {
                "id": connection.id,
                "source_widget_id": connection.source_widget_id,
                "target_widget_id": connection.target_widget_id,
                "connection_type": connection.connection_type,
            },
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Empty widget creation failed: {str(e)}")


@router.post("/create-with-content-copy")
async def create_connection_with_content_copy(request: CreateConnectionWithAIRequest, db: Session = Depends(get_db)):
    """Create a new widget with copied content (no AI conversion required)."""
    # Verify source widget exists
    source_widget = db.query(Widget).filter(Widget.id == request.source_widget_id).first()
    if not source_widget:
        raise HTTPException(status_code=404, detail="Source widget not found")

    # Get the dashboard ID from source widget
    dashboard_id = source_widget.dashboard_id

    try:
        # Get the target widget blueprint for the widget type
        # Universal Widget System: Find blueprint by name
        target_widget_name = request.target_widget_type.replace("_", " ").title()
        target_blueprint = (
            db.query(WidgetBlueprint).filter(WidgetBlueprint.name.ilike(f"%{target_widget_name}%")).first()
        )

        # Fallback to broader name search
        if not target_blueprint:
            target_blueprint = (
                db.query(WidgetBlueprint)
                .filter(WidgetBlueprint.name.ilike(f"%{request.target_widget_type.replace('_', ' ')}%"))
                .first()
            )

        if not target_blueprint:
            raise HTTPException(
                status_code=400, detail=f"No blueprint found for widget type: {request.target_widget_type}"
            )

        # Get the highest z_index for this dashboard
        max_z = db.query(Widget).filter(Widget.dashboard_id == dashboard_id).count()

        # Create content based on target widget type with simple copy
        content = {}
        if request.target_widget_type == "sticky_note":
            # Process source data - handle URLs from webpage widgets
            source_data = request.source_data.strip()

            # Try to detect if this is a URL-like content from webpage widget
            if source_data.startswith("<url>") and source_data.endswith("</url>"):
                # Extract URL from <url>...</url> format (new format from frontend)
                url = source_data[5:-6]  # Remove <url> and </url> tags

                # Fetch actual webpage content if URL detected
                if url and (url.startswith("http://") or url.startswith("https://")):
                    webpage_html = fetch_webpage_content(url)
                    if webpage_html:
                        # Convert HTML content to plain text for sticky note
                        from bs4 import BeautifulSoup

                        soup = BeautifulSoup(webpage_html, "html.parser")
                        # Extract text content and clean it up
                        text_content = soup.get_text(separator=" ", strip=True)
                        # Limit text length for sticky note (first 500 characters)
                        if len(text_content) > 500:
                            text_content = text_content[:500] + "..."
                        source_data = text_content
                    else:
                        # Fallback to URL if content fetch failed
                        source_data = f"Website: {url}"
                else:
                    # Invalid URL, use as-is
                    source_data = source_data

            content = {"text": source_data}
        elif request.target_widget_type.lower() in ["markdown_editor", "markdown editor"]:
            # Check if source data contains a URL (from webpage widget)
            source_data = request.source_data.strip()

            # Try to detect if this is a URL-like content from webpage widget
            if source_data.startswith("<url>") and source_data.endswith("</url>"):
                # Extract URL from <url>...</url> format (new format from frontend)
                url = source_data[5:-6]  # Remove <url> and </url> tags

            elif source_data.startswith(("<h1>", "http://", "https://")) and (
                "href=" in source_data or source_data.startswith(("http://", "https://"))
            ):

                # Legacy format - extract URL from HTML content or use it directly
                url = source_data
                if source_data.startswith("<"):
                    # Extract URL from HTML content
                    import re

                    url_match = re.search(r'href=["\']([^"\']+)["\']', source_data)
                    if url_match:
                        url = url_match.group(1)
                    else:
                        # Look for URLs in the text content
                        url_match = re.search(r'https?://[^\s<>"]+', source_data)
                        if url_match:
                            url = url_match.group(0)
            else:
                url = None

            # Fetch actual webpage content if URL detected
            if url and (url.startswith("http://") or url.startswith("https://")):
                webpage_html = fetch_webpage_content(url)
                if webpage_html:
                    source_data = webpage_html

            # Convert HTML content to markdown
            markdown_content = convert_html_to_markdown(source_data)
            content = {"markdown": markdown_content, "lastSaved": ""}
        else:
            # For other types that should use AI, fall back to empty content
            content = {"text": request.source_data}

        # Create the target widget
        target_widget = Widget(
            dashboard_id=dashboard_id,
            title=f"{request.target_widget_type.replace('_', ' ').title()} from {source_widget.title}",
            x=request.position.get("x", 100),
            y=request.position.get("y", 100),
            width=400,
            height=300,
            z_index=max_z + 1,
            color="#ffffff",
            shape="rounded",
            content=content,
            settings={},
            widget_blueprint_id=target_blueprint.id,
        )

        db.add(target_widget)
        db.flush()  # Get the ID without committing

        # Create the connection
        connection = WidgetConnection(
            source_widget_id=request.source_widget_id,
            target_widget_id=target_widget.id,
            connection_type="content_copy",
            mapping_config={
                "source_data_path": "content",
                "conversion_type": request.target_widget_type,
                "content_copy": True,
            },
            ai_conversion_prompt=None,
            visual_config={
                "line_style": "solid",
                "color": "#6B7280",
                "width": 2,
                "source_direction": request.direction or "right",
            },
            is_active=True,
        )

        db.add(connection)
        db.commit()
        db.refresh(target_widget)
        db.refresh(connection)

        return {
            "message": "Widget with copied content and connection created successfully",
            "target_widget": widget_to_response(target_widget, db),
            "connection": {
                "id": connection.id,
                "source_widget_id": connection.source_widget_id,
                "target_widget_id": connection.target_widget_id,
                "connection_type": connection.connection_type,
            },
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Content copy failed: {str(e)}")
