"""
Integration tests for Canvas MCP Client backend.
This module tests end-to-end scenarios and integration between components.
"""

from unittest.mock import AsyncMock, Mock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from database import Dashboard, Widget, WidgetBlueprint


class TestDashboardWidgetIntegration:
    """Test suite for dashboard and widget integration."""

    def test_complete_dashboard_workflow(self, client: TestClient, sample_widget_blueprint):
        """Test complete dashboard creation, widget addition, and cleanup workflow."""
        # Step 1: Create a dashboard
        dashboard_data = {"name": "Integration Test Dashboard", "description": "A dashboard for integration testing"}

        dashboard_response = client.post("/api/dashboards/", json=dashboard_data)
        assert dashboard_response.status_code == 200
        dashboard = dashboard_response.json()
        dashboard_id = dashboard["id"]

        # Step 2: Add widgets to the dashboard
        widget_data_1 = {
            "dashboard_id": dashboard_id,
            "widget_blueprint_id": sample_widget_blueprint.id,
            "title": "Integration Widget 1",
            "x": 100.0,
            "y": 100.0,
            "width": 400.0,
            "height": 300.0,
        }

        widget_data_2 = {
            "dashboard_id": dashboard_id,
            "widget_blueprint_id": sample_widget_blueprint.id,
            "title": "Integration Widget 2",
            "x": 600.0,
            "y": 100.0,
            "width": 400.0,
            "height": 300.0,
        }

        widget1_response = client.post("/api/widgets/", json=widget_data_1)
        assert widget1_response.status_code == 200
        widget1 = widget1_response.json()

        widget2_response = client.post("/api/widgets/", json=widget_data_2)
        assert widget2_response.status_code == 200
        widget2 = widget2_response.json()

        # Step 3: Verify widgets are listed for the dashboard
        widgets_response = client.get(f"/api/widgets/dashboard/{dashboard_id}")
        assert widgets_response.status_code == 200
        widgets = widgets_response.json()

        assert len(widgets) == 2
        widget_titles = [w["title"] for w in widgets]
        assert "Integration Widget 1" in widget_titles
        assert "Integration Widget 2" in widget_titles

        # Step 4: Create a connection between widgets
        connection_data = {
            "source_widget_id": widget1["id"],
            "target_widget_id": widget2["id"],
            "connection_type": "data_flow",
            "mapping_config": {"field": "output"},
            "is_active": True,
        }

        connection_response = client.post("/api/widget-connections/", json=connection_data)
        assert connection_response.status_code == 200
        connection = connection_response.json()

        # Step 5: Export the complete dashboard
        export_response = client.post(f"/api/dashboards/{dashboard_id}/export")
        assert export_response.status_code == 200
        export_data = export_response.json()

        assert export_data["export_version"] == "2.0"
        assert len(export_data["widgets"]) == 2
        assert len(export_data["connections"]) == 1

        # Step 6: Delete a widget and verify connection is handled
        delete_widget_response = client.delete(f"/api/widgets/{widget1['id']}")
        assert delete_widget_response.status_code == 200
        assert delete_widget_response.json()["deleted_connections"] == 1

        # Step 7: Verify dashboard still exists with remaining widget
        final_widgets_response = client.get(f"/api/widgets/dashboard/{dashboard_id}")
        assert final_widgets_response.status_code == 200
        final_widgets = final_widgets_response.json()
        assert len(final_widgets) == 1
        assert final_widgets[0]["title"] == "Integration Widget 2"

        # Step 8: Clean up - delete dashboard
        delete_dashboard_response = client.delete(f"/api/dashboards/{dashboard_id}")
        assert delete_dashboard_response.status_code == 200

    def test_dashboard_duplication_with_connections(self, client: TestClient, sample_widget_blueprint):
        """Test duplicating a dashboard with widgets and connections."""
        # Create original dashboard with widgets and connections
        dashboard_response = client.post(
            "/api/dashboards/", json={"name": "Original Dashboard", "description": "Dashboard to be duplicated"}
        )
        dashboard = dashboard_response.json()

        # Add two widgets
        widget1_response = client.post(
            "/api/widgets/",
            json={
                "dashboard_id": dashboard["id"],
                "widget_blueprint_id": sample_widget_blueprint.id,
                "title": "Source Widget",
                "x": 100.0,
                "y": 100.0,
                "width": 300.0,
                "height": 200.0,
            },
        )
        widget1 = widget1_response.json()

        widget2_response = client.post(
            "/api/widgets/",
            json={
                "dashboard_id": dashboard["id"],
                "widget_blueprint_id": sample_widget_blueprint.id,
                "title": "Target Widget",
                "x": 500.0,
                "y": 100.0,
                "width": 300.0,
                "height": 200.0,
            },
        )
        widget2 = widget2_response.json()

        # Create connection
        client.post(
            "/api/widget-connections/",
            json={"source_widget_id": widget1["id"], "target_widget_id": widget2["id"], "connection_type": "data_flow"},
        )

        # Duplicate the dashboard
        duplicate_response = client.post(f"/api/dashboards/{dashboard['id']}/duplicate")
        assert duplicate_response.status_code == 200
        duplicate_dashboard = duplicate_response.json()

        # Verify duplicate has widgets
        duplicate_widgets_response = client.get(f"/api/widgets/dashboard/{duplicate_dashboard['id']}")
        duplicate_widgets = duplicate_widgets_response.json()

        assert len(duplicate_widgets) == 2
        # Widgets should have offset positions
        for widget in duplicate_widgets:
            if widget["title"] == "Source Widget":
                assert widget["x"] == 120.0  # Original x + 20
                assert widget["y"] == 120.0  # Original y + 20

    def test_import_export_roundtrip(self, client: TestClient, sample_widget_blueprint):
        """Test exporting a dashboard and importing it back."""
        # Create dashboard with widgets
        dashboard_response = client.post(
            "/api/dashboards/",
            json={
                "name": "Export Test Dashboard",
                "description": "Dashboard for export/import testing",
                "canvas_state": {"zoom": 1.5, "pan": {"x": 10, "y": 20}},
            },
        )
        dashboard = dashboard_response.json()

        # Add widget
        widget_response = client.post(
            "/api/widgets/",
            json={
                "dashboard_id": dashboard["id"],
                "widget_blueprint_id": sample_widget_blueprint.id,
                "title": "Export Test Widget",
                "x": 150.0,
                "y": 200.0,
                "width": 350.0,
                "height": 250.0,
                "content": {"test": "export_data"},
                "settings": {"theme": "export_theme"},
            },
        )
        widget = widget_response.json()

        # Export the dashboard
        export_response = client.post(f"/api/dashboards/{dashboard['id']}/export")
        export_data = export_response.json()

        # Import the dashboard
        import_data = {
            "name": "Imported " + export_data["dashboard"]["name"],
            "description": export_data["dashboard"]["description"],
            "canvas_state": export_data["dashboard"]["canvas_state"],
            "widgets": export_data["widgets"],
            "connections": export_data["connections"],
        }

        import_response = client.post("/api/dashboards/import", json=import_data)
        assert import_response.status_code == 200
        import_result = import_response.json()

        # Verify imported dashboard
        imported_dashboard_response = client.get(f"/api/dashboards/{import_result['dashboard_id']}")
        imported_dashboard = imported_dashboard_response.json()

        assert imported_dashboard["name"] == "Imported Export Test Dashboard"
        assert imported_dashboard["canvas_state"]["zoom"] == 1.5

        # Verify imported widgets
        imported_widgets_response = client.get(f"/api/widgets/dashboard/{import_result['dashboard_id']}")
        imported_widgets = imported_widgets_response.json()

        assert len(imported_widgets) == 1
        imported_widget = imported_widgets[0]
        assert imported_widget["title"] == "Export Test Widget"
        assert imported_widget["x"] == 150.0
        assert imported_widget["content"]["test"] == "export_data"
        assert imported_widget["settings"]["theme"] == "export_theme"


