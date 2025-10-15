#!/bin/bash

# Canvas MCP Client - Comprehensive Linting Script
# This script runs all linters for both backend and frontend in Docker
# Run this before pushing your PR to ensure code quality

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Unicode characters for better output
CHECK_MARK="${GREEN}✓${NC}"
CROSS_MARK="${RED}✗${NC}"
ARROW="${BLUE}→${NC}"
ROCKET="${CYAN}🚀${NC}"

# Track overall status
BACKEND_STATUS=0
FRONTEND_STATUS=0
OVERALL_STATUS=0

# Function to print section headers
print_header() {
    echo ""
    echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${CYAN}$1${NC}"
    echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Function to print subsection
print_subsection() {
    echo ""
    echo -e "${BOLD}$1${NC}"
    echo -e "${BLUE}────────────────────────────────────────────────────────────${NC}"
}

# Function to run a command and handle its output
run_check() {
    local name=$1
    local command=$2

    echo -e "${ARROW} Running ${BOLD}$name${NC}..."

    if eval "$command" > /tmp/lint_output.txt 2>&1; then
        echo -e "  ${CHECK_MARK} ${GREEN}$name passed${NC}"
        return 0
    else
        echo -e "  ${CROSS_MARK} ${RED}$name failed${NC}"
        echo ""
        echo -e "${YELLOW}Error output:${NC}"
        cat /tmp/lint_output.txt | head -50
        if [ $(wc -l < /tmp/lint_output.txt) -gt 50 ]; then
            echo -e "${YELLOW}... (output truncated, see full output above)${NC}"
        fi
        echo ""
        return 1
    fi
}

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        echo -e "${CROSS_MARK} ${RED}Docker is not running. Please start Docker and try again.${NC}"
        exit 1
    fi
}

# Check if containers are running
check_containers() {
    print_header "${ROCKET} Checking Docker Containers"

    if ! docker compose ps | grep -q "backend.*Up"; then
        echo -e "${YELLOW}⚠ Backend container is not running. Starting containers...${NC}"
        docker compose up -d
        echo -e "${GREEN}Waiting for containers to be ready...${NC}"
        sleep 5
    fi

    if ! docker compose ps | grep -q "frontend.*Up"; then
        echo -e "${YELLOW}⚠ Frontend container is not running. Starting containers...${NC}"
        docker compose up -d
        echo -e "${GREEN}Waiting for containers to be ready...${NC}"
        sleep 5
    fi

    echo -e "${CHECK_MARK} ${GREEN}Docker containers are ready${NC}"
}

# Backend linting
run_backend_linting() {
    print_header "🐍 Backend (Python) Linting"

    local backend_failed=0

    # Black - Code formatter (check mode)
    print_subsection "1. Black (Code Formatter)"
    if run_check "Black format check" "docker compose exec -T backend black --check ."; then
        :
    else
        backend_failed=1
        echo -e "${YELLOW}💡 Tip: Run 'docker compose exec backend black .' to auto-fix formatting${NC}"
    fi

    # Flake8 - Style guide enforcement
    print_subsection "2. Flake8 (Style Guide)"
    if run_check "Flake8" "docker compose exec -T backend flake8 ."; then
        :
    else
        backend_failed=1
    fi

    # isort - Import sorting (check mode)
    print_subsection "3. isort (Import Sorting)"
    if run_check "isort check" "docker compose exec -T backend isort --check-only ."; then
        :
    else
        backend_failed=1
        echo -e "${YELLOW}💡 Tip: Run 'docker compose exec backend isort .' to auto-fix imports${NC}"
    fi

    # MyPy - Static type checking (warnings allowed)
    print_subsection "4. MyPy (Type Checking)"
    if run_check "MyPy" "docker compose exec -T backend mypy ."; then
        :
    else
        echo -e "${YELLOW}⚠ MyPy warnings detected (not blocking)${NC}"
        # Don't fail on MyPy warnings
    fi

    # Pylint - Comprehensive linting
    print_subsection "5. Pylint (Code Quality)"
    if run_check "Pylint" "docker compose exec -T backend pylint *.py routers/ services/ scripts/ --exit-zero"; then
        :
    else
        echo -e "${YELLOW}⚠ Pylint issues detected (not blocking)${NC}"
        # Don't fail on Pylint warnings
    fi

    return $backend_failed
}

