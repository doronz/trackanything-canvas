#!/usr/bin/env python3
"""
GitHub Awesome Remote MCP Servers Scraper

This script scrapes remote MCP servers from the GitHub repository
https://github.com/jaw9c/awesome-remote-mcp-servers and populates the local
database with server information while syncing with existing servers to avoid duplication.
"""

import asyncio
import os
import re
import sys
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import aiohttp

# BeautifulSoup not needed for markdown parsing

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import MCPServerDirectory, SessionLocal


@dataclass
class GitHubRemoteMCPServerInfo:
    """Data class for GitHub remote MCP server information."""

    name: str
    url: str
    description: str
    category: str = ""
    authentication: str = ""
    maintainer: str = ""
    tags: List[str] = None

    def __post_init__(self):
        if self.tags is None:
            self.tags = []


class GitHubRemoteMCPScraper:
    """Scraper for remote MCP servers from GitHub awesome-remote-mcp-servers repository."""

    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
        self.base_url = "https://raw.githubusercontent.com/jaw9c/awesome-remote-mcp-servers/main/README.md"

    async def __aenter__(self):
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/plain,text/markdown,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
        }
        self.session = aiohttp.ClientSession(headers=headers)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    async def fetch_readme_content(self) -> str:
        """Fetch the README.md content from GitHub repository."""
        print(f"Fetching README from: {self.base_url}")

        async with self.session.get(self.base_url) as response:
            if response.status == 200:
                content = await response.text()
                print(f"Successfully fetched README ({len(content)} characters)")
                return content
            else:
                raise Exception(f"Failed to fetch README: {response.status}")

    def parse_servers_from_markdown(self, markdown_content: str) -> List[GitHubRemoteMCPServerInfo]:
        """Parse the markdown content to extract remote MCP server information."""
        servers = []

        print("Parsing remote MCP servers from markdown...")

        # Debug: Save markdown to file for inspection
        with open("/tmp/github_awesome_mcp_servers.md", "w") as f:
            f.write(markdown_content)
        print("Saved markdown content to /tmp/github_awesome_mcp_servers.md for debugging")

        # Find the table section
        table_section = self._extract_table_section(markdown_content)
        if not table_section:
            print("Could not find the server table in markdown")
            return servers

        # Parse the table
        table_rows = self._parse_markdown_table(table_section)

        print(f"Found {len(table_rows)} potential server entries in table")

        for row_data in table_rows:
            if self._is_valid_server_row(row_data):
                server = self._create_server_from_row(row_data)
                if server:
                    servers.append(server)
                    print(f"Found server: {server.name} -> {server.url}")

        # Remove duplicates based on URL
        unique_servers = self._remove_duplicates(servers)

        print(f"Found {len(unique_servers)} unique remote MCP servers from GitHub")
        return unique_servers

    def _extract_table_section(self, content: str) -> str:
        """Extract the table section containing remote MCP servers."""
        # Look for the table that starts with Name, Category, URL, Authentication, Maintainer
        lines = content.split("\n")
        table_start = -1
        table_end = -1

        for i, line in enumerate(lines):
            # Find table header
            if "Name" in line and "Category" in line and "URL" in line and "Authentication" in line:
                table_start = i
                break

        if table_start == -1:
            return ""

        # Find table end (next major section or end of file)
        for i in range(table_start + 1, len(lines)):
            line = lines[i].strip()
            # Stop at next major heading or if we find empty lines followed by non-table content
            if (
                line.startswith("##")
                or line.startswith("###")
                or (not line and i + 1 < len(lines) and not lines[i + 1].strip().startswith("|"))
            ):
                table_end = i
                break

        if table_end == -1:
            table_end = len(lines)

        return "\n".join(lines[table_start:table_end])

    def _parse_markdown_table(self, table_content: str) -> List[Dict[str, str]]:
        """Parse markdown table into list of dictionaries."""
        lines = [line.strip() for line in table_content.split("\n") if line.strip()]
        rows = []

        # Find header and separator
        header_line = None
        separator_line = None
        data_start = -1

        for i, line in enumerate(lines):
            if "|" in line and "Name" in line:
                header_line = line
                if i + 1 < len(lines) and "---" in lines[i + 1]:
                    separator_line = lines[i + 1]
                    data_start = i + 2
                break

        if not header_line or data_start == -1:
            return rows

        # Extract column headers
        headers = [h.strip() for h in header_line.split("|")[1:-1]]  # Remove empty first/last
        print(f"Table headers: {headers}")

        # Parse data rows
        for i in range(data_start, len(lines)):
            line = lines[i]
            if not line or not line.startswith("|"):
                continue

            # Split by | and clean up
            cells = [cell.strip() for cell in line.split("|")[1:-1]]

            if len(cells) >= len(headers):
                row_data = {}
                for j, header in enumerate(headers):
                    if j < len(cells):
                        row_data[header.lower()] = cells[j]

                if row_data.get("name"):  # Only add if has a name
                    rows.append(row_data)

        return rows

    def _is_valid_server_row(self, row_data: Dict[str, str]) -> bool:
        """Check if a table row represents a valid server."""
        name = row_data.get("name", "").strip()
        url = row_data.get("url", "").strip()

        # Clean the name and URL from markdown formatting
        name = self._clean_markdown_links(name)
        url = self._extract_url_from_markdown(url)

        # Must have name and URL
        if not name or not url:
            print(f"Skipping row - missing name or URL: name='{name}', url='{url}'")
            return False

        # URL should be a valid HTTP(S) URL
        if not url.startswith(("http://", "https://")):
            print(f"Skipping row - invalid URL format: {url}")
            return False

        # Skip invalid names
        skip_names = {"name", "server", "example", "todo", "tbd", "coming soon", "..."}
        if name.lower() in skip_names:
            print(f"Skipping row - invalid name: {name}")
            return False

        return True

    def _create_server_from_row(self, row_data: Dict[str, str]) -> Optional[GitHubRemoteMCPServerInfo]:
        """Create a server info object from a table row."""
        try:
            name = row_data.get("name", "").strip()
            category = row_data.get("category", "").strip()
            url = row_data.get("url", "").strip()
            authentication = row_data.get("authentication", "").strip()
            maintainer = row_data.get("maintainer", "").strip()

            # Clean up markdown links in name
            name = self._clean_markdown_links(name)

            # Clean up markdown links in URL and extract actual URL
            url = self._extract_url_from_markdown(url)

            # Generate description from available information
            description = self._generate_description(name, category, authentication, maintainer)

            # Generate tags
            tags = self._generate_tags(name, category, authentication, maintainer)

            return GitHubRemoteMCPServerInfo(
                name=name,
                url=url,
                description=description,
                category=category,
                authentication=authentication,
                maintainer=maintainer,
                tags=tags,
            )

        except Exception as e:
            print(f"Error creating server from row {row_data}: {e}")
            return None

    def _clean_markdown_links(self, text: str) -> str:
        """Remove markdown link formatting and keep just the text."""
        # Pattern for [text](url)
        text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
        return text.strip()

    def _extract_url_from_markdown(self, text: str) -> str:
        """Extract URL from markdown link or return as-is if already a URL."""
        # Remove backticks (markdown code format)
        text = text.replace("`", "").strip()

        # If it's already a clean URL, return it
        if text.startswith(("http://", "https://")) and "[" not in text:
            return text

        # Extract URL from markdown link [text](url)
        match = re.search(r"\[([^\]]*)\]\(([^)]+)\)", text)
        if match:
            return match.group(2).strip()

        # If no markdown pattern, try to find URL in the text
        url_match = re.search(r"https?://[^\s\]]+", text)
        if url_match:
            return url_match.group(0)

        return text.strip()

    def _generate_description(self, name: str, category: str, authentication: str, maintainer: str) -> str:
        """Generate a description based on available information."""
        parts = []

        if category:
            parts.append(f"{category} service")

        if authentication:
            auth_desc = {
                "OAuth2.1": "with OAuth 2.1 authentication",
                "OAuth 2.1 🔐": "with OAuth 2.1 authentication (requires pre-registration)",
                "API Key": "with API key authentication",
                "Open": "with open access",
            }.get(authentication, f"with {authentication} authentication")
            parts.append(auth_desc)

        if maintainer and not maintainer.startswith("["):
            parts.append(f"maintained by {maintainer}")

        description = f"Remote MCP server for {name}"
        if parts:
            description += " - " + ", ".join(parts)

        return description

    def _generate_tags(self, name: str, category: str, authentication: str, maintainer: str) -> List[str]:
        """Generate appropriate tags for a remote server."""
        tags = ["remote", "github-awesome"]

        # Add category-based tags
        if category:
            category_tag = category.lower().replace(" ", "_").replace("&", "and").replace("/", "_")
            tags.append(category_tag)

        # Add authentication-based tags
        if authentication:
            auth_tag = authentication.lower().replace(" ", "_").replace(".", "_").replace("🔐", "").strip("_")
            tags.append(f"auth_{auth_tag}")

        # Add service-specific tags based on name
        service_tags = {
            "stripe": ["payments", "subscriptions", "financial"],
            "paypal": ["payments", "commerce"],
            "asana": ["project-management", "tasks"],
            "linear": ["issue-tracking", "development"],
            "slack": ["communication", "collaboration"],
            "github": ["development", "version-control"],
            "hubspot": ["crm", "sales", "marketing"],
            "canva": ["design", "graphics"],
            "netlify": ["hosting", "deployment"],
            "vercel": ["hosting", "serverless"],
            "zapier": ["automation", "integration"],
            "anthropic": ["ai", "llm"],
            "hugging": ["ai", "ml", "models"],
            "close": ["crm", "sales"],
            "needle": ["rag", "search"],
            "apify": ["web-scraping", "data-extraction"],
            "dappier": ["rag", "ai"],
            "telnyx": ["communications", "telephony"],
            "manifold": ["prediction", "markets"],
        }

        name_lower = name.lower()
        for service, service_tags_list in service_tags.items():
            if service in name_lower:
                tags.extend(service_tags_list)
                break

        return list(set(tags))  # Remove duplicates

    def _remove_duplicates(self, servers: List[GitHubRemoteMCPServerInfo]) -> List[GitHubRemoteMCPServerInfo]:
        """Remove duplicate servers based on URL."""
        unique_servers = []
        seen_urls = set()

        for server in servers:
            if server.url not in seen_urls:
                seen_urls.add(server.url)
                unique_servers.append(server)

        return unique_servers

    async def scrape_all_remote_servers(self) -> List[GitHubRemoteMCPServerInfo]:
        """Scrape all remote MCP servers from GitHub awesome list."""
        markdown_content = await self.fetch_readme_content()
        servers = self.parse_servers_from_markdown(markdown_content)
        return servers


