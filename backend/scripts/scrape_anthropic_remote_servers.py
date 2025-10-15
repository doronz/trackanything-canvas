#!/usr/bin/env python3
"""
Anthropic Remote MCP Servers Scraper

This script scrapes remote MCP servers from Anthropic's official documentation
at https://docs.anthropic.com/en/docs/agents-and-tools/remote-mcp-servers
and populates the local database with server information.
"""

import asyncio
import os
import re
import sys
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import aiohttp
from bs4 import BeautifulSoup

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import MCPServerDirectory, SessionLocal


@dataclass
class RemoteMCPServerInfo:
    """Data class for remote MCP server information."""

    name: str
    url: str
    description: str
    category: str = ""
    tags: List[str] = None

    def __post_init__(self):
        if self.tags is None:
            self.tags = []


class AnthropicRemoteMCPScraper:
    """Scraper for remote MCP servers from Anthropic's documentation."""

    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
        self.base_url = "https://docs.anthropic.com/en/docs/agents-and-tools/remote-mcp-servers"

    async def __aenter__(self):
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
        }
        self.session = aiohttp.ClientSession(headers=headers)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    async def fetch_documentation_page(self) -> str:
        """Fetch the Anthropic remote MCP servers documentation page."""
        print(f"Fetching documentation from: {self.base_url}")

        async with self.session.get(self.base_url) as response:
            if response.status == 200:
                content = await response.text()
                print(f"Successfully fetched documentation ({len(content)} characters)")
                return content
            else:
                raise Exception(f"Failed to fetch documentation: {response.status}")

    def parse_servers_from_html(self, html_content: str) -> List[RemoteMCPServerInfo]:
        """Parse the HTML content to extract remote MCP server information."""
        soup = BeautifulSoup(html_content, "html.parser")
        servers = []

        print("Parsing remote MCP servers from HTML...")

        # Debug: Save HTML to file for inspection
        with open("/tmp/anthropic_page.html", "w") as f:
            f.write(html_content)
        print("Saved HTML content to /tmp/anthropic_page.html for debugging")

        # Find all headings to understand the structure
        all_headings = soup.find_all(["h1", "h2", "h3", "h4"])
        print(f"Found {len(all_headings)} headings:")
        for i, heading in enumerate(all_headings[:10]):  # Show first 10
            print(f"  {heading.name}: {heading.get_text().strip()[:100]}")

        # Look for server entries more broadly
        # Find all <strong> or <p> tags that might contain server information
        potential_servers = []

        # Method 1: Look for server-card divs with the specific structure
        for card in soup.find_all("div", class_="server-card"):
            # Find the strong tag containing the server name
            strong_tag = card.find("strong")
            if strong_tag:
                server_name = strong_tag.get_text().strip()

                # Find the URL from the parent link
                link_tag = strong_tag.find_parent("a")
                url = link_tag.get("href") if link_tag else None

                # Find the description in the following p tag
                description = ""
                desc_p = card.find("p")
                if desc_p:
                    description = desc_p.get_text().strip()

                if url and self._is_valid_server_name(server_name):
                    category = self._find_category_for_element(card)
                    potential_servers.append((server_name, url, description, category))
                    print(f"Method 1 found: {server_name} -> {url}")

        # Method 2: Fallback - Look for pattern like **ServerName** followed by description and URL
        if not potential_servers:
            for strong in soup.find_all(["strong", "b"]):
                server_name = strong.get_text().strip()
                if self._is_valid_server_name(server_name):
                    description, url = self._extract_server_details_improved(strong)
                    if url:
                        category = self._find_category_for_element(strong)
                        potential_servers.append((server_name, url, description, category))
                        print(f"Method 2 found: {server_name} -> {url}")

        # Method 3: Look for specific patterns in text content (if cards method didn't work)
        if not potential_servers:
            print("Trying text-based parsing...")
            current_category = ""
            for element in soup.find_all(["h3", "h4", "p", "strong"]):
                if element.name in ["h3", "h4"]:
                    text = element.get_text().strip()
                    if any(
                        word in text.lower()
                        for word in [
                            "development",
                            "project",
                            "database",
                            "payment",
                            "design",
                            "infrastructure",
                            "automation",
                        ]
                    ):
                        current_category = text
                        print(f"Found category: {current_category}")
                elif element.name in ["strong", "b"]:
                    server_name = element.get_text().strip()
                    if self._is_valid_server_name(server_name):
                        description, url = self._extract_server_details_improved(element)
                        if url:
                            potential_servers.append((server_name, url, description, current_category))
                            print(f"Method 3 found: {server_name} -> {url}")

        # Convert potential servers to RemoteMCPServerInfo objects
        for server_name, url, description, category in potential_servers:
            server = RemoteMCPServerInfo(
                name=server_name,
                url=url,
                description=description,
                category=category,
                tags=self._generate_tags(server_name, description, category),
            )
            servers.append(server)

        # Remove duplicates based on URL
        unique_servers = []
        seen_urls = set()
        for server in servers:
            if server.url not in seen_urls:
                seen_urls.add(server.url)
                unique_servers.append(server)

        print(f"Found {len(unique_servers)} unique remote MCP servers")
        return unique_servers

    def _parse_servers_in_element(self, element, category: str) -> List[RemoteMCPServerInfo]:
        """Parse servers within a specific HTML element."""
        servers = []

        # Look for server patterns: strong/bold text followed by description and URL
        for strong_tag in element.find_all(["strong", "b"]):
            server_name = strong_tag.get_text().strip()

            # Skip if it's not a proper server name
            if not server_name or len(server_name) < 2:
                continue

            # Skip common non-server words
            skip_words = ["url", "note", "multiple", "see", "generate", "looking", "was", "this", "page"]
            if server_name.lower() in skip_words:
                continue

            # Look for description and URL in the surrounding content
            description, url = self._extract_server_details(strong_tag)

            if url:  # Only add if we found a URL
                server = RemoteMCPServerInfo(
                    name=server_name,
                    url=url,
                    description=description,
                    category=category,
                    tags=self._generate_tags(server_name, description, category),
                )
                servers.append(server)
                print(f"Found server: {server_name} -> {url}")

        return servers

    def _parse_servers_fallback(self, soup: BeautifulSoup) -> List[RemoteMCPServerInfo]:
        """Fallback parsing method to find servers throughout the document."""
        servers = []
        current_category = ""

        # Find all headings and strong tags
        for element in soup.find_all(["h3", "strong", "b"]):
            if element.name == "h3":
                current_category = element.get_text().strip()
                continue

            if element.name in ["strong", "b"]:
                server_name = element.get_text().strip()

                # Filter out non-server names
                if (
                    not server_name
                    or len(server_name) < 2
                    or server_name.lower() in ["url", "note", "multiple", "see", "generate", "looking"]
                ):
                    continue

                description, url = self._extract_server_details(element)

                if url:
                    server = RemoteMCPServerInfo(
                        name=server_name,
                        url=url,
                        description=description,
                        category=current_category,
                        tags=self._generate_tags(server_name, description, current_category),
                    )
                    servers.append(server)
                    print(f"Found server: {server_name} -> {url}")

        return servers

    def _is_valid_server_name(self, name: str) -> bool:
        """Check if a string is a valid server name."""
        if not name or len(name) < 2:
            return False

        # Skip common non-server words
        skip_words = {
            "url",
            "note",
            "multiple",
            "see",
            "generate",
            "looking",
            "was",
            "this",
            "page",
            "helpful",
            "yes",
            "no",
            "overview",
            "documentation",
            "services",
            "available",
            "server",
            "servers",
            "mcp",
            "remote",
            "examples",
            "anthropic",
            "claude",
            "connect",
            "connecting",
            "instructions",
            "provided",
            "company",
            "companies",
        }

        if name.lower() in skip_words:
            return False

        # Must contain letters
        if not any(c.isalpha() for c in name):
            return False

        return True

    def _find_category_for_element(self, element) -> str:
        """Find the category that contains this element."""
        current = element

        # Walk backwards to find the nearest heading
        for _ in range(100):  # Increase search limit
            current = current.find_previous(["h3", "h4", "h2"])
            if current:
                text = current.get_text().strip()
                # Look for category keywords
                category_keywords = [
                    "development",
                    "project",
                    "database",
                    "payment",
                    "design",
                    "infrastructure",
                    "automation",
                    "testing",
                    "management",
                    "documentation",
                    "commerce",
                    "media",
                    "devops",
                ]
                if any(word in text.lower() for word in category_keywords):
                    return text

        return ""

    def _extract_server_details_improved(self, name_element) -> Tuple[str, str]:
        """Improved extraction of description and URL from around a server name element."""
        description = ""
        url = ""

        # Look in the same paragraph first
        parent = name_element.parent
        if parent:
            # Check for code tags containing URLs in the same paragraph
            for code_tag in parent.find_all("code"):
                potential_url = code_tag.get_text().strip()
                if potential_url.startswith(("http://", "https://")):
                    url = potential_url
                    break

        # If no URL found in same paragraph, look in following elements
        if not url:
            current = name_element
            for _ in range(10):  # Check next 10 siblings
                current = current.find_next_sibling()
                if not current:
                    break

                # Stop if we hit another server name (strong/bold)
                if current.name in ["strong", "b"] and self._is_valid_server_name(current.get_text().strip()):
                    break

                # Look for code tags with URLs
                if current.name == "code":
                    potential_url = current.get_text().strip()
                    if potential_url.startswith(("http://", "https://")):
                        url = potential_url
                        break

                # Look for URLs in nested code tags
                for code_tag in current.find_all("code") if hasattr(current, "find_all") else []:
                    potential_url = code_tag.get_text().strip()
                    if potential_url.startswith(("http://", "https://")):
                        url = potential_url
                        break

                if url:
                    break

        # Extract description from text following the server name
        description_parts = []
        current = name_element

        for _ in range(5):  # Look at next few elements
            current = current.find_next_sibling()
            if not current:
                break

            # Stop if we hit another server name
            if hasattr(current, "name") and current.name in ["strong", "b"]:
                if self._is_valid_server_name(current.get_text().strip()):
                    break

            # Extract text content
            if hasattr(current, "get_text"):
                text = current.get_text().strip()
                # Skip URL lines and empty lines
                if text and not text.startswith(("http://", "https://")) and text != "URL":
                    description_parts.append(text)
            elif isinstance(current, str):
                text = current.strip()
                if text and not text.startswith(("http://", "https://")):
                    description_parts.append(text)

        # Clean up description
        description = " ".join(description_parts).strip()
        description = re.sub(r"\s+", " ", description)  # Normalize whitespace
        description = description.replace("URL", "").strip()

        return description, url

    def _extract_server_details(self, name_element) -> Tuple[str, str]:
        """Extract description and URL from around a server name element."""
        description = ""
        url = ""

        # Look for description in the next few text nodes/elements
        current = name_element
        description_parts = []

        # Collect text until we hit another strong tag or find a URL
        for _ in range(10):  # Limit search to avoid going too far
            current = current.next_sibling
            if not current:
                break

            if hasattr(current, "name"):
                # If we hit another strong/bold tag, stop
                if current.name in ["strong", "b"]:
                    break

                # Look for URLs in code tags
                if current.name == "code":
                    potential_url = current.get_text().strip()
                    if potential_url.startswith("http"):
                        url = potential_url
                        break

                # Add text content
                text = current.get_text().strip()
                if text and not text.startswith("http"):
                    description_parts.append(text)
            else:
                # Text node
                text = str(current).strip()
                if text and not text.startswith("http"):
                    description_parts.append(text)

        # If no URL found in code tags, look more broadly
        if not url:
            parent = name_element.parent
            if parent:
                for code_tag in parent.find_all("code"):
                    potential_url = code_tag.get_text().strip()
                    if potential_url.startswith("http"):
                        url = potential_url
                        break

        # Clean up description
        description = " ".join(description_parts).strip()
        description = re.sub(r"\s+", " ", description)  # Normalize whitespace
        description = description.replace("URL", "").strip()

        return description, url

    def _generate_tags(self, name: str, description: str, category: str) -> List[str]:
        """Generate appropriate tags for a remote server."""
        tags = ["remote", "official"]

        # Add category-based tags
        if category:
            category_tag = category.lower().replace(" ", "_").replace("&", "and")
            tags.append(category_tag)

        # Add service-specific tags based on name and description
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
            "anthropic": ["ai", "llm"],
            "hugging": ["ai", "ml", "models"],
        }

        name_lower = name.lower()
        desc_lower = description.lower()

        for service, service_tags_list in service_tags.items():
            if service in name_lower or service in desc_lower:
                tags.extend(service_tags_list)
                break

        return list(set(tags))  # Remove duplicates

    async def scrape_all_remote_servers(self) -> List[RemoteMCPServerInfo]:
        """Scrape all remote MCP servers from Anthropic's documentation."""
        html_content = await self.fetch_documentation_page()
        servers = self.parse_servers_from_html(html_content)
        return servers


