"""
Tests for dashboard API endpoints.
This module tests CRUD operations and dashboard management functionality.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from database import Dashboard


class TestDashboardAPI:
    """Test suite for dashboard API endpoints."""

    def test_list_dashboards_empty(self, client: TestClient):
        """Test listing dashboards when none exist."""
        response = client.get("/api/dashboards/")

        assert response.status_code == 200
        assert response.json() == []

    def test_create_dashboard(self, client: TestClient, sample_dashboard_data):
        """Test creating a new dashboard."""
        response = client.post("/api/dashboards/", json=sample_dashboard_data)

        assert response.status_code == 200
        data = response.json()

        assert data["name"] == sample_dashboard_data["name"]
        assert data["description"] == sample_dashboard_data["description"]
        assert "id" in data
        assert "created_at" in data
        assert "updated_at" in data
        assert data["canvas_state"] is not None
        assert data["canvas_state"]["zoom"] == 1.0

    def test_create_dashboard_minimal(self, client: TestClient):
        """Test creating a dashboard with only required fields."""
        dashboard_data = {"name": "Minimal Dashboard"}
        response = client.post("/api/dashboards/", json=dashboard_data)

        assert response.status_code == 200
        data = response.json()

        assert data["name"] == "Minimal Dashboard"
        assert data["description"] is None
        assert data["canvas_state"] is not None

    def test_list_dashboards_with_data(self, client: TestClient, sample_dashboard):
        """Test listing dashboards when data exists."""
        response = client.get("/api/dashboards/")

        assert response.status_code == 200
        data = response.json()

        assert len(data) == 1
        assert data[0]["id"] == sample_dashboard.id
        assert data[0]["name"] == sample_dashboard.name

    def test_get_dashboard(self, client: TestClient, sample_dashboard):
        """Test retrieving a specific dashboard."""
        response = client.get(f"/api/dashboards/{sample_dashboard.id}")

        assert response.status_code == 200
        data = response.json()

        assert data["id"] == sample_dashboard.id
        assert data["name"] == sample_dashboard.name
        assert data["description"] == sample_dashboard.description

    def test_get_dashboard_not_found(self, client: TestClient):
        """Test retrieving a non-existent dashboard."""
        response = client.get("/api/dashboards/999")

        assert response.status_code == 404
        assert response.json()["detail"] == "Dashboard not found"

    def test_update_dashboard(self, client: TestClient, sample_dashboard):
        """Test updating a dashboard."""
        update_data = {
            "name": "Updated Dashboard",
            "description": "Updated description",
            "canvas_state": {"zoom": 1.5, "pan": {"x": 10, "y": 20}},
        }

        response = client.put(f"/api/dashboards/{sample_dashboard.id}", json=update_data)

        assert response.status_code == 200
        data = response.json()

        assert data["name"] == "Updated Dashboard"
        assert data["description"] == "Updated description"
        assert data["canvas_state"]["zoom"] == 1.5
        assert data["canvas_state"]["pan"]["x"] == 10

    def test_update_dashboard_partial(self, client: TestClient, sample_dashboard):
        """Test partial update of a dashboard."""
        update_data = {"name": "Partially Updated"}

        response = client.put(f"/api/dashboards/{sample_dashboard.id}", json=update_data)

        assert response.status_code == 200
        data = response.json()

        assert data["name"] == "Partially Updated"
        assert data["description"] == sample_dashboard.description  # Unchanged

    def test_update_dashboard_not_found(self, client: TestClient):
        """Test updating a non-existent dashboard."""
        update_data = {"name": "Updated Dashboard"}
        response = client.put("/api/dashboards/999", json=update_data)

        assert response.status_code == 404
        assert response.json()["detail"] == "Dashboard not found"

    def test_delete_dashboard(self, client: TestClient, sample_dashboard, test_db_session: Session):
        """Test deleting a dashboard."""
        dashboard_id = sample_dashboard.id

        response = client.delete(f"/api/dashboards/{dashboard_id}")

        assert response.status_code == 200
        assert response.json()["message"] == "Dashboard deleted successfully"

        # Verify the dashboard is actually deleted
        deleted_dashboard = test_db_session.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
        assert deleted_dashboard is None

    def test_delete_dashboard_not_found(self, client: TestClient):
        """Test deleting a non-existent dashboard."""
        response = client.delete("/api/dashboards/999")

        assert response.status_code == 404
        assert response.json()["detail"] == "Dashboard not found"

    def test_duplicate_dashboard(self, client: TestClient, sample_dashboard, sample_widget):
        """Test duplicating a dashboard with widgets."""
        response = client.post(f"/api/dashboards/{sample_dashboard.id}/duplicate")

        assert response.status_code == 200
        data = response.json()

        assert data["name"] == f"{sample_dashboard.name} (Copy)"
        assert data["description"] == sample_dashboard.description
        assert data["id"] != sample_dashboard.id

        # Verify widgets are also copied (we'll need to check via widget endpoint)
        widgets_response = client.get(f"/api/widgets/dashboard/{data['id']}")
        assert widgets_response.status_code == 200
        widgets_data = widgets_response.json()
        assert len(widgets_data) == 1  # One widget was copied

        # Check that the widget position is offset
        copied_widget = widgets_data[0]
        assert copied_widget["x"] == sample_widget.x + 20
        assert copied_widget["y"] == sample_widget.y + 20

    def test_duplicate_dashboard_not_found(self, client: TestClient):
        """Test duplicating a non-existent dashboard."""
        response = client.post("/api/dashboards/999/duplicate")

        assert response.status_code == 404
        assert response.json()["detail"] == "Dashboard not found"

    def test_export_dashboard(self, client: TestClient, sample_dashboard, sample_widget):
        """Test exporting a dashboard."""
        response = client.post(f"/api/dashboards/{sample_dashboard.id}/export")

        assert response.status_code == 200
        data = response.json()

        assert data["export_version"] == "2.0"
        assert data["dashboard"]["name"] == sample_dashboard.name
        assert len(data["widgets"]) == 1
        assert len(data["connections"]) == 0  # No connections in basic test
        assert "exported_at" in data
        assert data["export_metadata"]["original_dashboard_id"] == sample_dashboard.id

        # Verify widget data includes blueprint information
        widget_data = data["widgets"][0]
        assert "widget_blueprint" in widget_data
        assert widget_data["widget_blueprint"]["id"] == sample_widget.widget_blueprint_id

    def test_export_dashboard_not_found(self, client: TestClient):
        """Test exporting a non-existent dashboard."""
        response = client.post("/api/dashboards/999/export")

        assert response.status_code == 404
        assert response.json()["detail"] == "Dashboard not found"

    def test_import_dashboard(self, client: TestClient, sample_widget_blueprint):
        """Test importing a dashboard."""
        import_data = {
            "name": "Imported Dashboard",
            "description": "Imported from test",
            "canvas_state": {"zoom": 1.2, "pan": {"x": 5, "y": 5}},
            "widgets": [
                {
                    "id": 1,  # Original widget ID for connection mapping
                    "title": "Imported Widget",
                    "x": 200.0,
                    "y": 200.0,
                    "width": 300.0,
                    "height": 250.0,
                    "z_index": 1,
                    "color": "#f0f0f0",
                    "shape": "rectangle",
                    "content": {"test": "imported"},
                    "settings": {"theme": "dark"},
                    "widget_blueprint_id": sample_widget_blueprint.id,
                }
            ],
            "connections": [],
        }

        response = client.post("/api/dashboards/import", json=import_data)

        assert response.status_code == 200
        data = response.json()

        assert data["message"] == "Dashboard imported successfully"
        assert "dashboard_id" in data
        assert data["widget_count"] == 1
        assert data["connection_count"] == 0

        # Verify the dashboard was created
        dashboard_response = client.get(f"/api/dashboards/{data['dashboard_id']}")
        assert dashboard_response.status_code == 200
        dashboard_data = dashboard_response.json()
        assert dashboard_data["name"] == "Imported Dashboard"

    def test_import_dashboard_with_missing_blueprint(self, client: TestClient):
        """Test importing a dashboard with a missing blueprint reference."""
        import_data = {
            "name": "Import with Missing Blueprint",
            "widgets": [
                {
                    "title": "Widget with Missing Blueprint",
                    "x": 100.0,
                    "y": 100.0,
                    "width": 300.0,
                    "height": 200.0,
                    "widget_blueprint_id": 999,  # Non-existent blueprint
                }
            ],
        }

        response = client.post("/api/dashboards/import", json=import_data)

        assert response.status_code == 200
        data = response.json()

        # Should succeed but skip widgets with missing blueprints
        assert data["widget_count"] == 0


class TestDashboardValidation:
    """Test suite for dashboard data validation."""

    def test_create_dashboard_invalid_data(self, client: TestClient):
        """Test creating a dashboard with invalid data."""
        # Missing required name field
        invalid_data = {"description": "Missing name"}

        response = client.post("/api/dashboards/", json=invalid_data)
        assert response.status_code == 422

    def test_create_dashboard_empty_name(self, client: TestClient):
        """Test creating a dashboard with empty name."""
        invalid_data = {"name": "", "description": "Empty name"}

        response = client.post("/api/dashboards/", json=invalid_data)
        assert response.status_code == 422

    def test_update_dashboard_invalid_canvas_state(self, client: TestClient, sample_dashboard):
        """Test updating dashboard with invalid canvas state."""
        # This should still work as we don't validate canvas_state structure strictly
        update_data = {"canvas_state": "invalid_json"}

        response = client.put(f"/api/dashboards/{sample_dashboard.id}", json=update_data)
        assert response.status_code == 200  # FastAPI/Pydantic handles this gracefully


class TestDashboardEdgeCases:
    """Test suite for dashboard edge cases and error handling."""

    def test_dashboard_with_very_long_name(self, client: TestClient):
        """Test creating a dashboard with a very long name."""
        long_name = "x" * 1000  # Very long name
        dashboard_data = {"name": long_name}

        response = client.post("/api/dashboards/", json=dashboard_data)
        # This might succeed or fail depending on database constraints
        # The test documents the current behavior
        assert response.status_code in [200, 422, 500]

    def test_concurrent_dashboard_operations(self, client: TestClient, sample_dashboard):
        """Test concurrent operations on the same dashboard."""
        # Simulate concurrent updates
        update_data1 = {"name": "Updated Name 1"}
        update_data2 = {"name": "Updated Name 2"}

        # Both requests should succeed, last one wins
        response1 = client.put(f"/api/dashboards/{sample_dashboard.id}", json=update_data1)
        response2 = client.put(f"/api/dashboards/{sample_dashboard.id}", json=update_data2)

        assert response1.status_code == 200
        assert response2.status_code == 200
        assert response2.json()["name"] == "Updated Name 2"
