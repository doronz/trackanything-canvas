#!/usr/bin/env python3
"""
Script to create Universal Widget System blueprints from individual JSON files.
"""

import json
import os
import sys
from pathlib import Path

# Add the backend directory to the path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session

from database import SessionLocal, WidgetBlueprint


def load_blueprints_from_json():
    """Load all blueprint JSON files from the blueprints directory."""
    blueprints_dir = Path(__file__).parent / "blueprints"
    blueprints = []

    if not blueprints_dir.exists():
        raise FileNotFoundError(f"Blueprints directory not found: {blueprints_dir}")

    # Load all JSON files in the blueprints directory
    for json_file in sorted(blueprints_dir.glob("*.json")):
        try:
            with open(json_file, "r", encoding="utf-8") as f:
                blueprint = json.load(f)
                blueprints.append(blueprint)
                print(f"   📄 Loaded: {json_file.name}")
        except Exception as e:
            print(f"   ❌ Error loading {json_file.name}: {e}")
            continue

    return blueprints


def destroy_existing_blueprints(db: Session, confirm: bool = False):
    """Destroy all existing widget blueprints."""
    if not confirm:
        print("⚠️  Destroy mode requires explicit confirmation. Use --destroy-all flag.")
        return False

    try:
        # Count existing blueprints
        count = db.query(WidgetBlueprint).count()

        if count == 0:
            print("✅ No existing blueprints to destroy.")
            return True

        # Delete all existing blueprints
        db.query(WidgetBlueprint).delete()
        db.commit()

        print(f"🗑️  Destroyed {count} existing widget blueprints.")
        return True

    except Exception as e:
        print(f"❌ Error destroying existing blueprints: {e}")
        db.rollback()
        return False


def create_universal_blueprints(force: bool = False, destroy_all: bool = False):
    """Create Universal Widget System blueprints from JSON files."""
    db = SessionLocal()

    try:
        print("🚀 Creating Universal Widget System blueprints...")
        print("📂 Loading blueprints from JSON files...")

        # Load blueprints from JSON files
        blueprint_data_list = load_blueprints_from_json()

        if not blueprint_data_list:
            print("❌ No blueprints found to create.")
            return

        print(f"📦 Found {len(blueprint_data_list)} blueprint definitions.")

        # Destroy existing blueprints if requested
        if destroy_all:
            if not destroy_existing_blueprints(db, confirm=True):
                return

        created_count = 0
        updated_count = 0
        skipped_count = 0

        for blueprint_data in blueprint_data_list:
            # Check if blueprint already exists
            existing = db.query(WidgetBlueprint).filter(WidgetBlueprint.name == blueprint_data["name"]).first()

            if existing:
                if force:
                    # Update existing blueprint
                    for key, value in blueprint_data.items():
                        setattr(existing, key, value)
                    print(f"   🔄 Updated: {blueprint_data['name']}")
                    updated_count += 1
                else:
                    print(f"   ⚠️  Skipped (already exists): {blueprint_data['name']}")
                    skipped_count += 1
                    continue
            else:
                # Create new blueprint
                blueprint = WidgetBlueprint(**blueprint_data)
                db.add(blueprint)
                print(f"   ✅ Created: {blueprint_data['name']}")
                created_count += 1

        db.commit()

        print(f"\n📊 Summary:")
        print(f"   ✅ Created: {created_count}")
        print(f"   🔄 Updated: {updated_count}")
        print(f"   ⚠️  Skipped: {skipped_count}")
        print(f"   📈 Total Processed: {created_count + updated_count + skipped_count}")

        if created_count > 0 or updated_count > 0:
            print(f"\n🎉 Universal Widget System blueprints are ready!")

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        db.rollback()
        raise
    finally:
        db.close()


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Create Universal Widget System blueprints from JSON files")
    parser.add_argument("--force", action="store_true", help="Update existing blueprints")
    parser.add_argument(
        "--destroy-all", action="store_true", help="⚠️  DESTROY all existing blueprints before creating new ones"
    )

    args = parser.parse_args()

    if args.destroy_all:
        print("⚠️  WARNING: This will DESTROY ALL existing widget blueprints!")
        response = input("Are you sure you want to continue? Type 'yes' to confirm: ")
        if response.lower() != "yes":
            print("❌ Operation cancelled.")
            return

    print("🔄 Universal Widget System Blueprint Creator")
    print("=" * 50)

    create_universal_blueprints(force=args.force, destroy_all=args.destroy_all)


if __name__ == "__main__":
    main()
