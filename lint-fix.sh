#!/bin/bash

# Canvas MCP Client - Auto-fix Linting Issues Script
# This script automatically fixes common linting issues

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Unicode characters
CHECK_MARK="${GREEN}✓${NC}"
ARROW="${BLUE}→${NC}"
ROCKET="${CYAN}🚀${NC}"

print_header() {
    echo ""
    echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${CYAN}$1${NC}"
    echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}✗ Docker is not running. Please start Docker and try again.${NC}"
    exit 1
fi

# Check if containers are running
if ! docker compose ps | grep -q "backend.*Up" || ! docker compose ps | grep -q "frontend.*Up"; then
    echo -e "${YELLOW}⚠ Starting Docker containers...${NC}"
    docker compose up -d
    echo -e "${GREEN}Waiting for containers to be ready...${NC}"
    sleep 5
fi

echo -e "${BOLD}${CYAN}"
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║       Canvas MCP Client - Auto-fix Linting Issues            ║"
echo "║                                                               ║"
echo "║  This script automatically fixes common linting issues        ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Backend auto-fixes
print_header "🐍 Fixing Backend Issues"

echo -e "${ARROW} Running Black (code formatter)..."
docker compose exec -T backend black .
echo -e "${CHECK_MARK} ${GREEN}Black formatting applied${NC}"

echo -e "${ARROW} Running isort (import sorting)..."
if docker compose exec -T backend isort . 2>&1 | grep -v "git"; then
    echo -e "${CHECK_MARK} ${GREEN}Import sorting applied${NC}"
else
    echo -e "${CHECK_MARK} ${YELLOW}Import sorting applied (git warnings ignored)${NC}"
fi

# Frontend auto-fixes
print_header "⚛️  Fixing Frontend Issues"

echo -e "${ARROW} Running Prettier (code formatter)..."
docker compose exec -T frontend npm run format
echo -e "${CHECK_MARK} ${GREEN}Prettier formatting applied${NC}"

echo -e "${ARROW} Running ESLint (auto-fixable issues)..."
docker compose exec -T frontend npm run lint:fix
echo -e "${CHECK_MARK} ${GREEN}ESLint auto-fixes applied${NC}"

# Summary
print_header "✨ Auto-fix Complete"

echo ""
echo -e "${GREEN}${BOLD}Auto-fixable issues have been resolved!${NC}"
echo ""
echo -e "${YELLOW}Note:${NC} Some issues may require manual fixes:"
echo -e "  • Complex ESLint violations"
echo -e "  • TypeScript type errors"
echo -e "  • Flake8 issues (line length, complexity)"
echo ""
echo -e "${CYAN}Next steps:${NC}"
echo -e "  1. Review the changes: ${BOLD}git diff${NC}"
echo -e "  2. Run full linting: ${BOLD}./lint.sh${NC}"
echo -e "  3. Commit the fixes: ${BOLD}git add . && git commit -m 'fix: apply linting fixes'${NC}"
echo ""

