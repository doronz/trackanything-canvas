# Linting Setup for Canvas MCP Client

This document describes the linting configuration added to ensure code quality across the project.

## Backend (Python) Linters

### Installed Linters

Added to `backend/requirements.txt`:
- **Black** (v24.0.0+): Code formatter
- **Flake8** (v7.0.0+): Style guide enforcement
- **isort** (v5.13.0+): Import sorting
- **MyPy** (v1.8.0+): Static type checking
- **Pylint** (v3.0.0+): Comprehensive linting

### Configuration Files

#### `.flake8`
- Max line length: 120
- Excludes: `.git`, `__pycache__`, `.pytest_cache`, `.mypy_cache`, `venv`, `alembic/versions`
- Ignores: E203, E501, W503, E402
- Per-file ignores: `__init__.py:F401`

#### `pyproject.toml`
Contains configuration for:
- **Black**: Line length 120, Python 3.11 target
- **isort**: Black profile, line length 120
- **MyPy**: Python 3.11, various warnings enabled
- **Pylint**: Max line length 120, disabled: C0111, C0103, R0903, R0913, W0212

### Running Backend Linters

```bash
# Inside Docker container
docker compose exec backend black .
docker compose exec backend flake8 .
docker compose exec backend isort .
docker compose exec backend mypy .
docker compose exec backend pylint .

# Check mode (no changes)
docker compose exec backend black --check .
docker compose exec backend isort --check-only .
```

## Frontend (TypeScript/JavaScript) Linters

### Installed Linters

Added to `frontend/package.json`:
- **ESLint** (v8.57.1): JavaScript/TypeScript linting
- **Prettier** (v3.2.5): Code formatter
- **@typescript-eslint/eslint-plugin** (v6.21.0): TypeScript linting rules
- **@typescript-eslint/parser** (v6.21.0): TypeScript parser
- **eslint-config-prettier** (v9.1.0): Prettier integration
- **eslint-plugin-prettier** (v5.1.3): Prettier as ESLint plugin

### Configuration Files

#### `.prettierrc`
- Semi: true
- Single quotes: true
- Print width: 100
- Tab width: 2
- Trailing comma: ES5
- Arrow parens: avoid

#### `.eslintrc.json`
- Extends: next/core-web-vitals, @typescript-eslint/recommended, prettier
- Plugins: @typescript-eslint, prettier
- Rules: prettier/prettier as error, unused vars warnings, console warnings (allow error/warn)

### Running Frontend Linters

```bash
# Inside Docker container
docker compose exec frontend npm run lint
docker compose exec frontend npm run lint:fix
docker compose exec frontend npm run format
docker compose exec frontend npm run format:check
docker compose exec frontend npm run type-check

# On host (if node_modules installed)
cd frontend
npm run lint
npm run lint:fix
npm run format
npm run format:check
npm run type-check
```

## GitHub Actions CI Integration

### Workflow Structure

The `.github/workflows/ci.yml` now includes dedicated linting jobs:

#### 1. `backend-lint` (Required)
- Runs Black formatter check
- Runs Flake8
- Runs isort check
- Runs MyPy type checking (warnings allowed)

#### 2. `frontend-lint` (Required)
- Runs Prettier format check
- Runs ESLint
- Runs TypeScript type check

#### 3. Other Jobs
- `backend-tests`: Depends on `backend-lint`
- `frontend-checks`: Depends on `frontend-lint`
- `docker-build`: Tests Docker builds
- `security-scan`: Runs Trivy security scanning

### PR Requirements

All pull requests MUST pass:
1. Backend linting (Black, Flake8, isort)
2. Frontend linting (Prettier, ESLint, TypeScript)
3. Backend tests
4. Frontend build
5. Docker builds

Note: MyPy warnings are allowed (`continue-on-error: true`) to not block PRs while code is being gradually typed.

## Quick Linting Scripts 🚀

### Run All Linters (Recommended)

The easiest way to check your code before pushing a PR:

