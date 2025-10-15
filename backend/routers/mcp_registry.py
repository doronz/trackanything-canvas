"""
MCP Registry API routes.
This module handles integration with the official Anthropic MCP Registry.
TODO: I do not fully test MCP Registry yet. Keeping this for update later.
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import MCPRegistryServer, get_db
from services.mcp_registry_service import MCPRegistryService

logger = logging.getLogger(__name__)

router = APIRouter()

# Pydantic models for request/response


class MCPRegistryServerResponse(BaseModel):
    id: int
    registry_id: str
    name: str
    description: Optional[str]
    version: Optional[str]
    repository_url: Optional[str]
    homepage_url: Optional[str]
    documentation_url: Optional[str]
    package_name: Optional[str]
    package_manager: Optional[str]
    installation_command: Optional[str]
    schema_version: Optional[str]
    transport_types: List[str]
    capabilities: List[str]
    category: Optional[str]
    tags: List[str]
    author: Optional[str]
    license: Optional[str]
    download_count: int
    trust_score: float
    verification_status: str
    is_official: bool
    readme_content: Optional[str]
    changelog: Optional[str]
    server_config_schema: Dict[str, Any]
    example_usage: List[Dict[str, Any]]
    registry_created_at: Optional[datetime]
    registry_updated_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    last_synced: datetime

    model_config = ConfigDict(from_attributes=True)


class MCPRegistrySearchRequest(BaseModel):
    query: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    is_official: Optional[bool] = None
    limit: int = 50
    offset: int = 0


class MCPRegistrySyncResponse(BaseModel):
    success: bool
    synced_count: int
    updated_count: int
    error_count: int
    total_servers: int
    error: Optional[str] = None


class MCPRegistryStatsResponse(BaseModel):
    total_servers: int
    official_servers: int
    verified_servers: int
    categories: List[Dict[str, Any]]
    top_tags: List[Dict[str, Any]]


# Initialize MCP Registry Service
registry_service = MCPRegistryService()


@router.get("/servers", response_model=List[MCPRegistryServerResponse])
async def list_registry_servers(
    db: Session = Depends(get_db),
    category: Optional[str] = Query(None, description="Filter by category"),
    is_official: Optional[bool] = Query(None, description="Filter by official status"),
    verified_only: Optional[bool] = Query(False, description="Show only verified servers"),
    limit: int = Query(50, ge=1, le=100, description="Number of servers to return"),
    offset: int = Query(0, ge=0, description="Number of servers to skip"),
):
    """List servers from the MCP Registry."""
    query = db.query(MCPRegistryServer)

    if category:
        query = query.filter(MCPRegistryServer.category == category)

    if is_official is not None:
        query = query.filter(MCPRegistryServer.is_official == is_official)

    if verified_only:
        query = query.filter(MCPRegistryServer.verification_status == "verified")

    servers = (
        query.order_by(MCPRegistryServer.trust_score.desc(), MCPRegistryServer.download_count.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return servers


@router.get("/servers/{registry_id}", response_model=MCPRegistryServerResponse)
async def get_registry_server(registry_id: str, db: Session = Depends(get_db)):
    """Get a specific server from the MCP Registry by registry ID."""
    server = db.query(MCPRegistryServer).filter(MCPRegistryServer.registry_id == registry_id).first()

    if not server:
        raise HTTPException(status_code=404, detail="Registry server not found")

    return server


@router.get("/servers/{registry_id:path}/details")
async def get_registry_server_details(registry_id: str):
    """Get detailed server information directly from the MCP Registry API."""
    try:
        logger.info(f"Getting server details for: '{registry_id}' (decoded)")

        # Fetch detailed server info from the MCP Registry
        server_details = await registry_service.fetch_server_details(registry_id)

        if not server_details:
            logger.warning(f"Server details not found for: {registry_id}")
            raise HTTPException(status_code=404, detail="Server not found in registry")

        logger.info(f"Successfully fetched server details for: {registry_id}")
        return server_details
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_registry_server_details: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch server details: {str(e)}")


@router.post("/sync", response_model=MCPRegistrySyncResponse)
async def sync_registry_servers(db: Session = Depends(get_db)):
    """Sync servers from the official MCP Registry."""
    result = await registry_service.sync_registry_servers(db)
    return MCPRegistrySyncResponse(**result)


@router.post("/search", response_model=List[MCPRegistryServerResponse])
async def search_registry_servers(search_request: MCPRegistrySearchRequest, db: Session = Depends(get_db)):
    """Search servers in the MCP Registry with advanced filters."""
    query = db.query(MCPRegistryServer)

    # Text search in name and description
    if search_request.query:
        search_term = f"%{search_request.query}%"
        query = query.filter(
            (MCPRegistryServer.name.ilike(search_term)) | (MCPRegistryServer.description.ilike(search_term))
        )

    # Category filter
    if search_request.category:
        query = query.filter(MCPRegistryServer.category == search_request.category)

    # Official filter
    if search_request.is_official is not None:
        query = query.filter(MCPRegistryServer.is_official == search_request.is_official)

    # Tags filter (PostgreSQL JSONB contains, fallback for SQLite)
    if search_request.tags:
        for tag in search_request.tags:
            # This works for PostgreSQL with JSONB, for SQLite we'd need a different approach
            query = query.filter(MCPRegistryServer.tags.contains([tag]))

    servers = (
        query.order_by(MCPRegistryServer.trust_score.desc(), MCPRegistryServer.download_count.desc())
        .offset(search_request.offset)
        .limit(search_request.limit)
        .all()
    )

    return servers


@router.get("/stats", response_model=MCPRegistryStatsResponse)
async def get_registry_stats(db: Session = Depends(get_db)):
    """Get statistics about the MCP Registry servers."""
    total_servers = db.query(MCPRegistryServer).count()
    official_servers = db.query(MCPRegistryServer).filter(MCPRegistryServer.is_official.is_(True)).count()
    verified_servers = db.query(MCPRegistryServer).filter(MCPRegistryServer.verification_status == "verified").count()

    # Get categories with counts
    categories_query = (
        db.query(MCPRegistryServer.category, func.count(MCPRegistryServer.id).label("count"))
        .filter(MCPRegistryServer.category.isnot(None))
        .group_by(MCPRegistryServer.category)
        .all()
    )

    categories = [{"name": cat[0], "count": cat[1]} for cat in categories_query]

    # TODO: Get top tags - this would need special handling for JSON arrays
    # For now, return empty list
    top_tags = []

    return MCPRegistryStatsResponse(
        total_servers=total_servers,
        official_servers=official_servers,
        verified_servers=verified_servers,
        categories=categories,
        top_tags=top_tags,
    )


@router.get("/categories")
async def list_categories(db: Session = Depends(get_db)):
    """List all available categories in the registry."""
    categories = db.query(MCPRegistryServer.category).filter(MCPRegistryServer.category.isnot(None)).distinct().all()

    return {"categories": [cat[0] for cat in categories]}


@router.get("/servers/{registry_id}/install-config")
async def get_server_install_config(registry_id: str, db: Session = Depends(get_db)):
    """Get installation configuration for a specific server."""
    server = db.query(MCPRegistryServer).filter(MCPRegistryServer.registry_id == registry_id).first()

    if not server:
        raise HTTPException(status_code=404, detail="Registry server not found")

    # Generate MCP configuration based on server data
    config = {
        "mcpServers": {
            server.name: {
                "command": server.installation_command.split()[0] if server.installation_command else "npx",
                "args": (
                    server.installation_command.split()[1:] if server.installation_command else [server.package_name]
                ),
                "transport": server.transport_types[0] if server.transport_types else "stdio",
            }
        }
    }

    # Add environment variables if present in example usage
    if server.example_usage:
        for example in server.example_usage:
            if "config" in example and "env" in example["config"]:
                config["mcpServers"][server.name]["env"] = example["config"]["env"]
                break

    return {
        "config": config,
        "installation_command": server.installation_command,
        "package_name": server.package_name,
        "package_manager": server.package_manager,
        "documentation_url": server.documentation_url,
        "example_usage": server.example_usage,
    }
