"""
Database configuration and models for Canvas MCP Client.
This module sets up SQLAlchemy with SQLite and defines all database models.
"""

import os
from datetime import datetime

from sqlalchemy import JSON, Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/canvas_mcp.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Dependency to get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Database Models


class Dashboard(Base):
    """Dashboard model for storing dashboard configurations."""

    __tablename__ = "dashboards"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    thumbnail = Column(String(255))  # Path to thumbnail image
    canvas_state = Column(JSON)  # Zoom, pan, viewport settings
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Widget(Base):
    """Widget model for storing widget instances on dashboards."""

    __tablename__ = "widgets"

    id = Column(Integer, primary_key=True, index=True)
    dashboard_id = Column(Integer, nullable=False)
    title = Column(String(255))
    x = Column(Float, nullable=False)
    y = Column(Float, nullable=False)
    width = Column(Float, nullable=False)
    height = Column(Float, nullable=False)
    z_index = Column(Integer, default=0)
    color = Column(String(50))  # Hex color code
    shape = Column(String(50), default="rectangle")  # rectangle, rounded, circle
    content = Column(JSON)  # Widget-specific content
    settings = Column(JSON)  # Widget-specific settings
    widget_blueprint_id = Column(
        Integer, ForeignKey("widget_blueprints.id"), nullable=False
    )  # Reference to widget blueprint (required for all widgets)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    widget_blueprint = relationship("WidgetBlueprint", backref="widgets")


class MCPServer(Base):
    """MCP Server configuration model."""

    __tablename__ = "mcp_servers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True)
    transport = Column(String(50), nullable=False)  # stdio, http, sse
    config = Column(JSON, nullable=False)  # MCP server configuration
    status = Column(String(50), default="disconnected")  # connected, disconnected, error
    last_connected = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AIConfig(Base):
    """AI LLM configuration model."""

    __tablename__ = "ai_configs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    provider = Column(String(100), nullable=False)  # openai, anthropic, custom
    model = Column(String(255), nullable=False)
    api_key_encrypted = Column(Text)  # Encrypted API key
    api_endpoint = Column(String(500))  # Custom endpoint if needed
    parameters = Column(JSON)  # Model parameters (temperature, max_tokens, etc.)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class WidgetBlueprint(Base):
    """Widget blueprint model for Universal Widget System."""

    __tablename__ = "widget_blueprints"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    widget_version = Column(String(10), nullable=False, default="2.0")  # Universal Widget System version
    data_source = Column(JSON, nullable=False)  # Where the widget's data comes from
    data_schema = Column(JSON, nullable=False)  # Structure of the data (field definitions)
    view_schema = Column(JSON, nullable=False)  # How to display the data (display component and mappings)
    settings = Column(JSON, nullable=False)  # Default settings
    widget_metadata = Column(JSON)  # Category, tags, author, version, icon, etc.
    is_public = Column(Boolean, default=False)  # If publicly available in library
    install_count = Column(Integer, default=0)  # Track popularity
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class MCPRegistryServer(Base):
    """MCP Registry Server model for servers from the official MCP Registry."""

    __tablename__ = "mcp_registry_servers"

    id = Column(Integer, primary_key=True, index=True)

    # Core registry fields based on official MCP Registry schema
    registry_id = Column(String(255), nullable=False, unique=True, index=True)  # Unique ID from registry
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text)
    version = Column(String(50))

    # Repository information
    repository_url = Column(String(500))
    homepage_url = Column(String(500))
    documentation_url = Column(String(500))

    # Package/Installation info
    package_name = Column(String(255))  # e.g. npm package name
    package_manager = Column(String(50))  # npm, pip, etc.
    installation_command = Column(Text)

    # Server configuration
    schema_version = Column(String(20))  # MCP schema version
    transport_types = Column(JSON)  # Array of supported transport types
    capabilities = Column(JSON)  # Server capabilities

    # Metadata from registry
    category = Column(String(100))
    tags = Column(JSON)  # Array of tags
    author = Column(String(255))
    license = Column(String(100))

    # Statistics and verification
    download_count = Column(Integer, default=0)
    trust_score = Column(Float, default=0.0)  # Registry trust score
    verification_status = Column(String(50))  # verified, unverified, pending
    is_official = Column(Boolean, default=False)

    # Rich content from registry
    readme_content = Column(Text)
    changelog = Column(Text)
    server_config_schema = Column(JSON)  # JSON schema for server configuration
    example_usage = Column(JSON)  # Example configurations

    # Timestamps
    registry_created_at = Column(DateTime)  # When created in registry
    registry_updated_at = Column(DateTime)  # When last updated in registry
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_synced = Column(DateTime, default=datetime.utcnow)


class WidgetConnection(Base):
    """Widget connection model for linking widgets together."""

    __tablename__ = "widget_connections"

    id = Column(Integer, primary_key=True, index=True)
    source_widget_id = Column(Integer, ForeignKey("widgets.id"), nullable=False)
    target_widget_id = Column(Integer, ForeignKey("widgets.id"), nullable=False)
    connection_type = Column(String(50), default="data_flow")  # data_flow, reference, etc.

    # Configuration for data mapping between widgets
    mapping_config = Column(JSON)  # How to map source data to target
    ai_conversion_prompt = Column(Text)  # Custom AI prompt for data conversion
    is_active = Column(Boolean, default=True)

    # Position for line visualization
    visual_config = Column(JSON)  # Line style, color, curve points, etc.

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    source_widget = relationship("Widget", foreign_keys=[source_widget_id], backref="outgoing_connections")
    target_widget = relationship("Widget", foreign_keys=[target_widget_id], backref="incoming_connections")


class MCPServerDirectory(Base):
    """Legacy MCP Server directory model for storing scraped MCP servers."""

    __tablename__ = "mcp_server_directory"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    github_url = Column(String(500), nullable=False)
    short_description = Column(Text)
    category = Column(String(100))
    tags = Column(JSON)  # Array of tags like ['🐍', '☁️', '🏠']
    programming_language = Column(String(50))  # python, typescript, etc.
    transport_types = Column(JSON)  # Array of supported transport types

    # Detailed information scraped from GitHub
    full_description = Column(Text)
    instructions = Column(Text)
    installation_commands = Column(JSON)  # Array of installation commands
    configuration_example = Column(JSON)  # Example configuration
    required_env_vars = Column(JSON)  # Required environment variables
    optional_env_vars = Column(JSON)  # Optional environment variables
    tools_provided = Column(JSON)  # Array of tools the server provides
    resources_provided = Column(JSON)  # Array of resources the server provides

    # Additional metadata
    stars = Column(Integer, default=0)
    last_updated = Column(DateTime)
    is_official = Column(Boolean, default=False)  # If it's an official implementation
    is_verified = Column(Boolean, default=False)  # If it's been verified to work

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_scraped = Column(DateTime, default=datetime.utcnow)
