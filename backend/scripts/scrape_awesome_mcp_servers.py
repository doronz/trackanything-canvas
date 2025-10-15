#!/usr/bin/env python3
"""
MCP Servers Directory Scraper

This script scrapes MCP servers from the awesome-mcp-servers GitHub repository
and populates the local database with server information.
"""

import asyncio
import json
import os
import re
import sys
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import aiohttp

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session

from database import Base, MCPServerDirectory, SessionLocal, engine


@dataclass
class MCPServerInfo:
    """Data class for MCP server information."""

    name: str
    github_url: str
    short_description: str
    category: str = ""
    tags: List[str] = None
    programming_language: str = ""
    transport_types: List[str] = None
    full_description: str = ""
    instructions: str = ""
    installation_commands: List[str] = None
    configuration_example: Dict = None
    required_env_vars: List[str] = None
    optional_env_vars: List[str] = None
    tools_provided: List[str] = None
    resources_provided: List[str] = None
    stars: int = 0
    last_updated: Optional[datetime] = None
    is_official: bool = False
    is_verified: bool = False

    def __post_init__(self):
        if self.tags is None:
            self.tags = []
        if self.transport_types is None:
            self.transport_types = []
        if self.installation_commands is None:
            self.installation_commands = []
        if self.required_env_vars is None:
            self.required_env_vars = []
        if self.optional_env_vars is None:
            self.optional_env_vars = []
        if self.tools_provided is None:
            self.tools_provided = []
        if self.resources_provided is None:
            self.resources_provided = []


