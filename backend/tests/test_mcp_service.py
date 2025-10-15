"""
Tests for MCP service functionality.
This module tests the MCP service for managing MCP server connections.
"""

import asyncio
from typing import Any, Dict
from unittest.mock import AsyncMock, Mock, patch

import pytest

from services.mcp_service import MCPService


class TestMCPService:
    """Test suite for MCP service functionality."""

    @pytest.fixture
    def mcp_service(self):
        """Create a fresh MCP service instance for each test."""
        return MCPService()

    @pytest.mark.asyncio
    async def test_add_server_http(self, mcp_service):
        """Test adding an HTTP MCP server."""
        server_config = {"url": "http://localhost:8080", "timeout": 30}

        with patch("services.mcp_service.Client") as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value = mock_client
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client.list_tools = AsyncMock(return_value=[])

            await mcp_service.add_server("test-http-server", "http", server_config)

            assert "test-http-server" in mcp_service.clients
            assert "test-http-server" in mcp_service.server_configs
            assert mcp_service.connection_status["test-http-server"] == "connected"

            # Verify client was created with correct URL
            mock_client_class.assert_called_once_with("http://localhost:8080", auth=None)

    @pytest.mark.asyncio
    async def test_add_server_http_with_oauth(self, mcp_service):
        """Test adding an HTTP MCP server with OAuth authentication."""
        server_config = {
            "url": "http://localhost:8080",
            "oauth": True,
            "oauth_config": {"scopes": ["read", "write"], "client_name": "Test Client", "callback_port": 8081},
        }

        with (
            patch("services.mcp_service.Client") as mock_client_class,
            patch("services.mcp_service.OAuth") as mock_oauth_class,
        ):

            mock_oauth = Mock()
            mock_oauth_class.return_value = mock_oauth

            mock_client = AsyncMock()
            mock_client_class.return_value = mock_client
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client.list_tools = AsyncMock(return_value=[])

            await mcp_service.add_server("test-oauth-server", "http", server_config)

            # Verify OAuth configuration was created
            mock_oauth_class.assert_called_once_with(
                mcp_url="http://localhost:8080", scopes=["read", "write"], client_name="Test Client", callback_port=8081
            )

            # Verify client was created with OAuth auth
            mock_client_class.assert_called_once_with("http://localhost:8080", auth=mock_oauth)

    @pytest.mark.asyncio
    async def test_add_server_stdio(self, mcp_service):
        """Test adding a stdio MCP server."""
        server_config = {"command": "python", "args": ["-m", "my_mcp_server"]}

        with patch("services.mcp_service.Client") as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value = mock_client
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client.list_tools = AsyncMock(return_value=[])

            await mcp_service.add_server("test-stdio-server", "stdio", server_config)

            assert "test-stdio-server" in mcp_service.clients
            assert mcp_service.connection_status["test-stdio-server"] == "connected"

            # Verify client was created with stdio config
            expected_config = {"mcpServers": {"test-stdio-server": server_config}}
            mock_client_class.assert_called_once_with(expected_config)

    @pytest.mark.asyncio
    async def test_add_server_unsupported_transport(self, mcp_service):
        """Test adding a server with unsupported transport type."""
        server_config = {"some": "config"}

        with pytest.raises(ValueError, match="Unsupported transport type: unsupported"):
            await mcp_service.add_server("test-server", "unsupported", server_config)

    @pytest.mark.asyncio
    async def test_add_server_connection_failure(self, mcp_service):
        """Test adding a server that fails to connect."""
        server_config = {"url": "http://localhost:8080"}

        with patch("services.mcp_service.Client") as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value = mock_client
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            # Simulate connection failure
            mock_client.list_tools = AsyncMock(side_effect=Exception("Connection failed"))

            with pytest.raises(Exception, match="Connection failed"):
                await mcp_service.add_server("test-server", "http", server_config)

            assert mcp_service.connection_status["test-server"] == "error"

    @pytest.mark.asyncio
    async def test_remove_server(self, mcp_service):
        """Test removing an MCP server."""
        # First add a server
        server_config = {"url": "http://localhost:8080"}

        with patch("services.mcp_service.Client") as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value = mock_client
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client.list_tools = AsyncMock(return_value=[])

            await mcp_service.add_server("test-server", "http", server_config)

            # Verify server was added
            assert "test-server" in mcp_service.clients

            # Remove the server
            await mcp_service.remove_server("test-server")

            # Verify server was removed
            assert "test-server" not in mcp_service.clients
            assert "test-server" not in mcp_service.server_configs
            assert "test-server" not in mcp_service.connection_status

    @pytest.mark.asyncio
    async def test_connect_server(self, mcp_service):
        """Test connecting to a configured server."""
        # Add server without connecting
        server_config = {"url": "http://localhost:8080"}
        mcp_service.server_configs["test-server"] = {"transport": "http", "config": server_config}

        with patch("services.mcp_service.Client") as mock_client_class:
            mock_client = AsyncMock()
            mcp_service.clients["test-server"] = mock_client
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client.list_tools = AsyncMock(return_value=[])

            await mcp_service.connect_server("test-server")

            assert mcp_service.connection_status["test-server"] == "connected"

    @pytest.mark.asyncio
    async def test_connect_server_not_configured(self, mcp_service):
        """Test connecting to a non-configured server."""
        with pytest.raises(ValueError, match="Server test-server not configured"):
            await mcp_service.connect_server("test-server")

    @pytest.mark.asyncio
    async def test_disconnect_server(self, mcp_service):
        """Test disconnecting from a server."""
        # Add a connected server
        mcp_service.clients["test-server"] = AsyncMock()
        mcp_service.connection_status["test-server"] = "connected"

        await mcp_service.disconnect_server("test-server")

        assert mcp_service.connection_status["test-server"] == "disconnected"

    @pytest.mark.asyncio
    async def test_get_all_servers_status(self, mcp_service):
        """Test getting status of all servers."""
        # Add a mock server
        mock_client = AsyncMock()
        mcp_service.clients["test-server"] = mock_client
        mcp_service.connection_status["test-server"] = "connected"

        # Mock tools and resources
        mock_tool = Mock()
        mock_tool.name = "test_tool"
        mock_tool.description = "A test tool"

        mock_resource = Mock()
        mock_resource.uri = "test://resource"
        mock_resource.name = "Test Resource"
        mock_resource.description = "A test resource"

        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.list_tools = AsyncMock(return_value=[mock_tool])
        mock_client.list_resources = AsyncMock(return_value=[mock_resource])

        status_list = await mcp_service.get_all_servers_status()

        assert len(status_list) == 1
        server_status = status_list[0]

        assert server_status["name"] == "test-server"
        assert server_status["status"] == "connected"
        assert len(server_status["tools"]) == 1
        assert server_status["tools"][0]["name"] == "test_tool"
        assert len(server_status["resources"]) == 1
        assert server_status["resources"][0]["uri"] == "test://resource"
        assert server_status["error"] is None

    @pytest.mark.asyncio
    async def test_get_all_servers_status_method_not_found(self, mcp_service):
        """Test getting status when server doesn't support certain methods."""
        # Add a mock server
        mock_client = AsyncMock()
        mcp_service.clients["test-server"] = mock_client
        mcp_service.connection_status["test-server"] = "connected"

        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        # Simulate "Method not found" errors
        mock_client.list_tools = AsyncMock(side_effect=Exception("Method not found"))
        mock_client.list_resources = AsyncMock(side_effect=Exception("Method not found"))

        status_list = await mcp_service.get_all_servers_status()

        assert len(status_list) == 1
        server_status = status_list[0]

        assert server_status["name"] == "test-server"
        assert server_status["status"] == "connected"  # Should remain connected
        assert server_status["tools"] == []
        assert server_status["resources"] == []

    @pytest.mark.asyncio
    async def test_call_tool(self, mcp_service):
        """Test calling a tool on an MCP server."""
        # Add a mock server
        mock_client = AsyncMock()
        mcp_service.clients["test-server"] = mock_client

        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.call_tool = AsyncMock(return_value={"result": "success"})

        parameters = {"param1": "value1", "param2": "value2"}
        result = await mcp_service.call_tool("test-server", "test_tool", parameters)

        assert result == {"result": "success"}
        mock_client.call_tool.assert_called_once_with("test_tool", parameters)

    @pytest.mark.asyncio
    async def test_call_tool_server_not_configured(self, mcp_service):
        """Test calling a tool on a non-configured server."""
        with pytest.raises(ValueError, match="Server test-server not configured"):
            await mcp_service.call_tool("test-server", "test_tool", {})

    @pytest.mark.asyncio
    async def test_call_tool_failure(self, mcp_service):
        """Test calling a tool that fails."""
        # Add a mock server
        mock_client = AsyncMock()
        mcp_service.clients["test-server"] = mock_client

        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.call_tool = AsyncMock(side_effect=Exception("Tool call failed"))

        with pytest.raises(Exception, match="Tool call failed"):
            await mcp_service.call_tool("test-server", "test_tool", {})

        assert mcp_service.connection_status["test-server"] == "error"

    @pytest.mark.asyncio
    async def test_list_resources(self, mcp_service):
        """Test listing resources from an MCP server."""
        # Add a mock server
        mock_client = AsyncMock()
        mcp_service.clients["test-server"] = mock_client

        mock_resource = Mock()
        mock_resource.uri = "test://resource"
        mock_resource.name = "Test Resource"
        mock_resource.description = "A test resource"
        mock_resource.mimeType = "text/plain"

        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.list_resources = AsyncMock(return_value=[mock_resource])

        resources = await mcp_service.list_resources("test-server")

        assert len(resources) == 1
        resource = resources[0]
        assert resource["uri"] == "test://resource"
        assert resource["name"] == "Test Resource"
        assert resource["description"] == "A test resource"
        assert resource["mimeType"] == "text/plain"

    @pytest.mark.asyncio
    async def test_read_resource(self, mcp_service):
        """Test reading a resource from an MCP server."""
        # Add a mock server
        mock_client = AsyncMock()
        mcp_service.clients["test-server"] = mock_client

        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)
        mock_client.read_resource = AsyncMock(return_value="Resource content")

        content = await mcp_service.read_resource("test-server", "test://resource")

        assert content == "Resource content"
        mock_client.read_resource.assert_called_once_with("test://resource")

    @pytest.mark.asyncio
    async def test_call_tool_with_multi_server_config(self, mcp_service):
        """Test calling a tool with multi-server configuration."""
        multi_server_config = {
            "mcpServers": {
                "server1": {"command": "python", "args": ["-m", "server1"]},
                "server2": {"command": "python", "args": ["-m", "server2"]},
            }
        }

        with patch("services.mcp_service.Client") as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value = mock_client
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client.call_tool = AsyncMock(return_value={"result": "multi-server"})

            result = await mcp_service.call_tool_with_multi_server_config(
                multi_server_config, "test_tool", {"param": "value"}
            )

            assert result == {"result": "multi-server"}
            mock_client_class.assert_called_once_with(multi_server_config)

    @pytest.mark.asyncio
    async def test_test_server_config_stdio(self, mcp_service):
        """Test testing a stdio server configuration."""
        config = {"command": "python", "args": ["-m", "test_server"]}

        with patch("services.mcp_service.Client") as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value = mock_client
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client.list_tools = AsyncMock(return_value=[])

            result = await mcp_service.test_server_config("stdio", config)

            assert result["status"] == "success"
            assert "Connection test successful" in result["message"]

    @pytest.mark.asyncio
    async def test_test_server_config_http(self, mcp_service):
        """Test testing an HTTP server configuration."""
        config = {"url": "http://localhost:8080"}

        with patch("services.mcp_service.Client") as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value = mock_client
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client.list_tools = AsyncMock(return_value=[])

            result = await mcp_service.test_server_config("http", config)

            assert result["status"] == "success"
            assert "Connection test successful" in result["message"]

    @pytest.mark.asyncio
    async def test_test_server_config_failure(self, mcp_service):
        """Test testing a server configuration that fails."""
        config = {"url": "http://localhost:8080"}

        with patch("services.mcp_service.Client") as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value = mock_client
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client.list_tools = AsyncMock(side_effect=Exception("Connection failed"))

            result = await mcp_service.test_server_config("http", config)

            assert result["status"] == "error"
            assert "Connection test failed" in result["message"]
            assert "Connection failed" in result["message"]

    @pytest.mark.asyncio
    async def test_test_server_config_invalid(self, mcp_service):
        """Test testing an invalid server configuration."""
        config = {"invalid": "config"}

        result = await mcp_service.test_server_config("invalid_transport", config)

        assert result["status"] == "error"
        assert "Connection test failed" in result["message"]


