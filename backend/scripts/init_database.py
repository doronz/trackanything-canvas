#!/usr/bin/env python3
"""
Database Initialization Script

This script checks if the database exists and initializes it with:
1. Creating tables if they don't exist
2. Running widget blueprints setup
3. Scraping MCP servers directory

This is run automatically on container startup to ensure a ready-to-use database.
"""

import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import inspect

from database import Base, engine


def check_database_exists() -> bool:
    """Check if the database has tables."""
    try:
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        return len(tables) > 0
    except Exception as e:
        print(f"Error checking database: {e}")
        return False


def create_tables():
    """Create all database tables."""
    print("Creating database tables...")
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ Database tables created successfully!")
    except Exception as e:
        print(f"❌ Error creating tables: {e}")
        raise


def initialize_blueprints():
    """Initialize widget blueprints."""
    print("\n📦 Initializing widget blueprints...")
    try:
        from scripts.create_universal_blueprints import create_universal_blueprints

        create_universal_blueprints(force=False, destroy_all=False)
        print("✅ Widget blueprints initialized successfully!")
    except Exception as e:
        print(f"❌ Error initializing blueprints: {e}")
        raise


def initialize_mcp_servers():
    """Initialize MCP servers directory."""
    print("\n🌐 Initializing MCP servers directory...")
    try:
        import asyncio

        from scripts.scrape_awesome_mcp_servers import main as scrape_main

        asyncio.run(scrape_main())
        print("✅ MCP servers directory initialized successfully!")
    except Exception as e:
        print(f"❌ Error initializing MCP servers: {e}")
        # Don't raise here - MCP servers initialization is not critical
        # It might fail due to GitHub rate limiting
        print("⚠️  Continuing without MCP servers directory...")


def main():
    """Main initialization function."""
    print("=" * 60)
    print("🚀 Database Initialization")
    print("=" * 60)

    db_exists = check_database_exists()

    if db_exists:
        print("✅ Database already exists and has tables.")
        print("Skipping initialization...")
        return

    print("📊 Database is empty or doesn't exist.")
    print("Starting initialization process...\n")

    # Create tables
    create_tables()

    # Initialize blueprints
    initialize_blueprints()

    # Initialize MCP servers directory
    initialize_mcp_servers()

    print("\n" + "=" * 60)
    print("🎉 Database initialization completed!")
    print("=" * 60)


if __name__ == "__main__":
    main()
