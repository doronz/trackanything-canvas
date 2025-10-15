"""
MCP Server Directory API routes.
This module handles the public MCP servers directory functionality.
"""

import os
import subprocess
import sys
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from database import MCPServerDirectory, get_db

router = APIRouter()

# Pydantic models for request/response


class MCPDirectoryServerResponse(BaseModel):
    id: int
    name: str
    github_url: str
    short_description: Optional[str]
    category: Optional[str]
    tags: List[str]
    programming_language: Optional[str]
    transport_types: List[str]
    full_description: Optional[str]
    instructions: Optional[str]
    installation_commands: List[str]
    configuration_example: Optional[Dict[str, Any]]
    required_env_vars: List[str]
    optional_env_vars: List[str]
    tools_provided: List[str]
    resources_provided: List[str]
    stars: int
    last_updated: Optional[datetime]
    is_official: bool
    is_verified: bool
    created_at: datetime
    updated_at: datetime
    last_scraped: datetime

    model_config = ConfigDict(from_attributes=True)


class MCPDirectorySearchRequest(BaseModel):
    query: Optional[str] = None
    category: Optional[str] = None
    programming_language: Optional[str] = None
    tags: List[str] = []
    is_official: Optional[bool] = None
    min_stars: Optional[int] = None
    server_type: Optional[str] = None  # "remote" or "local"


class MCPDirectoryStatsResponse(BaseModel):
    total_servers: int
    categories: List[Dict[str, Any]]
    programming_languages: List[Dict[str, Any]]
    popular_tags: List[Dict[str, Any]]
    last_updated: Optional[datetime]


class PaginatedServerResponse(BaseModel):
    servers: List[MCPDirectoryServerResponse]
    total_count: int
    page: int
    per_page: int
    total_pages: int
    has_next: bool
    has_prev: bool


@router.get("/search", response_model=PaginatedServerResponse)
async def search_mcp_directory(
    query: Optional[str] = Query(None, description="Search query for server name or description"),
    category: Optional[str] = Query(None, description="Filter by category"),
    programming_language: Optional[str] = Query(None, description="Filter by programming language"),
    tags: Optional[str] = Query(None, description="Comma-separated list of tags to filter by"),
    is_official: Optional[bool] = Query(None, description="Filter for official implementations"),
    min_stars: Optional[int] = Query(None, description="Minimum number of GitHub stars"),
    server_type: Optional[str] = Query(None, description="Filter by server type: 'remote' or 'local'"),
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    per_page: int = Query(20, ge=1, le=100, description="Number of results per page"),
    db: Session = Depends(get_db),
):
    """Search the MCP servers directory with filters."""

    query_obj = db.query(MCPServerDirectory)

    # Text search
    if query:
        search_filter = or_(
            MCPServerDirectory.name.ilike(f"%{query}%"),
            MCPServerDirectory.short_description.ilike(f"%{query}%"),
            MCPServerDirectory.full_description.ilike(f"%{query}%"),
        )
        query_obj = query_obj.filter(search_filter)

    # Category filter
    if category:
        query_obj = query_obj.filter(MCPServerDirectory.category == category)

    # Programming language filter
    if programming_language:
        query_obj = query_obj.filter(MCPServerDirectory.programming_language == programming_language)

    # Tags filter
    if tags:
        tag_list = [tag.strip() for tag in tags.split(",")]
        for tag in tag_list:
            query_obj = query_obj.filter(MCPServerDirectory.tags.contains([tag]))

    # Official filter
    if is_official is not None:
        query_obj = query_obj.filter(MCPServerDirectory.is_official == is_official)

    # Stars filter
    if min_stars is not None:
        query_obj = query_obj.filter(MCPServerDirectory.stars >= min_stars)

    # Server type filter (remote vs local)
    if server_type:
        if server_type.lower() == "remote":
            query_obj = query_obj.filter(MCPServerDirectory.programming_language == "Remote")
        elif server_type.lower() == "local":
            query_obj = query_obj.filter(MCPServerDirectory.programming_language != "Remote")

    # Order by: Remote servers first (official remote), then by stars and name
    # This prioritizes remote servers while maintaining good sorting
    query_obj = query_obj.order_by(
        # Remote servers first (programming_language == "Remote")
        (MCPServerDirectory.programming_language == "Remote").desc(),
        # Official servers next
        MCPServerDirectory.is_official.desc(),
        # Then by stars
        MCPServerDirectory.stars.desc(),
        # Finally by name
        MCPServerDirectory.name.asc(),
    )

    # Get total count before pagination
    total_count = query_obj.count()

    # Calculate pagination values
    offset = (page - 1) * per_page
    total_pages = (total_count + per_page - 1) // per_page  # Ceiling division
    has_next = page < total_pages
    has_prev = page > 1

    # Apply pagination
    servers = query_obj.offset(offset).limit(per_page).all()

    return PaginatedServerResponse(
        servers=servers,
        total_count=total_count,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
        has_next=has_next,
        has_prev=has_prev,
    )


