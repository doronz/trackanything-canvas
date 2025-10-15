# GitHub Actions Setup Guide

This guide helps you set up the automated workflows for Canvas MCP Client.

## 🚀 Quick Setup (5 minutes)

### Step 1: Create Labels

Labels need to exist before the workflows can apply them. Use one of these methods:

#### Option A: Using GitHub CLI (Recommended)

```bash
# Install GitHub CLI if needed
# macOS: brew install gh
# Windows: winget install GitHub.cli
# Linux: https://github.com/cli/cli#installation

# Authenticate with GitHub
gh auth login

# Navigate to your repository
cd /path/to/CanvasMCPClient

# Sync labels from configuration
gh label sync -f .github/labels.yml

# That's it! All labels are now created.
```

#### Option B: Manual Import (GitHub UI)

1. Go to your repository on GitHub
2. Click on **Issues** tab
3. Click on **Labels** button
4. Click **New label** for each label in `.github/labels.yml`
   - Or use a label import tool like [GitHub Label Manager](https://github.com/Spendesk/github-label-manager)

### Step 2: Configure GitHub Actions Permissions

1. Go to your repository **Settings**
2. Click **Actions** → **General** (left sidebar)
3. Scroll to **Workflow permissions**
4. Select **"Read and write permissions"**
5. Check ✅ **"Allow GitHub Actions to create and approve pull requests"**
6. Click **Save**

### Step 3: Enable GitHub Actions (if not already enabled)

1. Go to your repository **Settings**
2. Click **Actions** → **General**
3. Under **Actions permissions**, select:
   - ✅ **"Allow all actions and reusable workflows"**
4. Click **Save**

### Step 4: Test the Workflows

Create a test PR to verify everything works:

```bash
# Create a test branch
git checkout -b test/github-actions-setup

# Make a small change
echo "# Test" >> TEST.md

# Commit with conventional format
git add TEST.md
git commit -m "test: verify GitHub Actions automation"

# Push and create PR
git push origin test/github-actions-setup

# Create PR on GitHub with title: "test: verify automated labeling"
```

Watch the **Actions** tab to see workflows run!

## 📋 What Each Workflow Does

### 1. PR Labeler Workflow

**File:** `.github/workflows/pr-labeler.yml`

**Automatically adds labels when you create/update a PR:**

```
PR Title: "feat: add weather widget"
↓
Labels Applied:
  - enhancement ✨
  - feature 🎯
  - size/M 📏
  - frontend 💻
  - widgets 🧩
```

**Label Categories:**

| Category | Examples | Based On |
|----------|----------|----------|
| **Type** | `enhancement`, `bug`, `docs` | PR title prefix |
| **Size** | `size/XS`, `size/M`, `size/XL` | Number of changes |
| **Component** | `frontend`, `backend`, `widgets` | Files changed |
| **Special** | `breaking-change`, `security` | Title/description |

### 2. PR Title Check Workflow

**File:** `.github/workflows/pr-title-check.yml`

**Validates PR titles and provides feedback:**

❌ **Bad:**
```
Add weather widget
```

✅ **Good:**
```
feat: add weather widget with forecast display
```

**What it checks:**
- Valid conventional commit prefix
- Proper format (type: description)
- Description exists and is meaningful
- Breaking change documentation (if `!:` is used)

**Failure = Helpful comment** posted on your PR with examples!

### 3. CI/CD Workflow

**File:** `.github/workflows/ci.yml`

**Runs automated tests on every PR and push:**

| Job | What It Does |
|-----|--------------|
| **Backend Tests** | pytest, code coverage, flake8, black |
| **Frontend Checks** | ESLint, TypeScript type check, build test |
| **Docker Build** | Verify Docker images build successfully |
| **Security Scan** | Trivy vulnerability scanning |

## 🏷️ Label Reference

### Type Labels (From PR Title)

| Prefix | Labels Applied | Color |
|--------|---------------|-------|
| `feat:` | enhancement, feature | 🟢 Green |
| `fix:` | bug, fix | 🔴 Red |
| `docs:` | documentation | 🔵 Blue |
| `style:` | style | 🟣 Pink |
| `refactor:` | refactor | 🟡 Yellow |
| `perf:` | performance | 🔵 Blue |
| `test:` | test | 🟢 Light Green |
| `build:` | build | 🔵 Light Blue |
| `ci:` | ci-cd | 🟢 Dark Green |
| `chore:` | chore, maintenance | 🟡 Yellow |
| `security:` | security | 🔴 Dark Red |

### Size Labels (Automatic)

| Label | Changes | Color |
|-------|---------|-------|
| `size/XS` | < 10 | 🟢 Green |
| `size/S` | 10-49 | 🟢 Light Green |
| `size/M` | 50-199 | 🟡 Yellow |
| `size/L` | 200-499 | 🟠 Orange |
| `size/XL` | 500+ | 🔴 Red |

### Component Labels (From Files)

| Label | Triggered By | Example |
|-------|--------------|---------|
| `frontend` | `frontend/` directory | React components |
| `backend` | `backend/` directory | FastAPI routes |
| `widgets` | `frontend/src/components/Widgets/` | Widget files |
| `canvas` | `frontend/src/components/Canvas/` | Canvas system |
| `api` | `backend/routers/` | API endpoints |
| `database` | `alembic/`, `database.py` | Migrations |
| `mcp` | Files with `mcp` in path | MCP integration |
| `docker` | `Dockerfile`, `docker-compose.yml` | Docker config |
| `documentation` | `*.md` files | Markdown docs |
| `tests` | Files with `test` in name | Test files |

## 🔧 Customization

### Change Size Thresholds

Edit `.github/workflows/pr-labeler.yml`:

```javascript
// Find this section and adjust numbers:
if (totalChanges < 10) {
  sizeLabel = 'size/XS';
} else if (totalChanges < 50) {  // Change to 100 for example
  sizeLabel = 'size/S';
}
```

### Add Custom Labels

1. Add label to `.github/labels.yml`:
   ```yaml
   - name: "my-custom-label"
     color: "ff6b6b"
     description: "My custom label"
   ```

2. Update workflow logic in `.github/workflows/pr-labeler.yml`

3. Sync labels: `gh label sync -f .github/labels.yml`

### Disable a Workflow

#### Option A: Via GitHub UI
1. Go to **Actions** tab
2. Click workflow name (left sidebar)
3. Click **⋯** → **Disable workflow**

#### Option B: Delete/Rename File
```bash
# Rename to disable
mv .github/workflows/ci.yml .github/workflows/ci.yml.disabled

# Or delete
rm .github/workflows/ci.yml
```

## 🐛 Troubleshooting

### Labels Not Applied

**Problem:** PR created but no labels added

**Solutions:**
1. Check labels exist: Go to Issues → Labels
2. Verify workflow ran: Check Actions tab
3. Check permissions: Settings → Actions → Workflow permissions
4. Review logs: Actions tab → Click workflow run → View logs

### PR Title Check Fails

**Problem:** Red X next to PR even with correct title

**Solutions:**
1. Ensure title starts with valid prefix: `feat:`, `fix:`, etc.
2. Check for typos in prefix
3. Ensure there's a colon and description: `feat: description`
4. Don't capitalize first word after colon (use lowercase)

### CI Workflow Fails

**Problem:** Tests fail in CI but pass locally

**Solutions:**
1. Check if you're using Docker locally: CI uses clean environment
2. Ensure all dependencies in `requirements.txt`/`package.json`
3. Check Python/Node versions match
4. Review specific error in Actions logs

### Permission Errors

**Problem:** Workflow fails with permission errors

**Solutions:**
1. Go to Settings → Actions → General
2. Set Workflow permissions to "Read and write permissions"
3. Enable "Allow GitHub Actions to create and approve pull requests"
4. Save changes and re-run workflow

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitHub Label Manager](https://github.com/Spendesk/github-label-manager)
- [Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)

## ✅ Verification Checklist

After setup, verify:

- [ ] Labels created in repository (Issues → Labels)
- [ ] Workflow permissions configured (Settings → Actions)
- [ ] Actions are enabled (Settings → Actions)
- [ ] Test PR shows automated labels
- [ ] PR title validation works (try bad title)
- [ ] CI runs on new PRs
- [ ] Workflow logs accessible in Actions tab

## 🎉 You're All Set!

Your repository now has automated PR management! Contributors will see:

1. ✅ Automated labels on their PRs
2. ✅ Helpful feedback for incorrect PR titles
3. ✅ CI checks running automatically
4. ✅ Clear size and component indicators

This makes managing contributions much easier! 🚀

---

**Need Help?** Open a discussion or issue in the repository.

