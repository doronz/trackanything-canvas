"""
Webpage content fetching API routes.
This module handles webpage metadata extraction and content fetching for the Webpage Preview widget.
"""

import logging
import re
from typing import Dict, Optional
from urllib.parse import urljoin, urlparse

import requests  # type: ignore
from bs4 import BeautifulSoup
from fastapi import APIRouter, Query
from pydantic import BaseModel, HttpUrl

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/webpage", tags=["Webpage"])

# Pydantic models for request/response


class WebpageMetadataRequest(BaseModel):
    url: HttpUrl


class WebpageMetadata(BaseModel):
    url: str
    title: Optional[str] = None
    description: Optional[str] = None
    favicon: Optional[str] = None
    og_title: Optional[str] = None
    og_description: Optional[str] = None
    og_image: Optional[str] = None
    og_type: Optional[str] = None
    og_site_name: Optional[str] = None
    twitter_title: Optional[str] = None
    twitter_description: Optional[str] = None
    twitter_image: Optional[str] = None
    twitter_card: Optional[str] = None
    canonical_url: Optional[str] = None
    content_type: Optional[str] = None
    status_code: int
    error: Optional[str] = None


class WebpageContentResponse(BaseModel):
    metadata: WebpageMetadata
    can_embed: bool


def clean_text(text: str) -> str:
    """Clean and normalize text content."""
    if not text:
        return None

    # Remove extra whitespace and normalize
    text = re.sub(r"\s+", " ", text.strip())

    # Limit length to prevent overly long descriptions
    if len(text) > 500:
        text = text[:497] + "..."

    return text


def get_absolute_url(base_url: str, relative_url: str) -> str:
    """Convert relative URL to absolute URL."""
    if not relative_url:
        return None

    try:
        return urljoin(base_url, relative_url)
    except Exception:
        return relative_url


def extract_favicon(soup: BeautifulSoup, base_url: str) -> Optional[str]:
    """Extract favicon URL from HTML."""

    # Look for various favicon link tags
    favicon_selectors = [
        'link[rel="icon"]',
        'link[rel="shortcut icon"]',
        'link[rel="apple-touch-icon"]',
        'link[rel="apple-touch-icon-precomposed"]',
    ]

    for selector in favicon_selectors:
        link = soup.select_one(selector)
        if link and link.get("href"):
            return get_absolute_url(base_url, link["href"])

    # Fallback to /favicon.ico
    try:
        parsed_url = urlparse(base_url)
        favicon_url = f"{parsed_url.scheme}://{parsed_url.netloc}/favicon.ico"

        # Quick check if favicon.ico exists (optional)
        # We'll return it anyway and let the client handle 404s
        return favicon_url
    except Exception:
        return None


def can_embed_url(response_headers: Dict[str, str]) -> bool:
    """Check if URL can be embedded in an iframe based on response headers."""

    # Check X-Frame-Options header
    x_frame_options = response_headers.get("x-frame-options", "").lower()
    if x_frame_options in ["deny", "sameorigin"]:
        return False

    # Check Content-Security-Policy header
    csp = response_headers.get("content-security-policy", "").lower()
    if "frame-ancestors" in csp and "'none'" in csp:
        return False

    return True


