#!/usr/bin/env python3
"""
Database Reset and Migration Script for Canvas MCP Client

This script helps you completely reset and rebuild the database for testing with fresh data.
It handles the complete lifecycle: drop tables → recreate schema → run migrations → populate data.

Usage:
    python scripts/reset_database.py                    # Just reset and migrate
    python scripts/reset_database.py --with-blueprints  # Reset + migrate + create blueprints
    python scripts/reset_database.py --with-mock-data   # Reset + migrate + blueprints + mock dashboards
    python scripts/reset_database.py --full             # Complete reset with everything
"""

import os
import subprocess
import sys
from pathlib import Path

# Add the backend directory to the path
sys.path.insert(0, str(Path(__file__).parent.parent))

import argparse

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

# Set the correct DATABASE_URL for the reset operation
# When running inside Docker, the data directory is mounted at /app/data
# When running outside Docker, the data directory is at ../data relative to backend
if os.path.exists("/app/data"):
    # Running inside Docker container
    os.environ["DATABASE_URL"] = "sqlite:///./data/canvas_mcp.db"
else:
    # Running outside Docker (development)
    project_root = Path(__file__).parent.parent.parent
    data_path = project_root / "data" / "canvas_mcp.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{data_path}"
    print(f"🔍 Using database at: {data_path}")

from database import Base, SessionLocal, engine


def drop_all_tables():
    """Drop all tables in the database."""
    print("🗑️  Dropping all existing tables...")
    try:
        # Drop all tables
        Base.metadata.drop_all(bind=engine)
        print("✅ All tables dropped successfully")
        return True
    except Exception as e:
        print(f"❌ Error dropping tables: {e}")
        return False


def create_all_tables():
    """Create all tables from SQLAlchemy models."""
    print("🏗️  Creating all tables from models...")
    try:
        # Create all tables
        Base.metadata.create_all(bind=engine)
        print("✅ All tables created successfully")
        return True
    except Exception as e:
        print(f"❌ Error creating tables: {e}")
        return False


def run_alembic_migration():
    """Run Alembic migrations to ensure schema is up-to-date."""
    print("🔄 Running Alembic migrations...")
    try:
        # Change to backend directory for alembic
        backend_dir = Path(__file__).parent.parent

        # Stamp the database as the latest version
        result = subprocess.run(["alembic", "stamp", "head"], cwd=backend_dir, capture_output=True, text=True)

        if result.returncode != 0:
            print(f"⚠️  Alembic stamp warning: {result.stderr}")

        # Run any pending migrations
        result = subprocess.run(["alembic", "upgrade", "head"], cwd=backend_dir, capture_output=True, text=True)

        if result.returncode == 0:
            print("✅ Alembic migrations completed successfully")
            return True
        else:
            print(f"⚠️  Alembic migration warning: {result.stderr}")
            return True  # Continue even if migrations have warnings

    except Exception as e:
        print(f"❌ Error running Alembic migrations: {e}")
        return False


def create_universal_blueprints():
    """Create Universal Widget System blueprints."""
    print("📋 Creating Universal Widget System blueprints...")
    try:
        backend_dir = Path(__file__).parent.parent
        result = subprocess.run(
            ["python", "scripts/create_universal_blueprints.py", "--force"],
            cwd=backend_dir,
            capture_output=True,
            text=True,
        )

        if result.returncode == 0:
            print("✅ Universal Widget blueprints created successfully")
            # Print the output to show what was created
            if result.stdout:
                print(result.stdout)
            return True
        else:
            print(f"❌ Error creating blueprints: {result.stderr}")
            return False

    except Exception as e:
        print(f"❌ Error running blueprint creation: {e}")
        return False


def create_mock_dashboards():
    """Create comprehensive mock dashboards."""
    print("🎨 Creating mock dashboards with sample data...")
    try:
        backend_dir = Path(__file__).parent.parent
        result = subprocess.run(
            ["python", "scripts/create_mock_dashboards.py"], cwd=backend_dir, capture_output=True, text=True
        )

        if result.returncode == 0:
            print("✅ Mock dashboards created successfully")
            # Print the output to show what was created
            if result.stdout:
                print(result.stdout)
            return True
        else:
            print(f"❌ Error creating mock dashboards: {result.stderr}")
            return False

    except Exception as e:
        print(f"❌ Error running mock dashboard creation: {e}")
        return False