# Frontend linting
run_frontend_linting() {
    print_header "⚛️  Frontend (TypeScript/React) Linting"

    local frontend_failed=0

    # Prettier - Code formatter (check mode)
    print_subsection "1. Prettier (Code Formatter)"
    if run_check "Prettier format check" "docker compose exec -T frontend npm run format:check"; then
        :
    else
        frontend_failed=1
        echo -e "${YELLOW}💡 Tip: Run 'docker compose exec frontend npm run format' to auto-fix formatting${NC}"
    fi

    # ESLint - JavaScript/TypeScript linting
    print_subsection "2. ESLint (Code Quality)"
    if run_check "ESLint" "docker compose exec -T frontend npm run lint"; then
        :
    else
        frontend_failed=1
        echo -e "${YELLOW}💡 Tip: Run 'docker compose exec frontend npm run lint:fix' to auto-fix issues${NC}"
    fi

    # TypeScript - Type checking
    print_subsection "3. TypeScript (Type Checking)"
    if run_check "TypeScript check" "docker compose exec -T frontend npm run type-check"; then
        :
    else
        frontend_failed=1
    fi

    return $frontend_failed
}

# Print summary
print_summary() {
    print_header "📊 Linting Summary"

    echo ""
    if [ $BACKEND_STATUS -eq 0 ]; then
        echo -e "${CHECK_MARK} ${GREEN}Backend linting: PASSED${NC}"
    else
        echo -e "${CROSS_MARK} ${RED}Backend linting: FAILED${NC}"
    fi

    if [ $FRONTEND_STATUS -eq 0 ]; then
        echo -e "${CHECK_MARK} ${GREEN}Frontend linting: PASSED${NC}"
    else
        echo -e "${CROSS_MARK} ${RED}Frontend linting: FAILED${NC}"
    fi

    echo ""
    echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    if [ $OVERALL_STATUS -eq 0 ]; then
        echo -e "${CHECK_MARK} ${BOLD}${GREEN}All linting checks PASSED!${NC}"
        echo -e "${GREEN}Your code is ready to be pushed! 🎉${NC}"
    else
        echo -e "${CROSS_MARK} ${BOLD}${RED}Some linting checks FAILED${NC}"
        echo -e "${YELLOW}Please fix the issues above before pushing your PR${NC}"
        echo ""
        echo -e "${BOLD}Quick Fix Commands:${NC}"
        echo -e "  ${CYAN}Backend:${NC}"
        echo -e "    docker compose exec backend black ."
        echo -e "    docker compose exec backend isort ."
        echo ""
        echo -e "  ${CYAN}Frontend:${NC}"
        echo -e "    docker compose exec frontend npm run format"
        echo -e "    docker compose exec frontend npm run lint:fix"
    fi

    echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# Main execution
main() {
    echo -e "${BOLD}${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║                                                               ║"
    echo "║          Canvas MCP Client - Linting Script                  ║"
    echo "║                                                               ║"
    echo "║  This script runs all linters for backend and frontend       ║"
    echo "║  in Docker to ensure code quality before pushing your PR     ║"
    echo "║                                                               ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"

    # Check Docker
    check_docker

    # Check containers
    check_containers

    # Run backend linting
    if run_backend_linting; then
        BACKEND_STATUS=0
    else
        BACKEND_STATUS=1
        OVERALL_STATUS=1
    fi

    # Run frontend linting
    if run_frontend_linting; then
        FRONTEND_STATUS=0
    else
        FRONTEND_STATUS=1
        OVERALL_STATUS=1
    fi

    # Print summary
    print_summary

    # Exit with appropriate code
    exit $OVERALL_STATUS
}

# Run main function
main

