# Contributing to Canvas MCP Client

Thank you for your interest in contributing to Canvas MCP Client! We're excited to have you join our community. This document provides guidelines and instructions for contributing to the project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing Requirements](#testing-requirements)
- [Widget Development](#widget-development)
- [Documentation](#documentation)
- [Community](#community)

## 📜 Code of Conduct

This project adheres to a [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## 🤝 How Can I Contribute?

There are many ways to contribute to Canvas MCP Client:

### 🐛 Reporting Bugs

- **Check existing issues** to avoid duplicates
- Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md)
- Include detailed steps to reproduce the issue
- Provide system information (OS, browser, versions)
- Add screenshots or videos if applicable

### 💡 Suggesting Features

- **Check existing issues** for similar suggestions
- Use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.md)
- Clearly describe the feature and its benefits
- Consider implementation details if possible
- Discuss with the community before starting work

### 📝 Improving Documentation

- Fix typos, clarify explanations
- Add examples and use cases
- Update outdated information
- Create tutorials or guides
- Improve API documentation

### 🔧 Code Contributions

- Fix bugs
- Implement new features
- Optimize performance
- Improve code quality
- Create new widgets
- Enhance existing widgets

### 🎨 Creating Templates

- Design widget templates
- Create dashboard templates
- Share configurations with the community

## 🚀 Getting Started

### 1. Fork the Repository

Click the "Fork" button at the top right of the repository page.

### 2. Clone Your Fork

```bash
git clone https://github.com/YOUR-USERNAME/CanvasMCPClient.git
cd CanvasMCPClient
```

### 3. Add Upstream Remote

```bash
git remote add upstream https://github.com/ORIGINAL-OWNER/CanvasMCPClient.git
```

### 4. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

## 🛠️ Development Setup

### Using Docker (Recommended)

```bash
# Start the development environment
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the environment
docker-compose down
```

**Access Points:**
- Frontend: http://localhost:3031
- Backend: http://localhost:8081
- API Docs: http://localhost:8081/docs

### Manual Setup

#### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Start development server
uvicorn main:app --reload --host 0.0.0.0 --port 8081
```

#### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

### Running Commands Inside Docker

```bash
# Backend commands
docker compose exec backend python scripts/migrate_database.py

# Frontend commands
docker compose exec frontend npm run lint

# Shell access
docker compose exec backend bash
docker compose exec frontend sh
```

## 📏 Coding Standards

### Python (Backend)

We follow **PEP 8** style guide with the following specifications:

```python
# Use 4 spaces for indentation
# Maximum line length: 88 characters (Black default)
# Use type hints for function parameters and return values

def process_widget(widget_id: str, data: dict) -> Widget:
    """
    Process widget data and return Widget instance.

    Args:
        widget_id: Unique identifier for the widget
        data: Widget configuration data

    Returns:
        Widget: Processed widget instance
    """
    pass
```

**Tools:**
- **Linting**: `pylint` or `flake8`
- **Formatting**: `black`
- **Type Checking**: `mypy`

```bash
# Format code
black backend/

# Run linter
flake8 backend/

# Type check
mypy backend/
```

### TypeScript/JavaScript (Frontend)

We follow **Airbnb JavaScript Style Guide** with TypeScript extensions:

```typescript
// Use 2 spaces for indentation
// Use meaningful variable names
// Add JSDoc comments for complex functions
// Use TypeScript types for all parameters and returns

/**
 * Updates widget position on the canvas
 * @param widgetId - Unique identifier for the widget
 * @param position - New position coordinates
 * @returns Updated widget state
 */
function updateWidgetPosition(
  widgetId: string,
  position: { x: number; y: number }
): Widget {
  // Implementation
}
```

**Tools:**
- **Linting**: ESLint
- **Formatting**: Prettier (if configured)
- **Type Checking**: TypeScript compiler

```bash
# Run linter
npm run lint

# Type check
npm run type-check

# Run all checks
npm run lint && npm run type-check
```

### General Practices

- ✅ Write clean, readable code
- ✅ Follow existing code patterns and conventions
- ✅ Comment complex logic
- ✅ Use meaningful variable and function names
- ✅ Keep functions small and focused
- ✅ Avoid code duplication
- ✅ Handle errors gracefully
- ⛔ Don't commit commented-out code
- ⛔ Don't use console.log in production code
- ⛔ Don't include personal credentials or keys

## 📝 Commit Guidelines

We follow the **Conventional Commits** specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Commit Types

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Code style changes (formatting, missing semicolons, etc.)
- **refactor**: Code refactoring (no feature changes or bug fixes)
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **build**: Build system or dependency changes
- **ci**: CI/CD configuration changes
- **chore**: Other changes that don't modify src or test files

### Examples

```bash
feat(widgets): add weather widget with forecast display
fix(canvas): resolve zoom calculation for negative coordinates
docs(readme): update installation instructions for Windows
refactor(api): simplify widget creation endpoint
test(widgets): add unit tests for sticky note widget
```

### Best Practices

- Use present tense ("add feature" not "added feature")
- Use imperative mood ("move cursor to..." not "moves cursor to...")
- Keep the subject line under 50 characters
- Capitalize the subject line
- Don't end the subject line with a period
- Include detailed explanation in body if needed
- Reference issues in footer (e.g., "Fixes #123")

## 🔄 Pull Request Process

### Before Submitting

1. **Update your fork** with the latest upstream changes:
   ```bash
   git fetch upstream
   git rebase upstream/production
   ```

2. **Run tests** to ensure everything works:
   ```bash
   # Backend tests
   cd backend
   pytest

   # Frontend tests (if available)
   cd frontend
   npm test
   ```

3. **Check code quality**:
   ```bash
   # Backend
   black backend/
   flake8 backend/

   # Frontend
   npm run lint
   npm run type-check
   ```

4. **Update documentation** if needed

5. **Test manually** using the application

### Submitting the Pull Request

1. Push your branch to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

2. Go to the original repository on GitHub

3. Click "New Pull Request"

4. Select your fork and branch

5. **Name your PR with conventional prefixes** (following our commit conventions):
   ```
   feat: Add weather widget with forecast display
   fix: Resolve zoom calculation for negative coordinates
   docs: Update installation instructions for Windows
   refactor: Simplify widget creation endpoint
   test: Add unit tests for sticky note widget
   chore: Update dependencies to latest versions
   ```

6. Fill out the [PR template](.github/PULL_REQUEST_TEMPLATE.md):
   - Clear description of changes
   - Link to related issues
   - Screenshots/videos for UI changes
   - Testing instructions
   - Checklist completion

7. Submit the PR

### Automated PR Checks

Our repository uses GitHub Actions to automatically:

- **Label PRs** based on title prefix (feat, fix, docs, etc.)
- **Add size labels** (XS, S, M, L, XL) based on number of changes
- **Add component labels** (frontend, backend, widgets, etc.) based on files changed
- **Validate PR titles** to ensure they follow conventional commit format
- **Check for breaking changes** and add appropriate labels
- **Run CI/CD** tests automatically on every PR

If your PR title doesn't follow the format, you'll receive an automated comment with guidance.

### PR Review Process

- Maintainers will review your PR
- Address feedback and requested changes
- Keep the conversation respectful and constructive
- Update your PR by pushing to the same branch
- Once approved, a maintainer will merge your PR

### PR Requirements

✅ **Required:**
- Clear description of changes
- All tests passing
- Code follows style guidelines
- No merge conflicts
- PR title follows conventional commit format (feat:, fix:, docs:, etc.)
- Documentation updated (if applicable)
- Signed commits (recommended)

⚠️ **Nice to Have:**
- Screenshots for UI changes
- Performance benchmarks for optimizations
- Additional test coverage

## 🧪 Testing Requirements

### Backend Tests

All backend changes should include appropriate tests:

```python
# tests/test_widgets.py
import pytest
from routers.widgets import create_widget

def test_create_widget_success(test_client, test_db):
    """Test successful widget creation"""
    widget_data = {
        "blueprint_id": "sticky-note",
        "dashboard_id": "test-dashboard",
        "config": {"title": "Test Note"}
    }
    response = test_client.post("/api/widgets", json=widget_data)
    assert response.status_code == 201
    assert response.json()["config"]["title"] == "Test Note"
```

**Run tests:**
```bash
# Run all tests
pytest

# Run specific test file
pytest tests/test_widgets.py

# Run with coverage
pytest --cov=. --cov-report=html
```

### Frontend Tests

Frontend tests ensure UI components work correctly:

```typescript
// components/Widgets/__tests__/StickyNote.test.tsx
import { render, screen } from '@testing-library/react';
import StickyNoteWidget from '../StickyNoteWidget';

describe('StickyNoteWidget', () => {
  it('renders note content correctly', () => {
    const widget = {
      id: '1',
      config: { content: 'Test note' }
    };
    render(<StickyNoteWidget widget={widget} />);
    expect(screen.getByText('Test note')).toBeInTheDocument();
  });
});
```

### Manual Testing

Before submitting, manually test your changes:

1. Start the application (Docker or manual)
2. Test the specific feature/fix
3. Check for console errors
4. Test in different browsers (Chrome, Firefox, Safari)
5. Verify responsive design (if applicable)
6. Test edge cases and error scenarios

**Testing Checklist:**
- [ ] Feature works as intended
- [ ] No console errors
- [ ] No network errors
- [ ] UI is responsive
- [ ] Works in multiple browsers
- [ ] Handles errors gracefully
- [ ] Doesn't break existing features

## 🎨 Widget Development

Creating new widgets is a great way to contribute! Follow the [Universal Widget System](UNIVERSAL_WIDGET_ENGINE_ARCHITECTURE.md) architecture.

### Widget Blueprint

Create a blueprint in `backend/scripts/blueprints/`:

```json
{
  "id": "my-custom-widget",
  "name": "My Custom Widget",
  "description": "Description of what this widget does",
  "category": "productivity",
  "version": "1.0.0",
  "author": "Your Name",
  "icon": "icon-name",
  "defaultConfig": {
    "width": 400,
    "height": 300,
    "title": "My Widget",
    "customProperty": "default-value"
  },
  "configSchema": {
    "type": "object",
    "properties": {
      "customProperty": {
        "type": "string",
        "title": "Custom Property",
        "description": "Description of the property"
      }
    }
  },
  "requiredMcpServers": [],
  "capabilities": ["read", "write"],
  "tags": ["custom", "productivity"]
}
```

### Widget Component

Create the React component in `frontend/src/components/Widgets/`:

```typescript
// frontend/src/components/Widgets/MyCustomWidget.tsx
import React from 'react';
import { WidgetProps } from '@/types/universalWidget';

const MyCustomWidget: React.FC<WidgetProps> = ({ widget, onUpdate }) => {
  const handleChange = (value: string) => {
    onUpdate({
      ...widget,
      config: {
        ...widget.config,
        customProperty: value
      }
    });
  };

  return (
    <div className="p-4">
      <h3>{widget.config.title}</h3>
      <input
        type="text"
        value={widget.config.customProperty || ''}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full p-2 border rounded"
      />
    </div>
  );
};

export default MyCustomWidget;
```

### Register the Widget

Add your widget to the renderer:

```typescript
// frontend/src/components/Widgets/WidgetRenderer.tsx
import MyCustomWidget from './MyCustomWidget';

const widgetComponents: Record<string, React.FC<WidgetProps>> = {
  // ... existing widgets
  'my-custom-widget': MyCustomWidget,
};
```

### Widget Testing

Test your widget thoroughly:

```bash
# Backend: Register the blueprint
docker compose exec backend python scripts/create_universal_blueprints.py

# Frontend: Test in the UI
# 1. Create a new dashboard
# 2. Add your widget
# 3. Test all functionality
# 4. Test configuration changes
# 5. Test save/load
```

## 📚 Documentation

Good documentation is crucial. When contributing:

### Code Documentation

- Add JSDoc/docstring comments for public functions
- Explain complex logic with inline comments
- Update API documentation for endpoint changes

### User Documentation

- Update README.md if behavior changes
- Add examples for new features
- Update relevant guides (DEPLOYMENT.md, etc.)
- Create tutorials for complex features

### API Documentation

Backend API is auto-documented with FastAPI. Ensure:

- Proper function docstrings
- Accurate type hints
- Example request/response bodies
- Error response documentation

## 💬 Community

### Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: Questions, ideas, and general discussion
- **Pull Requests**: Code reviews and technical discussion

### Getting Help

- Check existing documentation
- Search closed issues for similar problems
- Ask in GitHub Discussions
- Be patient and respectful

### Recognition

Contributors are recognized in:
- Pull request acknowledgments
- Release notes
- Contributors section (coming soon)
- Project README

## 📋 Checklist for Contributors

Before submitting your contribution:

- [ ] Code follows project style guidelines
- [ ] Tests pass locally
- [ ] New tests added for new features
- [ ] Documentation updated
- [ ] Commits follow conventional commits format
- [ ] **PR title uses conventional prefix** (feat:, fix:, docs:, etc.)
- [ ] PR template completed
- [ ] No merge conflicts with target branch
- [ ] Self-reviewed the code
- [ ] Tested manually in the application

## 🎉 Thank You!

Your contributions make Canvas MCP Client better for everyone. We appreciate your time and effort!

---

**Questions?** Open a [Discussion](https://github.com/n00bvn/CanvasMCPClient/discussions) or comment on an existing issue.

**Found a bug?** Create an [Issue](https://github.com/n00bvn/CanvasMCPClient/issues/new/choose).

**Want to chat?** Join the conversation in [GitHub Discussions](https://github.com/n00bvn/CanvasMCPClient/discussions).

