#!/bin/bash

# Canvas MCP Client Database Reset Helper Script
# This script provides easy access to database reset functionality via Docker

echo "🚀 Canvas MCP Client Database Reset Helper"
echo "=========================================="

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose not found. Please install Docker and docker-compose."
    exit 1
fi

# Show options
echo ""
echo "Choose reset option:"
echo "1) Basic reset (just tables + migrations)"
echo "2) Reset + Widget Blueprints"
echo "3) Reset + Blueprints + Mock Dashboards"
echo "4) Full reset (everything + demo servers)"
echo "5) Custom command"
echo ""

read -p "Enter your choice (1-5): " choice

case $choice in
    1)
        echo "🔄 Running basic database reset..."
        docker-compose exec backend python scripts/reset_database.py --skip-confirmation
        ;;
    2)
        echo "🔄 Running reset with blueprints..."
        docker-compose exec backend python scripts/reset_database.py --with-blueprints --skip-confirmation
        ;;
    3)
        echo "🔄 Running reset with mock data..."
        docker-compose exec backend python scripts/reset_database.py --with-mock-data --skip-confirmation
        ;;
    4)
        echo "🔄 Running full reset..."
        docker-compose exec backend python scripts/reset_database.py --full --skip-confirmation
        ;;
    5)
        echo "Available options:"
        echo "  --with-blueprints    Create Universal Widget blueprints"
        echo "  --with-mock-data     Create mock dashboards (includes blueprints)"
        echo "  --full               Complete reset with everything"
        echo "  --skip-confirmation  Skip confirmation prompt"
        echo ""
        read -p "Enter custom arguments: " custom_args
        echo "🔄 Running custom reset: $custom_args"
        docker-compose exec backend python scripts/reset_database.py $custom_args
        ;;
    *)
        echo "❌ Invalid choice. Exiting."
        exit 1
        ;;
esac

echo ""
echo "✨ Database reset completed!"
echo "🔗 Access your app at: http://localhost:3000"