class MCPServerScraper:
    """Scraper for MCP servers from awesome-mcp-servers repository."""

    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
        self.github_token = os.getenv("GITHUB_TOKEN")

    async def __aenter__(self):
        headers = {"User-Agent": "Canvas-MCP-Client/1.0", "Accept": "application/vnd.github.v3+json"}
        if self.github_token:
            headers["Authorization"] = f"token {self.github_token}"

        self.session = aiohttp.ClientSession(headers=headers)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    async def fetch_readme(self) -> str:
        """Fetch the README content from awesome-mcp-servers repository."""
        # Use raw GitHub content URL to avoid API rate limiting
        url = "https://raw.githubusercontent.com/punkpeye/awesome-mcp-servers/main/README.md"

        async with self.session.get(url) as response:
            if response.status == 200:
                content = await response.text()
                return content
            else:
                raise Exception(f"Failed to fetch README: {response.status}")

    def parse_server_list(self, readme_content: str) -> List[MCPServerInfo]:
        """Parse the README content to extract MCP server information."""
        servers = []

        # Find the server implementations section
        lines = readme_content.split("\n")
        in_server_section = False
        current_category = ""

        for line in lines:
            # Check if we're in the server implementations section
            if "## Server Implementations" in line:
                in_server_section = True
                continue
            elif line.startswith("## ") and in_server_section and "Server Implementations" not in line:
                # We've reached a new section, stop parsing
                break

            if not in_server_section:
                continue

            # Parse category headers (### with <a name=...>)
            if line.startswith("### ") and "<a name=" in line:
                # Extract category name from the line
                # Format: ### 🔗 <a name="aggregators"></a>Aggregators
                import re

                category_match = re.search(r"</a>(.+)$", line)
                if category_match:
                    current_category = category_match.group(1).strip()
                    print(f"Found category: {current_category}")
                continue

            # Parse server entries (bullet points with hyphens)
            if line.startswith("- [") and "github.com" in line:
                server_info = self.parse_server_line(line, current_category)
                if server_info:
                    servers.append(server_info)
                    print(f"Added server: {server_info.name}")

        return servers

    def parse_server_line(self, line: str, category: str) -> Optional[MCPServerInfo]:
        """Parse a single server line from the README."""
        try:
            # Remove the bullet point (hyphen)
            line = line[2:].strip()

            # Extract tags (emojis and symbols)
            tags = []
            programming_language = ""
            transport_types = []

            # Common tags and their meanings
            tag_patterns = {
                "🎖️": "official",
                "🐍": "python",
                "📇": "typescript",
                "☕": "java",
                "🏎️": "go",
                "☁️": "cloud",
                "🏠": "local",
                "🍎": "macos",
                "🪟": "windows",
                "🐧": "linux",
            }

            # Extract tags from the line
            for tag, meaning in tag_patterns.items():
                if tag in line:
                    tags.append(meaning)
                    if meaning in ["python", "typescript", "java", "go"]:
                        programming_language = meaning

            # Extract transport types
            if "☁️" in line:
                transport_types.append("http")
            if "🏠" in line:
                transport_types.append("stdio")

            # Default to stdio if no transport specified
            if not transport_types:
                transport_types = ["stdio"]

            # Find the link and description
            # Pattern: [name](url) extras - description
            link_pattern = r"\[([^\]]+)\]\(([^)]+)\)(.*?)(?:\s*-\s*(.+))?$"
            match = re.search(link_pattern, line)

            if not match:
                return None

            name = match.group(1).strip()
            github_url = match.group(2).strip()
            extras = match.group(3).strip() if match.group(3) else ""
            short_description = match.group(4).strip() if match.group(4) else ""

            # Only process GitHub URLs
            if "github.com" not in github_url:
                return None

            # Clean up the description by removing trailing tags and emojis
            short_description = re.sub(r"\s*[🎖️🐍📇☕🏎️☁️🏠🍎🪟🐧]+\s*", " ", short_description).strip()

            # Check if it's an official implementation
            is_official = "🎖️" in line

            # Add category to tags
            if category:
                category_tag = category.lower().replace(" ", "_").replace("&", "and")
                tags.append(category_tag)

            return MCPServerInfo(
                name=name,
                github_url=github_url,
                short_description=short_description,
                category=category,
                tags=tags,
                programming_language=programming_language,
                transport_types=transport_types,
                is_official=is_official,
            )

        except Exception as e:
            print(f"Error parsing line: {line}, Error: {e}")
            return None

    async def get_github_repo_info(self, github_url: str) -> Tuple[int, Optional[datetime]]:
        """Get additional information from GitHub repository."""
        try:
            # Extract owner and repo from URL
            parts = github_url.replace("https://github.com/", "").split("/")
            if len(parts) >= 2:
                owner = parts[0]
                repo = parts[1]

                api_url = f"https://api.github.com/repos/{owner}/{repo}"

                async with self.session.get(api_url) as response:
                    if response.status == 200:
                        data = await response.json()
                        stars = data.get("stargazers_count", 0)
                        last_updated = None
                        if data.get("updated_at"):
                            last_updated = datetime.fromisoformat(data["updated_at"].replace("Z", "+00:00"))
                        return stars, last_updated

        except Exception as e:
            print(f"Error fetching GitHub info for {github_url}: {e}")

        return 0, None

    async def get_repo_readme(self, github_url: str) -> Tuple[str, str, List[str], Dict]:
        """Get detailed information from repository README."""
        try:
            # Extract owner and repo from URL
            parts = github_url.replace("https://github.com/", "").split("/")
            if len(parts) >= 2:
                owner = parts[0]
                repo = parts[1]

                api_url = f"https://api.github.com/repos/{owner}/{repo}/contents/README.md"

                async with self.session.get(api_url) as response:
                    if response.status == 200:
                        data = await response.json()
                        import base64

                        content = base64.b64decode(data["content"]).decode("utf-8")

                        # Parse the README for useful information
                        return self.parse_readme_details(content)

        except Exception as e:
            print(f"Error fetching README for {github_url}: {e}")

        return "", "", [], {}

    def parse_readme_details(self, readme_content: str) -> Tuple[str, str, List[str], Dict]:
        """Parse README content for installation instructions and configuration examples."""
        full_description = ""
        instructions = ""
        installation_commands = []
        configuration_example = {}

        lines = readme_content.split("\n")

        # Extract description (usually first few paragraphs)
        description_lines = []
        in_description = True

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Skip title
            if line.startswith("#") and in_description and not description_lines:
                continue

            # Stop at installation or usage sections
            if any(
                keyword in line.lower()
                for keyword in ["installation", "usage", "getting started", "setup", "configuration"]
            ):
                in_description = False
                break

            if in_description and not line.startswith("#"):
                description_lines.append(line)

        full_description = " ".join(description_lines)

        # Extract installation commands
        in_install_section = False
        in_code_block = False

        for line in lines:
            if any(keyword in line.lower() for keyword in ["installation", "install", "setup"]) and line.startswith(
                "#"
            ):
                in_install_section = True
                continue

            if (
                in_install_section
                and line.startswith("#")
                and not any(keyword in line.lower() for keyword in ["installation", "install", "setup"])
            ):
                in_install_section = False

            if in_install_section:
                # Look for code blocks with installation commands
                if line.strip().startswith("```"):
                    in_code_block = not in_code_block
                    continue

                if in_code_block and line.strip():
                    installation_commands.append(line.strip())
                elif line.strip().startswith(("npm install", "pip install", "yarn add", "go install")):
                    installation_commands.append(line.strip())

        # TODO: Parse configuration examples from JSON code blocks

        return full_description, instructions, installation_commands, configuration_example

    async def scrape_all_servers(self) -> List[MCPServerInfo]:
        """Scrape all MCP servers from the awesome-mcp-servers repository."""
        print("Fetching README from awesome-mcp-servers repository...")
        readme_content = await self.fetch_readme()

        print("Parsing server list...")
        servers = self.parse_server_list(readme_content)

        print(f"Found {len(servers)} servers. Fetching detailed information...")

        # Enhance server information with GitHub data
        for i, server in enumerate(servers):
            print(f"Processing {i + 1}/{len(servers)}: {server.name}")

            # Get GitHub repo info
            stars, last_updated = await self.get_github_repo_info(server.github_url)
            server.stars = stars
            server.last_updated = last_updated

            # Get detailed README information
            full_desc, instructions, install_cmds, config_example = await self.get_repo_readme(server.github_url)
            server.full_description = full_desc
            server.instructions = instructions
            server.installation_commands = install_cmds
            server.configuration_example = config_example

            # Small delay to avoid rate limiting
            await asyncio.sleep(0.1)

        return servers