@router.get("/categories", response_model=List[str])
async def get_categories(db: Session = Depends(get_db)):
    """Get all available categories."""
    categories = (
        db.query(MCPServerDirectory.category)
        .distinct()
        .filter(MCPServerDirectory.category.isnot(None), MCPServerDirectory.category != "")
        .all()
    )
    return [cat[0] for cat in categories if cat[0]]


@router.get("/programming-languages", response_model=List[str])
async def get_programming_languages(db: Session = Depends(get_db)):
    """Get all available programming languages."""
    languages = (
        db.query(MCPServerDirectory.programming_language)
        .distinct()
        .filter(MCPServerDirectory.programming_language.isnot(None), MCPServerDirectory.programming_language != "")
        .all()
    )
    return [lang[0] for lang in languages if lang[0]]


@router.get("/tags", response_model=List[str])
async def get_all_tags(db: Session = Depends(get_db)):
    """Get all available tags."""
    # This is a bit complex since tags are stored as JSON arrays
    servers = db.query(MCPServerDirectory.tags).filter(MCPServerDirectory.tags.isnot(None)).all()

    all_tags = set()
    for server_tags in servers:
        if server_tags[0]:  # server_tags is a tuple
            all_tags.update(server_tags[0])

    return sorted(list(all_tags))


@router.get("/stats", response_model=MCPDirectoryStatsResponse)
async def get_directory_stats(db: Session = Depends(get_db)):
    """Get directory statistics."""

    # Total servers
    total_servers = db.query(func.count(MCPServerDirectory.id)).scalar()

    # Categories with counts
    categories = (
        db.query(MCPServerDirectory.category, func.count(MCPServerDirectory.id).label("count"))
        .filter(MCPServerDirectory.category.isnot(None), MCPServerDirectory.category != "")
        .group_by(MCPServerDirectory.category)
        .all()
    )

    categories_list = [{"name": cat, "count": count} for cat, count in categories]

    # Programming languages with counts
    languages = (
        db.query(MCPServerDirectory.programming_language, func.count(MCPServerDirectory.id).label("count"))
        .filter(MCPServerDirectory.programming_language.isnot(None), MCPServerDirectory.programming_language != "")
        .group_by(MCPServerDirectory.programming_language)
        .all()
    )

    languages_list = [{"name": lang, "count": count} for lang, count in languages]

    # Popular tags (this is complex due to JSON storage)
    servers_with_tags = db.query(MCPServerDirectory.tags).filter(MCPServerDirectory.tags.isnot(None)).all()

    tag_counts = {}
    for server_tags in servers_with_tags:
        if server_tags[0]:
            for tag in server_tags[0]:
                tag_counts[tag] = tag_counts.get(tag, 0) + 1

    popular_tags = [
        {"name": tag, "count": count}
        for tag, count in sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    ]

    # Last updated
    last_updated = db.query(func.max(MCPServerDirectory.last_scraped)).scalar()

    return MCPDirectoryStatsResponse(
        total_servers=total_servers,
        categories=categories_list,
        programming_languages=languages_list,
        popular_tags=popular_tags,
        last_updated=last_updated,
    )


