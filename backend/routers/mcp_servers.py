"""
MCP Server management API routes.
This module handles MCP server configuration and connection management using FastMCP.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from database import MCPRegistryServer, MCPServer, get_db
from services.mcp_service import mcp_service

router = APIRouter()

# Pydantic models for request/response


class MCPServerCreate(BaseModel):
    name: str
    transport: str  # stdio, http, sse
    config: Dict[str, Any]


class MCPServerUpdate(BaseModel):
    name: Optional[str] = None
    transport: Optional[str] = None
    config: Optional[Dict[str, Any]] = None


class MCPServerResponse(BaseModel):
    id: int
    name: str
    transport: str
    config: Dict[str, Any]
    status: str
    last_connected: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MCPServerStatus(BaseModel):
    name: str
    status: str
    tools: List[Dict[str, Any]]
    resources: List[Dict[str, Any]]
    error: Optional[str] = None


class MCPServerTest(BaseModel):
    transport: str
    config: Dict[str, Any]


@router.get("/", response_model=List[MCPServerResponse])
async def list_mcp_servers(db: Session = Depends(get_db)):
    """List all configured MCP servers."""
    servers = db.query(MCPServer).order_by(MCPServer.name.asc()).all()
    return servers


@router.post("/", response_model=MCPServerResponse)
async def create_mcp_server(server: MCPServerCreate, db: Session = Depends(get_db)):
    """Create a new MCP server configuration."""
    # Check if name already exists
    existing = db.query(MCPServer).filter(MCPServer.name == server.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Server name already exists")

    db_server = MCPServer(name=server.name, transport=server.transport, config=server.config, status="disconnected")
    db.add(db_server)
    db.commit()
    db.refresh(db_server)

    # Try to connect to the server
    try:
        await mcp_service.add_server(server.name, server.transport, server.config)
        db_server.status = "connected"
        db_server.last_connected = datetime.utcnow()
        db.commit()
    except Exception as e:
        db_server.status = "error"
        db.commit()
        # Don't raise error, just log it
        print(f"Failed to connect to MCP server {server.name}: {e}")

    return db_server


@router.get("/{server_id}", response_model=MCPServerResponse)
async def get_mcp_server(server_id: int, db: Session = Depends(get_db)):
    """Get a specific MCP server configuration."""
    server = db.query(MCPServer).filter(MCPServer.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="MCP server not found")
    return server


@router.put("/{server_id}", response_model=MCPServerResponse)
async def update_mcp_server(server_id: int, server_update: MCPServerUpdate, db: Session = Depends(get_db)):
    """Update MCP server configuration."""
    server = db.query(MCPServer).filter(MCPServer.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="MCP server not found")

    # Remove old server connection if name is changing
    old_name = server.name

    update_data = server_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(server, field, value)

    server.updated_at = datetime.utcnow()
    server.status = "disconnected"
    db.commit()

    # Remove old connection and add new one
    try:
        await mcp_service.remove_server(old_name)
        await mcp_service.add_server(server.name, server.transport, server.config)
        server.status = "connected"
        server.last_connected = datetime.utcnow()
        db.commit()
    except Exception:
        server.status = "error"
        db.commit()

    return server


@router.delete("/{server_id}")
async def delete_mcp_server(server_id: int, db: Session = Depends(get_db)):
    """Delete MCP server configuration."""
    server = db.query(MCPServer).filter(MCPServer.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="MCP server not found")

    # Remove from MCP service
    try:
        await mcp_service.remove_server(server.name)
    except Exception:
        pass  # Continue even if removal fails

    db.delete(server)
    db.commit()
    return {"message": "MCP server deleted successfully"}


@router.post("/{server_id}/connect")
async def connect_mcp_server(server_id: int, db: Session = Depends(get_db)):
    """Connect to an MCP server."""
    server = db.query(MCPServer).filter(MCPServer.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="MCP server not found")

    try:
        await mcp_service.connect_server(server.name)
        server.status = "connected"
        server.last_connected = datetime.utcnow()
        db.commit()
        return {"message": "Connected successfully"}
    except Exception as e:
        server.status = "error"
        db.commit()
        raise HTTPException(status_code=500, detail=f"Connection failed: {str(e)}")


@router.post("/{server_id}/disconnect")
async def disconnect_mcp_server(server_id: int, db: Session = Depends(get_db)):
    """Disconnect from an MCP server."""
    server = db.query(MCPServer).filter(MCPServer.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="MCP server not found")

    try:
        await mcp_service.disconnect_server(server.name)
        server.status = "disconnected"
        db.commit()
        return {"message": "Disconnected successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Disconnection failed: {str(e)}")


@router.get("/status/all", response_model=List[MCPServerStatus])
async def get_all_servers_status():
    """Get status of all MCP servers including available tools and resources."""
    return await mcp_service.get_all_servers_status()


@router.post("/{server_name}/tools/{tool_name}/call")
async def call_mcp_tool(server_name: str, tool_name: str, parameters: Dict[str, Any]):
    """Call a tool on a specific MCP server."""
    try:
        result = await mcp_service.call_tool(server_name, tool_name, parameters)
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Tool call failed: {str(e)}")


@router.get("/{server_name}/resources")
async def list_mcp_resources(server_name: str):
    """List available resources from an MCP server."""
    try:
        resources = await mcp_service.list_resources(server_name)
        return {"resources": resources}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list resources: {str(e)}")


@router.get("/{server_name}/resources/{resource_uri}")
async def read_mcp_resource(server_name: str, resource_uri: str):
    """Read a specific resource from an MCP server."""
    try:
        content = await mcp_service.read_resource(server_name, resource_uri)
        return {"content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read resource: {str(e)}")


@router.post("/import-config")
async def import_mcp_config(config_data: Dict[str, Any], db: Session = Depends(get_db)):
    """Import MCP server configuration from standard MCP JSON format."""
    try:
        imported_count = 0

        # Handle standard MCP configuration format
        if "mcpServers" in config_data:
            for server_name, server_config in config_data["mcpServers"].items():
                # Check if server already exists
                existing = db.query(MCPServer).filter(MCPServer.name == server_name).first()
                if existing:
                    continue  # Skip existing servers

                # Determine transport type
                transport = server_config.get("transport", "stdio")
                if "url" in server_config:
                    transport = "http"
                elif "command" in server_config:
                    transport = "stdio"

                db_server = MCPServer(
                    name=server_name, transport=transport, config=server_config, status="disconnected"
                )
                db.add(db_server)
                imported_count += 1

        db.commit()
        return {"message": f"Imported {imported_count} MCP servers"}

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Import failed: {str(e)}")


@router.get("/export/config")
async def export_mcp_config(db: Session = Depends(get_db)):
    """Export all MCP server configurations in standard MCP JSON format."""
    servers = db.query(MCPServer).all()

    config = {"mcpServers": {server.name: server.config for server in servers}}

    return config


@router.post("/test-config")
async def test_mcp_config(config: MCPServerTest):
    """Test an MCP server configuration without saving it."""
    return await mcp_service.test_server_config(config.transport, config.config)


class RegistryInstallRequest(BaseModel):
    registry_id: str
    server_name: Optional[str] = None


@router.post("/install-from-registry")
async def install_from_registry(request: RegistryInstallRequest, db: Session = Depends(get_db)):
    """Install an MCP server from the registry into user configuration."""
    registry_id = request.registry_id
    server_name = request.server_name
    # Get the registry server
    registry_server = db.query(MCPRegistryServer).filter(MCPRegistryServer.registry_id == registry_id).first()

    if not registry_server:
        raise HTTPException(status_code=404, detail="Registry server not found")

    # Use provided name or default to registry server name
    final_name = server_name or registry_server.name

    # Check if server already exists
    existing = db.query(MCPServer).filter(MCPServer.name == final_name).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Server name '{final_name}' already exists")

    # Generate configuration from registry server
    transport = registry_server.transport_types[0] if registry_server.transport_types else "stdio"

    # Build config based on example usage or defaults
    config = {}
    if registry_server.example_usage:
        # Use the first example as the default configuration
        example = registry_server.example_usage[0]
        if "config" in example:
            config = example["config"]

    # Fallback configuration if no examples available
    if not config:
        if registry_server.package_name:
            if transport == "stdio":
                config = {
                    "command": "npx" if registry_server.package_manager == "npm" else "python",
                    "args": (
                        [registry_server.package_name]
                        if registry_server.package_manager == "npm"
                        else ["-m", registry_server.package_name]
                    ),
                }
        else:
            raise HTTPException(
                status_code=400, detail="No configuration available for this server. Please configure manually."
            )

    # Create the MCP server entry
    db_server = MCPServer(name=final_name, transport=transport, config=config, status="disconnected")
    db.add(db_server)
    db.commit()
    db.refresh(db_server)

    # Try to connect to the server
    try:
        await mcp_service.add_server(final_name, transport, config)
        db_server.status = "connected"
        db_server.last_connected = datetime.utcnow()
        db.commit()
    except Exception as e:
        db_server.status = "error"
        db.commit()
        # Don't raise error, just log it
        print(f"Failed to connect to MCP server {final_name}: {e}")

    return {
        "message": f"Successfully installed server '{final_name}' from registry",
        "server": db_server,
        "registry_info": {
            "registry_id": registry_server.registry_id,
            "version": registry_server.version,
            "description": registry_server.description,
            "documentation_url": registry_server.documentation_url,
        },
    }