@router.post("/metadata", response_model=WebpageContentResponse)
async def fetch_webpage_metadata(request: WebpageMetadataRequest):
    """
    Fetch webpage metadata including Open Graph tags, Twitter Cards, and basic HTML meta tags.
    Also checks if the webpage can be embedded in an iframe.
    """

    url = str(request.url)

    try:
        # Set up headers to mimic a real browser
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate",
            "Connection": "keep-alive",
        }

        # Make request with timeout
        response = requests.get(url, headers=headers, timeout=10, allow_redirects=True)
        response.raise_for_status()

        # Parse HTML content
        soup = BeautifulSoup(response.content, "html.parser")

        # Extract basic metadata
        title_tag = soup.find("title")
        title = clean_text(title_tag.string) if title_tag else None

        description_tag = soup.find("meta", attrs={"name": "description"})
        description = clean_text(description_tag.get("content")) if description_tag else None

        # Extract Open Graph metadata
        og_title_tag = soup.find("meta", attrs={"property": "og:title"})
        og_title = clean_text(og_title_tag.get("content")) if og_title_tag else None

        og_description_tag = soup.find("meta", attrs={"property": "og:description"})
        og_description = clean_text(og_description_tag.get("content")) if og_description_tag else None

        og_image_tag = soup.find("meta", attrs={"property": "og:image"})
        og_image = get_absolute_url(url, og_image_tag.get("content")) if og_image_tag else None

        og_type_tag = soup.find("meta", attrs={"property": "og:type"})
        og_type = og_type_tag.get("content") if og_type_tag else None

        og_site_name_tag = soup.find("meta", attrs={"property": "og:site_name"})
        og_site_name = og_site_name_tag.get("content") if og_site_name_tag else None

        # Extract Twitter Card metadata
        twitter_title_tag = soup.find("meta", attrs={"name": "twitter:title"})
        twitter_title = clean_text(twitter_title_tag.get("content")) if twitter_title_tag else None

        twitter_description_tag = soup.find("meta", attrs={"name": "twitter:description"})
        twitter_description = clean_text(twitter_description_tag.get("content")) if twitter_description_tag else None

        twitter_image_tag = soup.find("meta", attrs={"name": "twitter:image"})
        twitter_image = get_absolute_url(url, twitter_image_tag.get("content")) if twitter_image_tag else None

        twitter_card_tag = soup.find("meta", attrs={"name": "twitter:card"})
        twitter_card = twitter_card_tag.get("content") if twitter_card_tag else None

        # Extract canonical URL
        canonical_tag = soup.find("link", attrs={"rel": "canonical"})
        canonical_url = canonical_tag.get("href") if canonical_tag else None

        # Extract favicon
        favicon = extract_favicon(soup, url)

        # Check if page can be embedded
        can_embed = can_embed_url(dict(response.headers))

        # Build metadata object
        metadata = WebpageMetadata(
            url=url,
            title=title,
            description=description,
            favicon=favicon,
            og_title=og_title,
            og_description=og_description,
            og_image=og_image,
            og_type=og_type,
            og_site_name=og_site_name,
            twitter_title=twitter_title,
            twitter_description=twitter_description,
            twitter_image=twitter_image,
            twitter_card=twitter_card,
            canonical_url=canonical_url,
            content_type=response.headers.get("content-type"),
            status_code=response.status_code,
        )

        return WebpageContentResponse(metadata=metadata, can_embed=can_embed)

    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching webpage {url}: {str(e)}")

        # Return error metadata
        error_metadata = WebpageMetadata(
            url=url,
            status_code=getattr(e.response, "status_code", 500) if hasattr(e, "response") else 500,
            error=f"Request failed: {str(e)}",
        )

        return WebpageContentResponse(metadata=error_metadata, can_embed=False)

    except Exception as e:
        logger.error(f"Unexpected error processing webpage {url}: {str(e)}")

        # Return error metadata
        error_metadata = WebpageMetadata(url=url, status_code=500, error=f"Processing failed: {str(e)}")

        return WebpageContentResponse(metadata=error_metadata, can_embed=False)


@router.get("/check-embed")
async def check_embed_capability(url: str = Query(..., description="URL to check for embed capability")):
    """
    Quick check to see if a URL can be embedded in an iframe.
    This is a lightweight endpoint for real-time checking.
    """

    try:
        # Make HEAD request to check headers without downloading content
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }

        response = requests.head(url, headers=headers, timeout=5, allow_redirects=True)
        response.raise_for_status()

        can_embed = can_embed_url(dict(response.headers))

        return {"url": url, "can_embed": can_embed, "status_code": response.status_code, "final_url": response.url}

    except requests.exceptions.RequestException as e:
        logger.error(f"Error checking embed capability for {url}: {str(e)}")

        return {
            "url": url,
            "can_embed": False,
            "status_code": getattr(e.response, "status_code", 500) if hasattr(e, "response") else 500,
            "error": str(e),
        }
