"""
MCP Registry integration service.
This module handles integration with the official Anthropic MCP Registry.
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

import aiohttp
from sqlalchemy.orm import Session

from database import MCPRegistryServer

logger = logging.getLogger(__name__)


class MCPRegistryService:
    """Service for integrating with the official MCP Registry."""

    def __init__(self):
        self.registry_base_url = "https://registry.modelcontextprotocol.io"
        self.api_version = "v0"
        self.timeout = aiohttp.ClientTimeout(total=30)

    async def fetch_all_servers(self) -> List[Dict[str, Any]]:
        """Fetch all servers from the MCP Registry."""
        try:
            async with aiohttp.ClientSession(timeout=self.timeout) as session:
                url = f"{self.registry_base_url}/{self.api_version}/servers"

                async with session.get(url) as response:
                    if response.status == 200:
                        data = await response.json()
                        # MCP Registry returns {servers: [...], metadata: {...}}
                        if isinstance(data, dict) and "servers" in data:
                            return data["servers"]
                        elif isinstance(data, list):
                            return data
                        else:
                            logger.warning(f"Unexpected response format: {data}")
                            return []
                    else:
                        logger.error(f"Failed to fetch servers: HTTP {response.status}")
                        return []

        except Exception as e:
            logger.error(f"Error fetching servers from registry: {e}")
            return []

    async def fetch_server_details(self, server_id: str) -> Optional[Dict[str, Any]]:
        """Fetch detailed information for a specific server."""
        try:
            # First, fetch all servers to find the specific one (registry API doesn't have individual server endpoints)
            servers_data = await self.fetch_all_servers()

            logger.info(f"Searching for server '{server_id}' in {len(servers_data)} servers")

            # Find the server with matching name/id
            for server_data in servers_data:
                server_name = server_data.get("name", "")
                logger.debug(f"Checking server: '{server_name}' vs '{server_id}'")
                if server_name == server_id:
                    logger.info(f"Found server: {server_id}")
                    return server_data

            logger.warning(
                f"Server {server_id} not found in registry. Available servers: {[s.get('name', 'N/A') for s in servers_data[:5]]}"
            )
            return None

        except Exception as e:
            logger.error(f"Error fetching server {server_id} from registry: {e}")
            return None

    async def sync_registry_servers(self, db: Session) -> Dict[str, Any]:
        """Sync servers from the MCP Registry to local database."""
        try:
            servers_data = await self.fetch_all_servers()

            synced_count = 0
            updated_count = 0
            error_count = 0
            processed_ids = set()  # Track processed IDs to avoid duplicates

            for server_data in servers_data:
                try:
                    # Use server name as registry_id since that's the unique identifier
                    registry_id = server_data.get("name")
                    if not registry_id:
                        logger.warning(f"Server missing name: {server_data}")
                        error_count += 1
                        continue

                    # Skip if already processed in this sync (handles duplicates in API response)
                    if registry_id in processed_ids:
                        logger.debug(f"Skipping duplicate server: {registry_id}")
                        continue
                    processed_ids.add(registry_id)

                    # Check if server already exists
                    existing_server = (
                        db.query(MCPRegistryServer).filter(MCPRegistryServer.registry_id == registry_id).first()
                    )

                    server_obj = existing_server or MCPRegistryServer()

                    # Map registry data to our model
                    server_obj.registry_id = registry_id
                    server_obj.name = (
                        registry_id.split("/")[-1] if "/" in registry_id else registry_id
                    )  # Extract short name
                    server_obj.description = server_data.get("description", "")
                    server_obj.version = server_data.get("version", "")

                    # Extract repository info
                    repository = server_data.get("repository", {})
                    server_obj.repository_url = repository.get("url", "") if repository else ""
                    server_obj.homepage_url = server_obj.repository_url  # Use repo as homepage for now
                    server_obj.documentation_url = server_obj.repository_url  # Use repo as docs for now

                    # Extract package info from packages array if available
                    packages = server_data.get("packages", [])
                    if packages:
                        main_package = packages[0]  # Use first package as primary
                        server_obj.package_name = main_package.get("identifier", "")
                        server_obj.package_manager = main_package.get("registry_type", "")
                        # Build installation command based on package type
                        if server_obj.package_manager == "npm":
                            server_obj.installation_command = f"npm install -g {server_obj.package_name}"
                        elif server_obj.package_manager == "pypi":
                            server_obj.installation_command = f"pip install {server_obj.package_name}"
                        else:
                            server_obj.installation_command = ""
                    else:
                        server_obj.package_name = ""
                        server_obj.package_manager = ""
                        server_obj.installation_command = ""

                    # Set defaults for MCP schema
                    server_obj.schema_version = (
                        server_data.get("$schema", "").split("/")[-1].replace(".schema.json", "")
                        if server_data.get("$schema")
                        else ""
                    )

                    # Extract transport types from packages or remotes
                    transport_types = []
                    if packages:
                        for pkg in packages:
                            transport = pkg.get("transport", {})
                            if transport and transport.get("type"):
                                transport_types.append(transport["type"])
                    remotes = server_data.get("remotes", [])
                    for remote in remotes:
                        if remote.get("type"):
                            transport_types.append(remote["type"])
                    server_obj.transport_types = list(set(transport_types))  # Remove duplicates

                    # Default capabilities and metadata
                    server_obj.capabilities = ["tools"]  # Most MCP servers provide tools
                    server_obj.category = "General"  # Default category
                    server_obj.tags = []  # Extract from name or description if needed
                    server_obj.author = (
                        registry_id.split("/")[0] if "/" in registry_id else "Unknown"
                    )  # Extract from registry name
                    server_obj.license = "Unknown"
                    server_obj.download_count = 0  # Not available in registry
                    server_obj.trust_score = 8.0 if server_data.get("status") == "active" else 5.0  # Default score
                    server_obj.verification_status = (
                        "verified" if server_data.get("status") == "active" else "unverified"
                    )
                    server_obj.is_official = (
                        "io.modelcontextprotocol" in registry_id or "anthropic" in registry_id.lower()
                    )
                    server_obj.readme_content = server_data.get("description", "")
                    server_obj.changelog = ""
                    server_obj.server_config_schema = {}

                    # Build example usage from packages
                    example_usage = []
                    if packages:
                        for pkg in packages:
                            example = {
                                "name": f"Install via {pkg.get('registry_type', 'package manager')}",
                                "config": {},
                            }
                            if pkg.get("registry_type") == "npm":
                                example["config"] = {"command": "npx", "args": [pkg.get("identifier", "")]}
                            elif pkg.get("registry_type") == "pypi":
                                example["config"] = {"command": "python", "args": ["-m", pkg.get("identifier", "")]}
                            if example["config"]:
                                example_usage.append(example)
                    server_obj.example_usage = example_usage

                    # Parse timestamps from _meta field
                    meta = server_data.get("_meta", {})
                    registry_meta = meta.get("io.modelcontextprotocol.registry/official", {})

                    if registry_meta.get("published_at"):
                        try:
                            server_obj.registry_created_at = datetime.fromisoformat(
                                registry_meta["published_at"].replace("Z", "+00:00")
                            )
                        except:
                            pass

                    if registry_meta.get("updated_at"):
                        try:
                            server_obj.registry_updated_at = datetime.fromisoformat(
                                registry_meta["updated_at"].replace("Z", "+00:00")
                            )
                        except:
                            pass

                    server_obj.last_synced = datetime.utcnow()

                    if not existing_server:
                        db.add(server_obj)
                        synced_count += 1
                    else:
                        updated_count += 1

                except Exception as e:
                    logger.error(f"Error processing server {server_data}: {e}")
                    error_count += 1

            db.commit()

            return {
                "success": True,
                "synced_count": synced_count,
                "updated_count": updated_count,
                "error_count": error_count,
                "total_servers": len(servers_data),
            }

        except Exception as e:
            logger.error(f"Error syncing registry servers: {e}")
            db.rollback()
            return {
                "success": False,
                "error": str(e),
                "synced_count": 0,
                "updated_count": 0,
                "error_count": 0,
                "total_servers": 0,
            }

    async def search_registry_servers(
        self,
        query: Optional[str] = None,
        category: Optional[str] = None,
        tags: Optional[List[str]] = None,
        is_official: Optional[bool] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """Search servers in the registry with various filters."""
        try:
            params = {"limit": limit, "offset": offset}

            if query:
                params["q"] = query
            if category:
                params["category"] = category
            if tags:
                params["tags"] = ",".join(tags)
            if is_official is not None:
                params["official"] = str(is_official).lower()

            async with aiohttp.ClientSession(timeout=self.timeout) as session:
                url = f"{self.registry_base_url}/{self.api_version}/servers/search"

                async with session.get(url, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data.get("results", [])
                    else:
                        logger.error(f"Failed to search servers: HTTP {response.status}")
                        return []

        except Exception as e:
            logger.error(f"Error searching registry servers: {e}")
            return []
