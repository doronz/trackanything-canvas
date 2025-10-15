# GitHub Actions Workflows

This directory contains automated workflows for Canvas MCP Client.

## Workflows

### 1. PR Labeler (`pr-labeler.yml`)

Automatically labels pull requests based on:

#### Type Labels (from PR title)
- `feat:` → `enhancement`, `feature`
- `fix:` → `bug`, `fix`
- `docs:` → `documentation`
- `style:` → `style`
- `refactor:` → `refactor`
- `perf:` → `performance`
- `test:` → `test`
- `build:` → `build`
- `ci:` → `ci-cd`
- `chore:` → `chore`, `maintenance`
- `security:` → `security`

#### Size Labels (based on changes)
- `size/XS` - Less than 10 changes
- `size/S` - 10-49 changes
- `size/M` - 50-199 changes
- `size/L` - 200-499 changes
- `size/XL` - 500+ changes

#### Component Labels (based on files changed)
- `frontend` - Frontend code changes
- `backend` - Backend code changes
- `widgets` - Widget components
- `canvas` - Canvas system
- `api` - API changes
- `database` - Database/migrations
- `mcp` - MCP integration
- `state-management` - Redux store
- `services` - Backend services
- `docker` - Docker configuration
- `documentation` - Markdown files
- `tests` - Test files

#### Special Labels
- `breaking-change` - Detected from `!:` in title or "breaking change" in description

**Triggers:** When PR is opened, edited, synchronized, or reopened

### 2. PR Title Check (`pr-title-check.yml`)

Validates that PR titles follow conventional commit format:

- Checks for valid prefix (`feat:`, `fix:`, `docs:`, etc.)
- Validates title structure (type + colon + description)
- Posts helpful comment if format is incorrect
- Warns about breaking changes without documentation
- Provides examples and guidance

**Triggers:** When PR is opened, edited, synchronized, or reopened

### 3. CI (`ci.yml`)

Runs continuous integration checks:

#### Backend Tests
- Linting with flake8
- Code formatting check with Black
- Unit tests with pytest
- Code coverage reporting

#### Frontend Checks
- ESLint linting
- TypeScript type checking
- Production build test

#### Docker Build
- Backend image build
- Frontend image build
- Docker Compose validation

#### Security Scanning
- Trivy vulnerability scanner
- SARIF results upload to GitHub Security

**Triggers:** Push to `production` or `main` branches, and all pull requests

## Setting Up Labels

To create all labels in your repository, use the GitHub CLI:

```bash
# Install GitHub CLI if you haven't already
# macOS: brew install gh
# Windows: winget install GitHub.cli
# Linux: See https://github.com/cli/cli#installation

# Authenticate
gh auth login

# Sync labels from the configuration file
gh label sync -f .github/labels.yml
```

Or manually create labels in GitHub:
1. Go to your repository
2. Click "Issues" → "Labels"
3. Create labels matching the definitions in `labels.yml`

## Permissions Required

These workflows require the following permissions (configured in each workflow file):

- **pr-labeler.yml:**
  - `pull-requests: write` - To add/remove labels
  - `contents: read` - To read PR files

- **pr-title-check.yml:**
  - `pull-requests: write` - To post comments
  - `contents: read` - To read PR content

- **ci.yml:**
  - `contents: read` - To checkout code
  - `security-events: write` - To upload security scan results (optional)

## Disabling Workflows

If you want to disable a workflow:

1. Go to your repository → "Actions" tab
2. Click on the workflow name in the left sidebar
3. Click the "⋯" menu → "Disable workflow"

Or simply delete or rename the workflow file.

## Customization

### Modifying Label Mappings

Edit `pr-labeler.yml` and update the `labelMappings` object:

```javascript
const labelMappings = {
  'feat:': ['enhancement', 'feature'],  // Add/remove labels here
  'fix:': ['bug', 'fix'],
  // ... add your custom mappings
};
```

### Adjusting Size Thresholds

Edit the size calculation in `pr-labeler.yml`:

```javascript
if (totalChanges < 10) {
  sizeLabel = 'size/XS';
} else if (totalChanges < 50) {  // Adjust these numbers
  sizeLabel = 'size/S';
}
// ...
```

### Adding Component Detection

Edit the component detection logic in `pr-labeler.yml`:

```javascript
if (path.includes('/your-directory/')) {
  componentLabels.add('your-label');
}
```

## Troubleshooting

### Labels Not Being Applied

1. Check that labels exist in your repository (create them using `labels.yml`)
2. Verify workflow has `pull-requests: write` permission
3. Check workflow logs in Actions tab for errors

### CI Workflow Failing

1. Check that tests pass locally
2. Review workflow logs for specific errors
3. Ensure dependencies are properly defined in `requirements.txt` and `package.json`

### Security Scan Issues

The security scan is set to `continue-on-error: true` to prevent blocking PRs. Review findings in the Security tab.

## Best Practices

1. **Keep labels consistent** - Use the provided `labels.yml` as the single source of truth
2. **Monitor workflow usage** - Check Actions usage to stay within GitHub limits
3. **Update regularly** - Keep workflow actions up to date (Dependabot can help)
4. **Test changes** - Test workflow changes in a fork before merging to main

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitHub CLI](https://cli.github.com/)
- [actions/github-script](https://github.com/actions/github-script)