class TestMCPServiceEdgeCases:
    """Test suite for MCP service edge cases and error handling."""

    @pytest.fixture
    def mcp_service(self):
        """Create a fresh MCP service instance for each test."""
        return MCPService()

    @pytest.mark.asyncio
    async def test_multiple_servers_same_name(self, mcp_service):
        """Test adding multiple servers with the same name."""
        server_config = {"url": "http://localhost:8080"}

        with patch("services.mcp_service.Client") as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value = mock_client
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client.list_tools = AsyncMock(return_value=[])

            # Add first server
            await mcp_service.add_server("test-server", "http", server_config)
            assert len(mcp_service.clients) == 1

            # Add second server with same name (should replace)
            server_config2 = {"url": "http://localhost:8081"}
            await mcp_service.add_server("test-server", "http", server_config2)
            assert len(mcp_service.clients) == 1
            assert mcp_service.server_configs["test-server"]["config"]["url"] == "http://localhost:8081"

    @pytest.mark.asyncio
    async def test_remove_nonexistent_server(self, mcp_service):
        """Test removing a server that doesn't exist."""
        # Should not raise an error
        await mcp_service.remove_server("nonexistent-server")

        # Verify no side effects
        assert len(mcp_service.clients) == 0
        assert len(mcp_service.server_configs) == 0

    @pytest.mark.asyncio
    async def test_concurrent_operations(self, mcp_service):
        """Test concurrent operations on the same server."""
        server_config = {"url": "http://localhost:8080"}

        with patch("services.mcp_service.Client") as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value = mock_client
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client.list_tools = AsyncMock(return_value=[])
            mock_client.call_tool = AsyncMock(return_value={"result": "success"})

            # Add server
            await mcp_service.add_server("test-server", "http", server_config)

            # Simulate concurrent tool calls
            tasks = [mcp_service.call_tool("test-server", "tool1", {"param": f"value{i}"}) for i in range(5)]

            results = await asyncio.gather(*tasks)

            # All calls should succeed
            assert len(results) == 5
            assert all(result["result"] == "success" for result in results)