def save_remote_servers_to_db(servers: List[RemoteMCPServerInfo]):
    """Save scraped remote servers to the database."""
    if not servers:
        print("No servers to save.")
        return

    db = SessionLocal()

    try:
        print(f"Saving {len(servers)} remote servers to database...")

        # Remove existing remote servers (programming_language = "Remote")
        existing_remote = db.query(MCPServerDirectory).filter(MCPServerDirectory.programming_language == "Remote").all()

        for server in existing_remote:
            db.delete(server)

        print(f"Removed {len(existing_remote)} existing remote servers")

        # Add new remote servers
        added_count = 0
        for server in servers:
            db_server = MCPServerDirectory(
                name=server.name,
                github_url=server.url,  # Using github_url field for the service URL
                short_description=server.description,
                category=server.category,
                tags=server.tags,
                programming_language="Remote",  # Special designation for remote servers
                transport_types=["http"],  # Remote servers use HTTP
                full_description=f"Official remote MCP server from {server.name}. {server.description}",
                instructions=f"This is a remote MCP server. Use the URL {server.url} to connect via HTTP transport.",
                installation_commands=[],
                configuration_example={"transport": "http", "url": server.url},
                required_env_vars=[],
                optional_env_vars=[],
                tools_provided=[],
                resources_provided=[],
                stars=0,
                is_official=True,
                last_scraped=datetime.utcnow(),
            )
            db.add(db_server)
            added_count += 1
            print(f"Added: {server.name}")

        db.commit()
        print(f"Successfully saved {added_count} remote MCP servers to database!")

    except Exception as e:
        print(f"Error saving remote servers to database: {e}")
        db.rollback()
        raise
    finally:
        db.close()


async def main():
    """Main function to run the remote servers scraper."""
    print("Starting Anthropic remote MCP servers scraper...")

    try:
        async with AnthropicRemoteMCPScraper() as scraper:
            servers = await scraper.scrape_all_remote_servers()

        if servers:
            save_remote_servers_to_db(servers)
            print(f"Scraping completed! Found and saved {len(servers)} remote MCP servers.")
        else:
            print("No remote servers found. Please check the scraper logic.")

    except Exception as e:
        print(f"Error during scraping: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())