class TestMCPIntegration:
    """Test suite for MCP server integration."""

    @pytest.mark.asyncio
    async def test_mcp_server_lifecycle(self, client: TestClient, mock_mcp_service):
        """Test complete MCP server lifecycle: add, connect, use, remove."""
        # Mock the MCP service
        with patch("main.mcp_service", mock_mcp_service):
            # Step 1: Add MCP server
            server_data = {
                "name": "integration-test-server",
                "transport": "http",
                "config": {"url": "http://localhost:8080", "timeout": 30},
            }

            add_response = client.post("/api/mcp-servers/", json=server_data)
            assert add_response.status_code == 200
            server = add_response.json()

            # Step 2: List servers and verify it's included
            list_response = client.get("/api/mcp-servers/")
            assert list_response.status_code == 200
            servers = list_response.json()

            server_names = [s["name"] for s in servers]
            assert "integration-test-server" in server_names

            # Step 3: Get server status
            status_response = client.get("/api/mcp-servers/status")
            assert status_response.status_code == 200
            status_list = status_response.json()

            # Find our server in the status
            our_server_status = next((s for s in status_list if s["name"] == "integration-test-server"), None)
            assert our_server_status is not None
            assert our_server_status["status"] == "connected"

            # Step 4: Test server configuration
            test_response = client.post(
                "/api/mcp-servers/test", json={"transport": "http", "config": {"url": "http://localhost:8080"}}
            )
            assert test_response.status_code == 200
            test_result = test_response.json()
            assert test_result["status"] == "success"

            # Step 5: Remove server
            delete_response = client.delete(f"/api/mcp-servers/{server['id']}")
            assert delete_response.status_code == 200

            # Step 6: Verify server is removed
            final_list_response = client.get("/api/mcp-servers/")
            final_servers = final_list_response.json()
            final_server_names = [s["name"] for s in final_servers]
            assert "integration-test-server" not in final_server_names


