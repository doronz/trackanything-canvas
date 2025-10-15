#!/usr/bin/env python3
"""
Script to populate the database with MCP Registry servers.
This will sync servers from the official MCP Registry (or use mock data for testing).
"""

import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncio
import logging

from sqlalchemy.orm import sessionmaker

from database import engine, get_db
from services.mcp_registry_service import MCPRegistryService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def populate_registry_servers():
    """Populate the database with MCP Registry servers."""
    try:
        logger.info("Starting MCP Registry sync...")

        # Get database session
        db = next(get_db())

        # Initialize registry service
        registry_service = MCPRegistryService()

        # Sync servers from registry
        result = await registry_service.sync_registry_servers(db)

        if result["success"]:
            logger.info(f"✅ Successfully synced MCP Registry servers!")
            logger.info(f"📊 Sync Statistics:")
            logger.info(f"   - New servers: {result['synced_count']}")
            logger.info(f"   - Updated servers: {result['updated_count']}")
            logger.info(f"   - Total servers: {result['total_servers']}")
            logger.info(f"   - Errors: {result['error_count']}")

            if result["error_count"] > 0:
                logger.warning(f"⚠️  {result['error_count']} servers had errors during sync")
        else:
            logger.error(f"❌ Failed to sync registry servers: {result.get('error', 'Unknown error')}")
            return False

        db.close()
        return True

    except Exception as e:
        logger.error(f"❌ Error during registry sync: {e}")
        return False


if __name__ == "__main__":
    success = asyncio.run(populate_registry_servers())
    sys.exit(0 if success else 1)
