"""
Database migration utilities for Canvas MCP Client.
This module provides functions to run Alembic migrations programmatically.
"""

import logging
import subprocess
import sys
from pathlib import Path

logger = logging.getLogger(__name__)


def run_migrations():
    """Run database migrations using Alembic."""
    try:
        logger.info("Running database migrations...")

        # Get the directory where this script is located
        backend_dir = Path(__file__).parent

        # Run alembic upgrade head
        result = subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            cwd=backend_dir,
            capture_output=True,
            text=True,
            check=True,
        )

        logger.info("✅ Database migrations completed successfully")
        logger.debug(f"Migration output: {result.stdout}")
        return True

    except subprocess.CalledProcessError as e:
        logger.error(f"❌ Migration failed: {e}")
        logger.error(f"Migration stderr: {e.stderr}")
        logger.error(f"Migration stdout: {e.stdout}")
        return False
    except Exception as e:
        logger.error(f"❌ Error running migrations: {e}")
        return False


def check_migration_status():
    """Check the current migration status."""
    try:
        backend_dir = Path(__file__).parent

        result = subprocess.run(
            [sys.executable, "-m", "alembic", "current"], cwd=backend_dir, capture_output=True, text=True, check=True
        )

        current_rev = result.stdout.strip()
        logger.info(f"Current migration revision: {current_rev}")
        return current_rev

    except subprocess.CalledProcessError as e:
        logger.warning(f"Could not check migration status: {e}")
        return None
    except Exception as e:
        logger.error(f"Error checking migration status: {e}")
        return None


def create_migration(message: str, autogenerate: bool = True):
    """Create a new migration."""
    try:
        backend_dir = Path(__file__).parent

        cmd = [sys.executable, "-m", "alembic", "revision"]
        if autogenerate:
            cmd.append("--autogenerate")
        cmd.extend(["-m", message])

        result = subprocess.run(cmd, cwd=backend_dir, capture_output=True, text=True, check=True)

        logger.info(f"✅ Created migration: {message}")
        logger.debug(f"Migration output: {result.stdout}")
        return True

    except subprocess.CalledProcessError as e:
        logger.error(f"❌ Failed to create migration: {e}")
        logger.error(f"Migration stderr: {e.stderr}")
        return False
    except Exception as e:
        logger.error(f"❌ Error creating migration: {e}")
        return False