class TestErrorHandlingIntegration:
    """Test suite for error handling across components."""

    def test_cascade_error_handling(self, client: TestClient):
        """Test error handling when operations depend on each other."""
        # Try to create widget without dashboard
        widget_data = {
            "dashboard_id": 999,  # Non-existent dashboard
            "widget_blueprint_id": 1,  # Assume exists
            "x": 100.0,
            "y": 100.0,
            "width": 300.0,
            "height": 200.0,
        }

        # This should fail gracefully, not crash the server
        widget_response = client.post("/api/widgets/", json=widget_data)
        # Depending on implementation, this might be 422 (validation error) or 500
        assert widget_response.status_code in [422, 500]

        # Server should still be responsive
        health_response = client.get("/health")
        assert health_response.status_code == 200

    def test_malformed_data_handling(self, client: TestClient, sample_dashboard):
        """Test handling of malformed data across different endpoints."""
        # Test malformed JSON in widget content
        widget_data = {
            "dashboard_id": sample_dashboard.id,
            "widget_blueprint_id": 1,  # Assume exists
            "x": 100.0,
            "y": 100.0,
            "width": 300.0,
            "height": 200.0,
            "content": {"malformed": float("inf")},  # Invalid JSON value
        }

        # FastAPI should handle this gracefully
        widget_response = client.post("/api/widgets/", json=widget_data)
        # Response should be 422 for validation error, not 500 for server error
        assert widget_response.status_code == 422

    def test_concurrent_operations_safety(self, client: TestClient, sample_dashboard, sample_widget_blueprint):
        """Test that concurrent operations don't cause data corruption."""
        import threading
        import time

        results = []
        errors = []

        def create_widget(thread_id):
            try:
                widget_data = {
                    "dashboard_id": sample_dashboard.id,
                    "widget_blueprint_id": sample_widget_blueprint.id,
                    "title": f"Concurrent Widget {thread_id}",
                    "x": 100.0 + thread_id * 50,
                    "y": 100.0,
                    "width": 300.0,
                    "height": 200.0,
                }

                response = client.post("/api/widgets/", json=widget_data)
                results.append(response.json() if response.status_code == 200 else None)
            except Exception as e:
                errors.append(str(e))

        # Create multiple threads to simulate concurrent requests
        threads = []
        for i in range(5):
            thread = threading.Thread(target=create_widget, args=(i,))
            threads.append(thread)

        # Start all threads
        for thread in threads:
            thread.start()

        # Wait for all threads to complete
        for thread in threads:
            thread.join()

        # Check results
        assert len(errors) == 0, f"Concurrent operations caused errors: {errors}"
        successful_results = [r for r in results if r is not None]
        assert len(successful_results) == 5, "Not all concurrent operations succeeded"

        # Verify all widgets were created with unique IDs
        widget_ids = [r["id"] for r in successful_results]
        assert len(set(widget_ids)) == 5, "Duplicate widget IDs created"


class TestApplicationHealthIntegration:
    """Test suite for overall application health and monitoring."""

    def test_health_endpoint(self, client: TestClient):
        """Test application health endpoint."""
        response = client.get("/health")

        assert response.status_code == 200
        assert response.json() == {"status": "healthy"}

    def test_root_endpoint(self, client: TestClient):
        """Test root API endpoint."""
        response = client.get("/")

        assert response.status_code == 200
        data = response.json()

        assert data["message"] == "Canvas MCP Client API"
        assert data["version"] == "1.0.0"
        assert data["docs"] == "/docs"

    def test_api_documentation_accessible(self, client: TestClient):
        """Test that API documentation is accessible."""
        # Test OpenAPI schema endpoint
        schema_response = client.get("/openapi.json")
        assert schema_response.status_code == 200

        schema_data = schema_response.json()
        assert schema_data["info"]["title"] == "Canvas MCP Client API"
        assert schema_data["info"]["version"] == "1.0.0"

        # Verify key endpoints are documented
        paths = schema_data["paths"]
        assert "/api/dashboards/" in paths
        assert "/api/widgets/" in paths
        assert "/api/mcp-servers/" in paths

    def test_cors_headers(self, client: TestClient):
        """Test CORS headers are properly set."""
        # Test preflight request
        response = client.options(
            "/api/dashboards/",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type",
            },
        )

        # Should allow the request
        assert response.status_code in [200, 204]

        # Test actual request with CORS
        response = client.get("/api/dashboards/", headers={"Origin": "http://localhost:3000"})

        assert response.status_code == 200
        # Check for CORS headers (these might not be visible in TestClient responses)
        # This test mainly ensures CORS doesn't block the request

    def test_error_response_format(self, client: TestClient):
        """Test that error responses follow consistent format."""
        # Test 404 error
        response = client.get("/api/dashboards/999")

        assert response.status_code == 404
        error_data = response.json()

        assert "detail" in error_data
        assert error_data["detail"] == "Dashboard not found"

        # Test 422 validation error
        invalid_data = {"invalid": "data"}
        response = client.post("/api/dashboards/", json=invalid_data)

        assert response.status_code == 422
        error_data = response.json()

        assert "detail" in error_data
        # Pydantic validation errors have specific format
        assert isinstance(error_data["detail"], list)


