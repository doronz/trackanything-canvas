"""
Test configuration and fixtures for Canvas MCP Client backend tests.
This file provides shared test fixtures and setup for pytest.
"""

import os
import tempfile
from typing import Any, Dict, Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import AIConfig, Base, Dashboard, MCPServer, Widget, WidgetBlueprint, get_db
from main import app
from services.mcp_service import MCPService


@pytest.fixture(scope="session")
def test_engine():
    """Create a test database engine using SQLite in memory."""
    # Use a temporary file for tests to avoid conflicts
    with tempfile.NamedTemporaryFile(delete=False, suffix=".db") as tmp_file:
        test_db_path = tmp_file.name

    # Create engine with test database
    engine = create_engine(f"sqlite:///{test_db_path}", connect_args={"check_same_thread": False})

    # Create all tables
    Base.metadata.create_all(bind=engine)

    yield engine

    # Cleanup
    engine.dispose()
    if os.path.exists(test_db_path):
        os.unlink(test_db_path)


@pytest.fixture
def test_db_session(test_engine):
    """Create a test database session."""
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    session = TestingSessionLocal()

    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture
def client(test_db_session):
    """Create a test client with dependency overrides."""

    def override_get_db():
        try:
            yield test_db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture
def mock_mcp_service():
    """Create a mock MCP service for testing."""

    class MockMCPService:
        def __init__(self):
            self.clients = {}
            self.server_configs = {}
            self.connection_status = {}

        async def add_server(self, name: str, transport: str, config: Dict[str, Any]):
            self.server_configs[name] = {"transport": transport, "config": config}
            self.connection_status[name] = "connected"

        async def remove_server(self, name: str):
            self.server_configs.pop(name, None)
            self.connection_status.pop(name, None)

        async def get_all_servers_status(self):
            return [
                {
                    "name": name,
                    "status": self.connection_status.get(name, "disconnected"),
                    "tools": [{"name": "test_tool", "description": "Test tool"}],
                    "resources": [{"uri": "test://resource", "name": "Test Resource", "description": "Test"}],
                    "error": None,
                }
                for name in self.server_configs.keys()
            ]

        async def call_tool(self, server_name: str, tool_name: str, parameters: Dict[str, Any]):
            return {"result": "mock_tool_result", "parameters": parameters}

        async def test_server_config(self, transport: str, config: Dict[str, Any]):
            return {"status": "success", "message": "Mock connection test successful"}

    return MockMCPService()


# Test data fixtures


@pytest.fixture
def sample_dashboard_data():
    """Sample dashboard data for testing."""
    return {"name": "Test Dashboard", "description": "A test dashboard for unit tests"}


@pytest.fixture
def sample_widget_blueprint(test_db_session) -> WidgetBlueprint:
    """Create a sample widget blueprint for testing."""
    blueprint = WidgetBlueprint(
        name="Test Widget Blueprint",
        description="A test widget blueprint",
        widget_version="2.0",
        data_source={"type": "userInput"},
        data_schema={
            "fields": [
                {"name": "title", "type": "string", "required": True},
                {"name": "content", "type": "string", "required": False},
            ]
        },
        view_schema={"displayComponent": "Table", "mappings": {"title": "title", "content": "content"}},
        settings={"defaultWidth": 400, "defaultHeight": 300},
        widget_metadata={"category": "test", "tags": ["test", "sample"], "icon": "test-icon"},
        is_public=True,
    )

    test_db_session.add(blueprint)
    test_db_session.commit()
    test_db_session.refresh(blueprint)

    return blueprint


@pytest.fixture
def sample_dashboard(test_db_session) -> Dashboard:
    """Create a sample dashboard for testing."""
    dashboard = Dashboard(
        name="Test Dashboard",
        description="A test dashboard",
        canvas_state={"zoom": 1.0, "pan": {"x": 0, "y": 0}, "viewport": {"width": 1920, "height": 1080}},
    )

    test_db_session.add(dashboard)
    test_db_session.commit()
    test_db_session.refresh(dashboard)

    return dashboard


@pytest.fixture
def sample_widget(test_db_session, sample_dashboard, sample_widget_blueprint) -> Widget:
    """Create a sample widget for testing."""
    widget = Widget(
        dashboard_id=sample_dashboard.id,
        widget_blueprint_id=sample_widget_blueprint.id,
        title="Test Widget",
        x=100.0,
        y=100.0,
        width=400.0,
        height=300.0,
        z_index=1,
        color="#ffffff",
        shape="rectangle",
        content={"title": "Test Content", "content": "This is a test widget"},
        settings={"theme": "light"},
    )

    test_db_session.add(widget)
    test_db_session.commit()
    test_db_session.refresh(widget)

    return widget


@pytest.fixture
def sample_mcp_server(test_db_session) -> MCPServer:
    """Create a sample MCP server for testing."""
    server = MCPServer(
        name="test-server", transport="http", config={"url": "http://localhost:8080", "timeout": 30}, status="connected"
    )

    test_db_session.add(server)
    test_db_session.commit()
    test_db_session.refresh(server)

    return server


@pytest.fixture
def sample_ai_config(test_db_session) -> AIConfig:
    """Create a sample AI config for testing."""
    config = AIConfig(
        name="Test AI Config",
        provider="openai",
        model="gpt-3.5-turbo",
        api_key_encrypted="encrypted_test_key",
        parameters={"temperature": 0.7, "max_tokens": 1000},
        is_default=True,
    )

    test_db_session.add(config)
    test_db_session.commit()
    test_db_session.refresh(config)

    return config


# Test utilities


@pytest.fixture
def auth_headers():
    """Mock authentication headers for API tests."""
    return {"Authorization": "Bearer test_token"}


class TestDataFactory:
    """Factory class for creating test data."""

    @staticmethod
    def create_dashboard_data(**kwargs):
        """Create dashboard test data with optional overrides."""
        default_data = {"name": "Test Dashboard", "description": "Test dashboard description"}
        default_data.update(kwargs)
        return default_data

    @staticmethod
    def create_widget_data(dashboard_id: int, blueprint_id: int, **kwargs):
        """Create widget test data with optional overrides."""
        default_data = {
            "dashboard_id": dashboard_id,
            "widget_blueprint_id": blueprint_id,
            "title": "Test Widget",
            "x": 100.0,
            "y": 100.0,
            "width": 400.0,
            "height": 300.0,
            "color": "#ffffff",
            "shape": "rectangle",
            "content": {"test": "data"},
            "settings": {"theme": "light"},
        }
        default_data.update(kwargs)
        return default_data

    @staticmethod
    def create_mcp_server_data(**kwargs):
        """Create MCP server test data with optional overrides."""
        default_data = {
            "name": "test-server",
            "transport": "http",
            "config": {"url": "http://localhost:8080", "timeout": 30},
        }
        default_data.update(kwargs)
        return default_data


@pytest.fixture
def test_data_factory():
    """Provide the test data factory."""
    return TestDataFactory


# Cleanup fixtures


@pytest.fixture(autouse=True)
def clean_test_data(test_db_session):
    """Automatically clean test data after each test."""
    yield

    # Clean up test data
    try:
        test_db_session.query(Widget).delete()
        test_db_session.query(Dashboard).delete()
        test_db_session.query(WidgetBlueprint).delete()
        test_db_session.query(MCPServer).delete()
        test_db_session.query(AIConfig).delete()
        test_db_session.commit()
    except Exception:
        test_db_session.rollback()
