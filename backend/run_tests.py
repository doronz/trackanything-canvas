#!/usr/bin/env python3
"""
Test runner script for Canvas MCP Client backend tests.
This script provides convenient commands for running different types of tests.
"""

import argparse
import subprocess
import sys
from pathlib import Path


def run_command(cmd, cwd=None, env=None):
    """Run a command and return the result."""
    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=cwd, env=env, capture_output=False)
    return result.returncode == 0


def run_all_tests():
    """Run all tests."""
    return run_command(["python", "-m", "pytest", "tests/", "-v"])


def run_unit_tests():
    """Run unit tests only."""
    return run_command(["python", "-m", "pytest", "tests/", "-v", "-m", "not integration"])


def run_integration_tests():
    """Run integration tests only."""
    return run_command(["python", "-m", "pytest", "tests/", "-v", "-m", "integration"])


def run_api_tests():
    """Run API endpoint tests."""
    return run_command(["python", "-m", "pytest", "tests/test_dashboards.py", "tests/test_widgets.py", "-v"])


def run_service_tests():
    """Run service layer tests."""
    return run_command(["python", "-m", "pytest", "tests/test_mcp_service.py", "-v"])


def run_database_tests():
    """Run database tests."""
    return run_command(["python", "-m", "pytest", "tests/test_database.py", "-v"])


def run_with_coverage():
    """Run tests with coverage report."""
    return run_command(
        [
            "python",
            "-m",
            "pytest",
            "tests/",
            "-v",
            "--cov=.",
            "--cov-report=html",
            "--cov-report=term",
            "--cov-fail-under=70",
        ]
    )


def run_fast_tests():
    """Run fast tests only (excluding slow tests)."""
    return run_command(["python", "-m", "pytest", "tests/", "-v", "-m", "not slow"])


def run_specific_test(test_path):
    """Run a specific test file or test function."""
    return run_command(["python", "-m", "pytest", test_path, "-v"])


def check_test_environment():
    """Check if test environment is properly set up."""
    print("Checking test environment...")

    # Check if pytest is installed
    try:
        import pytest

        print(f"✓ pytest installed: {pytest.__version__}")
    except ImportError:
        print("✗ pytest not installed")
        return False

    # Check if required test dependencies are installed
    dependencies = ["httpx", "pytest_asyncio"]
    for dep in dependencies:
        try:
            __import__(dep)
            print(f"✓ {dep} installed")
        except ImportError:
            print(f"✗ {dep} not installed")
            return False

    # Check if test database can be created
    try:
        import os
        import tempfile

        from sqlalchemy import create_engine

        from database import Base

        with tempfile.NamedTemporaryFile(delete=False, suffix=".db") as tmp_file:
            test_db_path = tmp_file.name

        engine = create_engine(f"sqlite:///{test_db_path}")
        Base.metadata.create_all(bind=engine)
        engine.dispose()
        os.unlink(test_db_path)

        print("✓ Test database creation works")
        return True

    except Exception as e:
        print(f"✗ Test database creation failed: {e}")
        return False


def install_test_dependencies():
    """Install test dependencies."""
    print("Installing test dependencies...")
    deps = [
        "pytest>=7.4.0",
        "pytest-asyncio>=0.21.0",
        "pytest-mock>=3.11.0",
        "httpx>=0.24.0",
        "pytest-cov>=4.1.0",  # For coverage reports
        "pytest-html>=3.2.0",  # For HTML reports
        "pytest-timeout>=2.1.0",  # For test timeouts
    ]

    for dep in deps:
        success = run_command(["pip", "install", dep])
        if not success:
            print(f"Failed to install {dep}")
            return False

    print("✓ All test dependencies installed successfully")
    return True


def main():
    parser = argparse.ArgumentParser(description="Canvas MCP Client Backend Test Runner")
    parser.add_argument(
        "command",
        nargs="?",
        default="all",
        choices=[
            "all",
            "unit",
            "integration",
            "api",
            "service",
            "database",
            "coverage",
            "fast",
            "check",
            "install",
            "specific",
        ],
        help="Test command to run",
    )
    parser.add_argument("--path", help="Specific test path (for 'specific' command)")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")

    args = parser.parse_args()

    # Change to backend directory
    backend_dir = Path(__file__).parent
    print(f"Running tests from: {backend_dir}")

    success = True

    if args.command == "all":
        success = run_all_tests()
    elif args.command == "unit":
        success = run_unit_tests()
    elif args.command == "integration":
        success = run_integration_tests()
    elif args.command == "api":
        success = run_api_tests()
    elif args.command == "service":
        success = run_service_tests()
    elif args.command == "database":
        success = run_database_tests()
    elif args.command == "coverage":
        success = run_with_coverage()
    elif args.command == "fast":
        success = run_fast_tests()
    elif args.command == "check":
        success = check_test_environment()
    elif args.command == "install":
        success = install_test_dependencies()
    elif args.command == "specific":
        if not args.path:
            print("Error: --path required for 'specific' command")
            sys.exit(1)
        success = run_specific_test(args.path)

    if success:
        print("\n✅ Tests completed successfully!")
        sys.exit(0)
    else:
        print("\n❌ Tests failed!")
        sys.exit(1)


if __name__ == "__main__":
    main()