class TestPerformanceIntegration:
    """Test suite for performance-related integration scenarios."""

    def test_large_dashboard_handling(self, client: TestClient, sample_widget_blueprint):
        """Test handling of dashboards with many widgets."""
        # Create dashboard
        dashboard_response = client.post(
            "/api/dashboards/", json={"name": "Large Dashboard Test", "description": "Testing with many widgets"}
        )
        dashboard = dashboard_response.json()

        # Add multiple widgets (simulate a dashboard with many widgets)
        widget_ids = []
        for i in range(10):  # Create 10 widgets
            widget_data = {
                "dashboard_id": dashboard["id"],
                "widget_blueprint_id": sample_widget_blueprint.id,
                "title": f"Widget {i}",
                "x": (i % 5) * 200.0,
                "y": (i // 5) * 200.0,
                "width": 180.0,
                "height": 150.0,
            }

            widget_response = client.post("/api/widgets/", json=widget_data)
            assert widget_response.status_code == 200
            widget_ids.append(widget_response.json()["id"])

        # Test listing all widgets (should handle large result sets)
        widgets_response = client.get(f"/api/widgets/dashboard/{dashboard['id']}")
        assert widgets_response.status_code == 200
        widgets = widgets_response.json()

        assert len(widgets) == 10

        # Test export performance with many widgets
        export_response = client.post(f"/api/dashboards/{dashboard['id']}/export")
        assert export_response.status_code == 200
        export_data = export_response.json()

        assert len(export_data["widgets"]) == 10
        assert "exported_at" in export_data

        # Cleanup
        client.delete(f"/api/dashboards/{dashboard['id']}")

    def test_complex_widget_data_handling(self, client: TestClient, sample_dashboard, sample_widget_blueprint):
        """Test handling of widgets with complex content and settings."""
        # Create widget with complex JSON data
        complex_content = {
            "data": [{"id": i, "name": f"Item {i}", "nested": {"value": i * 2}} for i in range(100)],
            "metadata": {
                "total": 100,
                "generated_at": "2024-01-01T00:00:00Z",
                "config": {"deep": {"nesting": {"works": True, "levels": ["1", "2", "3", "4", "5"]}}},
            },
        }

        complex_settings = {
            "display": {
                "columns": ["id", "name", "nested.value"],
                "sorting": {"field": "id", "direction": "asc"},
                "filtering": {"enabled": True, "filters": [{"field": "id", "operator": ">=", "value": 50}]},
            },
            "behavior": {
                "autoRefresh": True,
                "refreshInterval": 30,
                "animations": {"enabled": True, "duration": 300, "easing": "ease-in-out"},
            },
        }

        widget_data = {
            "dashboard_id": sample_dashboard.id,
            "widget_blueprint_id": sample_widget_blueprint.id,
            "title": "Complex Data Widget",
            "x": 100.0,
            "y": 100.0,
            "width": 600.0,
            "height": 400.0,
            "content": complex_content,
            "settings": complex_settings,
        }

        # Create widget
        widget_response = client.post("/api/widgets/", json=widget_data)
        assert widget_response.status_code == 200
        widget = widget_response.json()

        # Verify complex data is preserved
        assert len(widget["content"]["data"]) == 100
        assert widget["content"]["metadata"]["total"] == 100
        assert widget["settings"]["display"]["columns"] == ["id", "name", "nested.value"]
        assert widget["settings"]["behavior"]["animations"]["duration"] == 300

        # Test retrieval
        get_response = client.get(f"/api/widgets/{widget['id']}")
        assert get_response.status_code == 200
        retrieved_widget = get_response.json()

        # Data should be identical
        assert retrieved_widget["content"] == complex_content
        assert retrieved_widget["settings"] == complex_settings