def add_demo_servers():
    """Add demo MCP servers for testing."""
    print("🔌 Adding demo MCP servers...")
    try:
        backend_dir = Path(__file__).parent.parent
        result = subprocess.run(
            ["python", "scripts/add_demo_servers.py"], cwd=backend_dir, capture_output=True, text=True
        )

        if result.returncode == 0:
            print("✅ Demo MCP servers added successfully")
            return True
        else:
            print(f"⚠️  Demo servers warning: {result.stderr}")
            return True  # Continue even if this fails

    except Exception as e:
        print(f"⚠️  Warning adding demo servers: {e}")
        return True  # Continue even if this fails


def is_interactive_environment():
    """Check if we're running in an interactive environment."""
    try:
        # Check if stdin is a tty (terminal)
        return sys.stdin.isatty()
    except:
        # If we can't determine, assume non-interactive
        return False


def verify_database_health():
    """Verify the database is working correctly."""
    print("🔍 Verifying database health...")
    try:
        db = SessionLocal()

        # Try to count tables to ensure they exist
        from database import Dashboard, Widget, WidgetBlueprint

        blueprint_count = db.query(WidgetBlueprint).count()
        dashboard_count = db.query(Dashboard).count()
        widget_count = db.query(Widget).count()

        print(f"   📋 Widget Blueprints: {blueprint_count}")
        print(f"   📊 Dashboards: {dashboard_count}")
        print(f"   🧩 Widgets: {widget_count}")

        db.close()
        print("✅ Database health check passed")
        return True

    except Exception as e:
        print(f"❌ Database health check failed: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Reset and rebuild Canvas MCP Client database")
    parser.add_argument("--with-blueprints", action="store_true", help="Create Universal Widget blueprints after reset")
    parser.add_argument(
        "--with-mock-data",
        action="store_true",
        help="Create mock dashboards and data after reset (includes blueprints)",
    )
    parser.add_argument(
        "--full", action="store_true", help="Complete reset with blueprints, mock data, and demo servers"
    )
    parser.add_argument(
        "--skip-confirmation",
        action="store_true",
        help="Skip confirmation prompt (auto-detected in Docker/non-interactive environments)",
    )

    args = parser.parse_args()

    print("🚀 Canvas MCP Client Database Reset Tool")
    print("=" * 50)

    # Determine what to do based on arguments
    create_blueprints = args.with_blueprints or args.with_mock_data or args.full
    create_mock_data = args.with_mock_data or args.full
    add_demo_data = args.full

    print(f"🎯 Reset Plan:")
    print(f"   • Drop & recreate all tables: ✅")
    print(f"   • Run Alembic migrations: ✅")
    print(f"   • Create widget blueprints: {'✅' if create_blueprints else '❌'}")
    print(f"   • Create mock dashboards: {'✅' if create_mock_data else '❌'}")
    print(f"   • Add demo MCP servers: {'✅' if add_demo_data else '❌'}")

    # Confirmation
    if not args.skip_confirmation:
        if not is_interactive_environment():
            print("\n🐳 Running in non-interactive environment (Docker), skipping confirmation prompt...")
        else:
            print("\n⚠️  WARNING: This will completely erase all existing data!")
            response = input("Are you sure you want to continue? Type 'yes' to confirm: ")
            if response.lower() != "yes":
                print("❌ Operation cancelled.")
                return 1

    print("\n🔄 Starting database reset process...")

    # Step 1: Drop all tables
    if not drop_all_tables():
        return 1

    # Step 2: Create all tables
    if not create_all_tables():
        return 1

    # Step 3: Run Alembic migrations
    if not run_alembic_migration():
        return 1

    # Step 4: Create blueprints if requested
    if create_blueprints:
        if not create_universal_blueprints():
            return 1

    # Step 5: Create mock data if requested
    if create_mock_data:
        if not create_mock_dashboards():
            return 1

    # Step 6: Add demo servers if requested
    if add_demo_data:
        if not add_demo_servers():
            print("⚠️  Demo servers failed but continuing...")

    # Step 7: Verify everything worked
    if not verify_database_health():
        return 1

    print("\n" + "=" * 50)
    print("✨ Database reset completed successfully!")
    print("🔗 Your fresh database is ready at: http://localhost:3000")

    if create_mock_data:
        print("\n💡 Mock dashboards available:")
        print("   🌍 Remote Team Project Hub")
        print("   🎨 Content Creator Studio")
        print("   🚀 Solo Founder Command Center")
        print("   💼 Freelancer Command Center")

    return 0


if __name__ == "__main__":
    exit(main())
