#!/usr/bin/env python3
"""
Database migration script using Alembic.
This script runs database migrations and can be used for deployments.
"""

import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import logging

from migrations import check_migration_status, run_migrations

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main():
    """Run database migrations."""
    try:
        logger.info("🔄 Starting database migration...")

        # Check current status
        current_rev = check_migration_status()
        if current_rev:
            logger.info(f"📍 Current migration revision: {current_rev}")

        # Run migrations
        success = run_migrations()

        if success:
            logger.info("✅ Database migration completed successfully!")
            return True
        else:
            logger.error("❌ Database migration failed!")
            return False

    except Exception as e:
        logger.error(f"❌ Error during migration: {e}")
        return False


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