def sync_github_servers_with_db(github_servers: List[GitHubRemoteMCPServerInfo]):
    """Sync GitHub servers with existing database to avoid duplication."""
    if not github_servers:
        print("No GitHub servers to sync.")
        return

    db = SessionLocal()

    try:
        print(f"Syncing {len(github_servers)} GitHub remote servers with database...")

        # Get existing servers to check for duplicates
        existing_servers = db.query(MCPServerDirectory).all()
        existing_urls = {server.github_url for server in existing_servers if server.github_url}
        existing_names = {server.name.lower() for server in existing_servers}

        print(f"Found {len(existing_urls)} existing server URLs in database")

        # Remove existing GitHub-sourced remote servers (those with "github-awesome" tag)
        github_sourced = db.query(MCPServerDirectory).filter(MCPServerDirectory.tags.contains(["github-awesome"])).all()

        for server in github_sourced:
            db.delete(server)

        print(f"Removed {len(github_sourced)} existing GitHub-sourced servers")

        # Add new GitHub servers, skipping duplicates
        added_count = 0
        skipped_count = 0

        for server in github_servers:
            # Check if URL already exists (from Anthropic or other sources)
            if server.url in existing_urls:
                print(f"Skipped duplicate URL: {server.name} -> {server.url}")
                skipped_count += 1
                continue

            # Check if name already exists (case-insensitive)
            if server.name.lower() in existing_names:
                print(f"Skipped duplicate name: {server.name}")
                skipped_count += 1
                continue

            db_server = MCPServerDirectory(
                name=server.name,
                github_url=server.url,
                short_description=server.description,
                category=server.category,
                tags=server.tags,
                programming_language="Remote",  # Remote servers for proper filtering
                transport_types=["http"],
                full_description=f"Remote MCP server from GitHub awesome list. {server.description}",
                instructions=f"This is a remote MCP server from the GitHub awesome list. Use the URL {server.url} to connect via HTTP transport. Authentication: {server.authentication}",
                installation_commands=[],
                configuration_example={"transport": "http", "url": server.url, "authentication": server.authentication},
                required_env_vars=[],
                optional_env_vars=[],
                tools_provided=[],
                resources_provided=[],
                stars=0,
                is_official=False,  # GitHub awesome list servers are community-maintained
                last_scraped=datetime.utcnow(),
            )
            db.add(db_server)
            added_count += 1
            print(f"Added: {server.name}")

        db.commit()
        print(f"Successfully synced GitHub servers! Added: {added_count}, Skipped duplicates: {skipped_count}")

    except Exception as e:
        print(f"Error syncing GitHub servers with database: {e}")
        db.rollback()
        raise
    finally:
        db.close()


async def main():
    """Main function to run the GitHub remote servers scraper."""
    print("Starting GitHub awesome-remote-mcp-servers scraper...")

    try:
        async with GitHubRemoteMCPScraper() as scraper:
            servers = await scraper.scrape_all_remote_servers()

        if servers:
            sync_github_servers_with_db(servers)
            print(f"Scraping completed! Found and synced {len(servers)} GitHub remote MCP servers.")
        else:
            print("No remote servers found. Please check the scraper logic.")

    except Exception as e:
        print(f"Error during scraping: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())
