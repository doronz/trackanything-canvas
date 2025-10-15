#!/bin/bash
set -e

echo "Starting backend container..."

# Run database initialization
echo "Checking database initialization..."
python -m scripts.init_database

# Start the application
echo "Starting FastAPI application..."
exec "$@"