@router.get("/{server_id}", response_model=MCPDirectoryServerResponse)
async def get_directory_server(server_id: int, db: Session = Depends(get_db)):
    """Get detailed information about a specific server from the directory."""
    server = db.query(MCPServerDirectory).filter(MCPServerDirectory.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found in directory")

    return server


@router.post("/refresh")
async def refresh_directory(db: Session = Depends(get_db)):
    """Refresh the MCP servers directory by running the scraper."""
    import logging

    logger = logging.getLogger(__name__)

    try:
        logger.debug("Starting directory refresh...")

        # Get the paths to both scraper scripts
        scripts_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts")

        github_scraper_path = os.path.join(scripts_dir, "scrape_mcp_servers.py")
        anthropic_scraper_path = os.path.join(scripts_dir, "scrape_anthropic_remote_servers.py")

        logger.debug(f"GitHub scraper path: {github_scraper_path}")
        logger.debug(f"Anthropic scraper path: {anthropic_scraper_path}")
        logger.debug(f"GitHub scraper exists: {os.path.exists(github_scraper_path)}")
        logger.debug(f"Anthropic scraper exists: {os.path.exists(anthropic_scraper_path)}")

        # Run both scrapers
        all_outputs = []
        success_count = 0

        # Run GitHub scraper
        if os.path.exists(github_scraper_path):
            logger.debug("Running GitHub scraper...")
            github_result = subprocess.run(
                [sys.executable, github_scraper_path], capture_output=True, text=True, timeout=300
            )  # 5 minutes timeout

            logger.debug(f"GitHub scraper return code: {github_result.returncode}")
            if github_result.returncode == 0:
                success_count += 1
                all_outputs.append("GitHub scraper: " + github_result.stdout)
                logger.debug("GitHub scraper completed successfully")
            else:
                logger.error(f"GitHub scraper failed: {github_result.stderr}")
                all_outputs.append(f"GitHub scraper failed: {github_result.stderr}")

        # Run Anthropic remote servers scraper
        if os.path.exists(anthropic_scraper_path):
            logger.debug("Running Anthropic remote servers scraper...")
            anthropic_result = subprocess.run(
                [sys.executable, anthropic_scraper_path], capture_output=True, text=True, timeout=120
            )  # 2 minutes timeout for remote scraper

            logger.debug(f"Anthropic scraper return code: {anthropic_result.returncode}")
            if anthropic_result.returncode == 0:
                success_count += 1
                all_outputs.append("Anthropic remote servers scraper: " + anthropic_result.stdout)
                logger.debug("Anthropic scraper completed successfully")
            else:
                logger.error(f"Anthropic scraper failed: {anthropic_result.stderr}")
                all_outputs.append(f"Anthropic scraper failed: {anthropic_result.stderr}")

        # Check if at least one scraper succeeded
        if success_count > 0:
            logger.debug(f"{success_count} scrapers completed successfully")

            # Get updated stats
            logger.debug("Getting updated stats...")
            total_servers = db.query(func.count(MCPServerDirectory.id)).scalar()
            last_updated = db.query(func.max(MCPServerDirectory.last_scraped)).scalar()

            logger.debug(f"Total servers after refresh: {total_servers}")

            return {
                "message": f"Directory refreshed successfully ({success_count} scrapers completed)",
                "total_servers": total_servers,
                "last_updated": last_updated,
                "output": "\n\n".join(all_outputs),
            }
        else:
            # Both scrapers failed
            logger.error("All scrapers failed")
            error_messages = "\n".join(all_outputs)
            raise HTTPException(status_code=500, detail=f"All scrapers failed: {error_messages}")

    except subprocess.TimeoutExpired as e:
        logger.error(f"Directory refresh timed out: {e}")
        raise HTTPException(status_code=500, detail="Directory refresh timed out")
    except Exception as e:
        logger.error(f"Failed to refresh directory: {str(e)}")
        logger.error(f"Exception type: {type(e)}")
        import traceback

        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to refresh directory: {str(e)}")


def detect_command_and_args(server: MCPServerDirectory) -> Dict[str, Any]:
    """Detect command and arguments based on server patterns."""
    import re

    # Extract repo name from GitHub URL
    repo_match = re.search(r"github\.com/[^/]+/([^/]+?)(?:\.git|/|$)", server.github_url)
    repo_name = repo_match.group(1) if repo_match else server.name.split("/")[-1]

    # Common patterns based on programming language and naming conventions
    command_patterns = {
        # Python packages - commonly use uvx for MCP servers
        "python": {"command": "uvx", "args": [repo_name], "description": "Use uvx to run Python MCP servers"},
        # TypeScript/Node.js packages - use npx
        "typescript": {"command": "npx", "args": [repo_name], "description": "Use npx to run Node.js MCP servers"},
        # Generic patterns based on repo name
        "patterns": [
            {
                "pattern": r"mcp-server-(.+)",
                "command": "uvx",
                "args_template": lambda match: [f"mcp-server-{match.group(1)}"],
                "description": "Python MCP server pattern",
            },
            {
                "pattern": r"(.+)-mcp-server",
                "command": "uvx",
                "args_template": lambda match: [f"{match.group(1)}-mcp-server"],
                "description": "Python MCP server pattern",
            },
            {
                "pattern": r"mcp-(.+)",
                "command": "uvx",
                "args_template": lambda match: [f"mcp-{match.group(1)}"],
                "description": "Python MCP server pattern",
            },
        ],
    }

    # Try language-specific patterns first
    if server.programming_language and server.programming_language.lower() in command_patterns:
        lang_pattern = command_patterns[server.programming_language.lower()]
        return {
            "command": lang_pattern["command"],
            "args": lang_pattern["args"],
            "description": lang_pattern["description"],
        }

    # Try pattern matching
    for pattern_def in command_patterns["patterns"]:
        match = re.search(pattern_def["pattern"], repo_name)
        if match:
            return {
                "command": pattern_def["command"],
                "args": pattern_def["args_template"](match),
                "description": pattern_def["description"],
            }

    # Special cases for known servers
    special_cases = {
        "mcp-hn": {"command": "uvx", "args": ["mcp-hn"], "description": "Hacker News MCP server"},
        "mcp-server-sqlite": {"command": "uvx", "args": ["mcp-server-sqlite"], "description": "SQLite MCP server"},
        # Add more special cases as needed
    }

    if repo_name in special_cases:
        return special_cases[repo_name]

    # Default fallback
    return {
        "command": "uvx",  # Most MCP servers are Python-based
        "args": [repo_name],
        "description": "Default command pattern for MCP servers",
    }


@router.get("/{server_id}/install-config", response_model=Dict[str, Any])
async def get_server_install_config(server_id: int, db: Session = Depends(get_db)):
    """Get installation and configuration information for a specific server."""
    server = db.query(MCPServerDirectory).filter(MCPServerDirectory.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found in directory")

    # Detect smart command and arguments
    command_info = detect_command_and_args(server)

    # Generate a suggested MCP server configuration
    suggested_config = {
        "name": server.name,
        "transport": "stdio",  # Default transport
        "config": {"command": command_info["command"], "args": command_info["args"]},
    }

    # Add transport types if available
    if server.transport_types:
        suggested_config["suggested_transports"] = server.transport_types

    # Add configuration example if available
    if server.configuration_example:
        suggested_config["config"].update(server.configuration_example)

    return {
        "server_info": {
            "name": server.name,
            "github_url": server.github_url,
            "description": server.short_description,
            "programming_language": server.programming_language,
            "tags": server.tags,
        },
        "installation": {
            "commands": server.installation_commands,
            "instructions": server.instructions,
            "recommended_command": command_info,
        },
        "configuration": {
            "suggested_config": suggested_config,
            "required_env_vars": server.required_env_vars,
            "optional_env_vars": server.optional_env_vars,
        },
        "capabilities": {"tools": server.tools_provided, "resources": server.resources_provided},
    }
