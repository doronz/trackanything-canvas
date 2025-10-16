# Git Hooks Setup

This directory contains Git hooks managed by [Husky](https://typicode.github.io/husky/).

## Pre-commit Hook

The pre-commit hook automatically runs linting checks **only on files you've changed** before allowing you to commit.

### How It Works

1. **Detects changed files** in your staged commits
2. **Backend checks** (only if `.py` files changed):
   - ✨ Black - Auto-formats code
   - 🔤 isort - Sorts imports
   - 🔍 Flake8 - Checks code quality
3. **Frontend checks** (only if frontend files changed):
   - ✨ Prettier - Auto-formats code
   - 🔍 ESLint - Checks code quality and auto-fixes

### Benefits

✅ **Fast** - Only checks files you changed, not the entire codebase
✅ **Smart** - Skips backend checks if you only changed frontend code (and vice versa)
✅ **Auto-fix** - Automatically formats your code before commit
✅ **Prevents issues** - Catches problems before they reach CI/CD

### Installation

The hooks are automatically installed when you run:
```bash
npm install
```

### Bypassing Hooks (Emergency Only)

If you need to bypass the pre-commit hook (not recommended):
```bash
git commit --no-verify -m "your message"
```

### Disabling Hooks Temporarily

To temporarily disable Husky:
```bash
export HUSKY=0
git commit -m "your message"
```

To re-enable:
```bash
unset HUSKY
```

### Manual Linting

You can still run linting manually:

**Check all files:**
```bash
./lint.sh
```

**Auto-fix all files:**
```bash
./lint-fix.sh
```

**Frontend only (inside Docker):**
```bash
docker compose exec frontend npm run format
docker compose exec frontend npm run lint:fix
```

**Backend only (inside Docker):**
```bash
docker compose exec backend black .
docker compose exec backend isort .
```

### Troubleshooting

**Hook not running?**
- Make sure hooks are executable: `chmod +x .husky/*`
- Reinstall hooks: `npm run prepare`

**Docker not running?**
- The hook will skip if Docker is down and show a warning
- Start Docker and run `./lint.sh` manually

**Getting false positives?**
- The hook checks staged files only
- Make sure you've staged the files you want to commit: `git add <files>`