```bash
# Run all linters (backend + frontend)
./lint.sh

# This will:
# ✓ Check backend formatting (Black, Flake8, isort, MyPy, Pylint)
# ✓ Check frontend formatting (Prettier, ESLint, TypeScript)
# ✓ Show clear pass/fail results
# ✓ Provide quick-fix suggestions
```

### Auto-fix Common Issues

Automatically fix most formatting and style issues:

```bash
# Auto-fix all fixable issues
./lint-fix.sh

# This will:
# ✓ Apply Black formatting (backend)
# ✓ Sort imports with isort (backend)
# ✓ Apply Prettier formatting (frontend)
# ✓ Fix ESLint auto-fixable issues (frontend)
```

### Recommended Workflow

```bash
# 1. Make your code changes
vim backend/routers/my_feature.py

# 2. Auto-fix formatting issues
./lint-fix.sh

# 3. Review the changes
git diff

# 4. Run full linting to check for remaining issues
./lint.sh

# 5. If all passes, commit and push
git add .
git commit -m "feat: add my feature"
git push
```

## Pre-commit Workflow (Manual)

### Local Setup

You can also run linters manually before committing:

```bash
# Backend
cd backend
black .
flake8 .
isort .
mypy .

# Frontend
cd frontend
npm run lint:fix
npm run format
npm run type-check
```

### VS Code Integration

Add to `.vscode/settings.json`:

```json
{
  "python.linting.enabled": true,
  "python.linting.flake8Enabled": true,
  "python.linting.pylintEnabled": true,
  "python.linting.mypyEnabled": true,
  "python.formatting.provider": "black",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.organizeImports": true
  },
  "[python]": {
    "editor.defaultFormatter": "ms-python.black-formatter",
    "editor.formatOnSave": true
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.formatOnSave": true
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.formatOnSave": true
  }
}
```

## IDE Extensions

### VS Code
- **Python**: ms-python.python
- **Black Formatter**: ms-python.black-formatter
- **Flake8**: ms-python.flake8
- **Pylance**: ms-python.vscode-pylance (includes MyPy)
- **ESLint**: dbaeumer.vscode-eslint
- **Prettier**: esbenp.prettier-vscode

### PyCharm/WebStorm
- Built-in support for all these linters
- Configure in: Preferences → Tools → External Tools / File Watchers

## Troubleshooting

### Backend Issues

**Black conflicts with other formatters:**
- Black is opinionated. Run `black .` and commit the changes.

**Flake8 line length errors:**
- Configured to 120 characters. Refactor long lines or add `# noqa` for exceptions.

**MyPy import errors:**
- Add `# type: ignore` for third-party imports without stubs.

### Frontend Issues

**ESLint/Prettier conflicts:**
- Already configured via `eslint-config-prettier`. Run `npm run format` then `npm run lint:fix`.

**TypeScript errors:**
- Check `tsconfig.json` settings. Use `// @ts-ignore` sparingly.

### CI Failures

**Linting fails in CI but passes locally:**
- Ensure you're running the same versions.
- Check `.dockerignore` and `.gitignore` for excluded files.
- Commit all configuration files.

**MyPy warnings:**
- These won't block PRs (`continue-on-error: true`).
- Address gradually to improve type safety.

## Benefits

1. **Consistent Code Style**: Automatic formatting across the codebase
2. **Early Bug Detection**: Catch issues before code review
3. **Better Code Quality**: Enforces best practices
4. **Faster Reviews**: Less time discussing style, more on logic
5. **Type Safety**: MyPy catches type-related bugs
6. **CI Integration**: Automated quality checks on every PR

## Migration Path

For existing code:

1. **Format all files**: Run Black and Prettier
2. **Fix critical issues**: Address Flake8 and ESLint errors
3. **Add type hints**: Gradually improve MyPy coverage
4. **Configure exceptions**: Use `# noqa` and `// eslint-disable` sparingly

## Resources

- [Black Documentation](https://black.readthedocs.io/)
- [Flake8 Documentation](https://flake8.pycqa.org/)
- [MyPy Documentation](https://mypy.readthedocs.io/)
- [ESLint Documentation](https://eslint.org/)
- [Prettier Documentation](https://prettier.io/)
- [TypeScript ESLint](https://typescript-eslint.io/)