def save_servers_to_db(servers: List[MCPServerInfo]):
    """Save scraped servers to the database."""
    db = SessionLocal()

    try:
        print(f"Saving {len(servers)} servers to database...")

        # Clear existing entries
        db.query(MCPServerDirectory).delete()

        for server in servers:
            db_server = MCPServerDirectory(
                name=server.name,
                github_url=server.github_url,
                short_description=server.short_description,
                category=server.category,
                tags=server.tags,
                programming_language=server.programming_language,
                transport_types=server.transport_types,
                full_description=server.full_description,
                instructions=server.instructions,
                installation_commands=server.installation_commands,
                configuration_example=server.configuration_example,
                required_env_vars=server.required_env_vars,
                optional_env_vars=server.optional_env_vars,
                tools_provided=server.tools_provided,
                resources_provided=server.resources_provided,
                stars=server.stars,
                last_updated=server.last_updated,
                is_official=server.is_official,
                is_verified=server.is_verified,
                last_scraped=datetime.utcnow(),
            )
            db.add(db_server)

        db.commit()
        print("Successfully saved all servers to database!")

    except Exception as e:
        print(f"Error saving to database: {e}")
        db.rollback()
        raise
    finally:
        db.close()


async def main():
    """Main function to run the scraper."""
    print("Starting MCP servers directory scraper...")

    # Create tables if they don't exist
    Base.metadata.create_all(bind=engine)

    async with MCPServerScraper() as scraper:
        servers = await scraper.scrape_all_servers()

    save_servers_to_db(servers)

    print(f"Scraping completed! Found and saved {len(servers)} MCP servers.")


if __name__ == "__main__":
    asyncio.run(main())
