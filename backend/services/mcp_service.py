"""
MCP Service for managing FastMCP client connections.
This service handles multiple MCP server connections and provides a unified interface.
"""

import json
import logging
import time
from typing import Any, Dict, List

from fastmcp import Client
from fastmcp.client.auth import OAuth

logger = logging.getLogger(__name__)


class MCPService:
    """Service for managing multiple MCP server connections."""

    def __init__(self):
        self.clients: Dict[str, Client] = {}
        self.server_configs: Dict[str, Dict[str, Any]] = {}
        self.connection_status: Dict[str, str] = {}

    async def add_server(self, name: str, transport: str, config: Dict[str, Any]):
        """Add a new MCP server configuration and attempt connection."""
        try:
            # Store configuration
            self.server_configs[name] = {"transport": transport, "config": config}

            # Create FastMCP client based on transport type
            if transport == "http" and "url" in config:
                # Check for OAuth authentication configuration
                auth = None
                if config.get("oauth", False):
                    if config.get("oauth_config"):
                        # Use custom OAuth configuration
                        oauth_config = config["oauth_config"]
                        auth = OAuth(
                            mcp_url=config["url"],
                            scopes=oauth_config.get("scopes"),
                            client_name=oauth_config.get("client_name", "CanvasMCP Client"),
                            callback_port=oauth_config.get("callback_port"),
                        )
                    else:
                        # Use default OAuth settings
                        auth = "oauth"

                client = Client(config["url"], auth=auth)
            elif transport == "sse" and "url" in config:
                # Check for OAuth authentication configuration
                auth = None
                if config.get("oauth", False):
                    if config.get("oauth_config"):
                        # Use custom OAuth configuration
                        oauth_config = config["oauth_config"]
                        auth = OAuth(
                            mcp_url=config["url"],
                            scopes=oauth_config.get("scopes"),
                            client_name=oauth_config.get("client_name", "CanvasMCP Client"),
                            callback_port=oauth_config.get("callback_port"),
                        )
                    else:
                        # Use default OAuth settings
                        auth = "oauth"

                client = Client(config["url"], auth=auth)
            elif transport == "stdio" and "command" in config:
                # Create stdio configuration
                client = Client({"mcpServers": {name: config}})
            else:
                raise ValueError(f"Unsupported transport type: {transport}")

            self.clients[name] = client
            await self.connect_server(name)

        except Exception as e:
            logger.error(f"Failed to add MCP server {name}: {e}")
            self.connection_status[name] = "error"
            raise

    async def remove_server(self, name: str):
        """Remove an MCP server and disconnect."""
        if name in self.clients:
            try:
                await self.disconnect_server(name)
            except Exception:
                pass  # Ignore disconnect errors during removal

            del self.clients[name]
            del self.server_configs[name]
            self.connection_status.pop(name, None)

    async def connect_server(self, name: str):
        """Connect to a specific MCP server."""
        if name not in self.clients:
            raise ValueError(f"Server {name} not configured")

        try:
            client = self.clients[name]
            # Actually test the connection by trying to list tools
            async with client:
                await client.list_tools()

            self.connection_status[name] = "connected"
            logger.info(f"Successfully connected to MCP server: {name}")

        except Exception as e:
            logger.error(f"Failed to connect to MCP server {name}: {e}")
            self.connection_status[name] = "error"
            raise

    async def disconnect_server(self, name: str):
        """Disconnect from a specific MCP server."""
        if name in self.clients:
            try:
                # For FastMCP, disconnection is handled by context manager
                # We'll just update status here
                self.connection_status[name] = "disconnected"
                logger.info(f"Disconnected from MCP server: {name}")

            except Exception as e:
                logger.error(f"Failed to disconnect from MCP server {name}: {e}")
                raise

    async def get_all_servers_status(self) -> List[Dict[str, Any]]:
        """Get status of all configured MCP servers."""
        status_list = []

        for name, client in self.clients.items():
            server_status = {
                "name": name,
                "status": self.connection_status.get(name, "unknown"),
                "tools": [],
                "resources": [],
                "error": None,
            }

            try:
                if self.connection_status.get(name) == "connected":
                    async with client:
                        # Try to get available tools, handle "Method not found" gracefully
                        try:
                            tools = await client.list_tools()
                            server_status["tools"] = [
                                {"name": tool.name, "description": tool.description} for tool in tools
                            ]
                        except Exception as tool_error:
                            if "Method not found" in str(tool_error):
                                logger.warning(f"Server {name} doesn't support list_tools method")
                                server_status["tools"] = []
                            else:
                                raise tool_error

                        # Try to get available resources, handle "Method not found" gracefully
                        try:
                            resources = await client.list_resources()
                            server_status["resources"] = [
                                {"uri": resource.uri, "name": resource.name, "description": resource.description}
                                for resource in resources
                            ]
                        except Exception as resource_error:
                            if "Method not found" in str(resource_error):
                                logger.warning(f"Server {name} doesn't support list_resources method")
                                server_status["resources"] = []
                            else:
                                raise resource_error

            except Exception as e:
                # Don't mark as error if it's just missing tool discovery methods
                if "Method not found" not in str(e):
                    server_status["status"] = "error"
                    server_status["error"] = str(e)
                    self.connection_status[name] = "error"
                else:
                    # Keep as connected but log the limitation
                    logger.info(f"Server {name} connected but has limited method support: {e}")

            status_list.append(server_status)

        return status_list

    async def call_tool(self, server_name: str, tool_name: str, parameters: Dict[str, Any]) -> Any:
        """Call a tool on a specific MCP server."""
        if server_name not in self.clients:
            raise ValueError(f"Server {server_name} not configured")

        client = self.clients[server_name]

        try:
            # Enhanced debug logging for MCP tool request
            logger.debug("=" * 80)
            logger.debug(f"🔧 MCP TOOL REQUEST")
            logger.debug(f"Server: {server_name}")
            logger.debug(f"Tool: {tool_name}")
            logger.debug(
                f"Parameters: {json.dumps(parameters, indent=2) if isinstance(parameters, dict) else parameters}"
            )
            logger.debug("=" * 80)

            start_time = time.time()
            async with client:
                result = await client.call_tool(tool_name, parameters)
            end_time = time.time()

            # Enhanced debug logging for MCP tool response
            logger.debug("=" * 80)
            logger.debug(f"✅ MCP TOOL RESPONSE (took {end_time - start_time:.2f}s)")
            logger.debug(f"Server: {server_name}")
            logger.debug(f"Tool: {tool_name}")
            logger.debug(f"Result Type: {type(result)}")
            logger.debug(f"Result: {str(result)[:500]}{'...' if len(str(result)) > 500 else ''}")
            logger.debug("=" * 80)

            return result

        except Exception as e:
            # Enhanced error logging
            logger.debug("=" * 80)
            logger.debug(f"❌ MCP TOOL ERROR")
            logger.debug(f"Server: {server_name}")
            logger.debug(f"Tool: {tool_name}")
            logger.debug(f"Error: {str(e)}")
            logger.debug("=" * 80)
            logger.error(f"Failed to call tool {tool_name} on server {server_name}: {e}")
            self.connection_status[server_name] = "error"
            raise

    async def list_resources(self, server_name: str) -> List[Dict[str, Any]]:
        """List available resources from an MCP server."""
        if server_name not in self.clients:
            raise ValueError(f"Server {server_name} not configured")

        client = self.clients[server_name]

        try:
            async with client:
                resources = await client.list_resources()
                return [
                    {
                        "uri": resource.uri,
                        "name": resource.name,
                        "description": resource.description,
                        "mimeType": getattr(resource, "mimeType", None),
                    }
                    for resource in resources
                ]

        except Exception as e:
            logger.error(f"Failed to list resources from server {server_name}: {e}")
            self.connection_status[server_name] = "error"
            raise

    async def read_resource(self, server_name: str, resource_uri: str) -> Any:
        """Read a specific resource from an MCP server."""
        if server_name not in self.clients:
            raise ValueError(f"Server {server_name} not configured")

        client = self.clients[server_name]

        try:
            async with client:
                content = await client.read_resource(resource_uri)
                return content

        except Exception as e:
            logger.error(f"Failed to read resource {resource_uri} from server {server_name}: {e}")
            self.connection_status[server_name] = "error"
            raise

    async def call_tool_with_multi_server_config(
        self, config: Dict[str, Any], tool_name: str, parameters: Dict[str, Any]
    ) -> Any:
        """Call a tool using a multi-server configuration."""
        try:
            # Create a temporary client with the full configuration
            client = Client(config)

            async with client:
                result = await client.call_tool(tool_name, parameters)
                return result

        except Exception as e:
            logger.error(f"Failed to call tool {tool_name} with multi-server config: {e}")
            raise

    async def test_server_config(self, transport: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """Test a new MCP server configuration without saving it."""
        client = None
        server_name = "test_server"
        try:
            # Create a temporary client for testing
            if transport == "stdio" and "command" in config:
                client_config = {"mcpServers": {server_name: config}}
                client = Client(client_config)
            elif transport in ["http", "sse"] and "url" in config:
                client = Client(config["url"])
            else:
                raise ValueError("Invalid configuration for testing")

            # Attempt a basic operation to verify connection
            # list_tools is a good candidate for a health check
            async with client:
                await client.list_tools()

            # If the above call succeeds, the configuration is likely valid
            return {"status": "success", "message": "Connection test successful. The MCP server is responsive."}

        except Exception as e:
            # Provide a detailed error message
            error_message = f"Connection test failed: {str(e)}"
            logger.error(f"MCP server test failed for config {config}: {error_message}")
            return {"status": "error", "message": error_message}


# Global MCP service instance
mcp_service = MCPService()
