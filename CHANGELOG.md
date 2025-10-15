# Changelog

All notable changes to Canvas MCP Client will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Preparing for open source release
- Comprehensive documentation for contributors
- Issue and pull request templates

## [1.0.0] - 2025-10-09

### Added

#### Core Features
- **Infinite Canvas System**: Zoomable and pannable workspace with smooth interactions
- **Widget System**: 12+ pre-built widgets for various use cases
  - Sticky Note widget for quick notes
  - To-Do List widget with task management
  - AI Chat widget with multi-provider support
  - Image Display widget
  - Flash Cards widget for learning
  - Video Player widget
  - Kanban Board widget for project management
  - Spreadsheet widget for data organization
  - Markdown Editor widget
  - Webpage Preview widget
  - World Clock widget
  - Weather Widget

#### MCP Integration
- FastMCP library integration for MCP server connections
- Support for stdio protocol
- Real-time connection status monitoring
- MCP server configuration import/export
- MCP Registry integration with curated server directory

#### AI Configuration
- Multi-provider AI support (OpenAI, Anthropic, Ollama, Google)
- Secure credential storage with encryption
- Configurable model parameters
- Custom API endpoint support

#### Dashboard Management
- Create and manage multiple dashboards
- Dashboard import/export functionality
- Dashboard templates
- Dashboard metadata (name, description, tags)

#### Widget Features
- Drag-and-drop widget placement
- Widget resizing and repositioning
- Widget appearance customization (colors, titles)
- Widget duplication
- Widget templates system
- Widget library with preview

#### Data & Persistence
- SQLite database for local storage
- Automatic saving functionality
- Session recovery
- Backup and restore capabilities
- Alembic migrations for database schema management

#### UI/UX
- Light and dark theme support
- Responsive toolbar and sidebar
- Status bar with connection indicators
- Keyboard shortcuts
- Context menus for quick actions
- Smooth animations and transitions

#### Developer Features
- Universal Widget System architecture
- Widget blueprint system
- Type-safe TypeScript frontend
- FastAPI backend with automatic API documentation
- Redux Toolkit for state management
- Comprehensive error handling

### Infrastructure
- Docker and Docker Compose support
- Environment variable configuration
- Production-ready deployment guides
- Database migration system
- Testing infrastructure (pytest)

### Documentation
- Comprehensive README with quick start guide
- Deployment documentation
- Database migration guide
- Environment configuration guide
- Universal Widget Engine architecture documentation
- MCP scraping guides

### Security
- Encrypted credential storage
- Local-first data architecture
- No telemetry or external data transmission
- CORS configuration for API security

## Release Types

### Types of Changes

- **Added** for new features
- **Changed** for changes in existing functionality
- **Deprecated** for soon-to-be removed features
- **Removed** for now removed features
- **Fixed** for any bug fixes
- **Security** for vulnerability fixes

## Versioning

Canvas MCP Client follows [Semantic Versioning](https://semver.org/):

- **MAJOR** version for incompatible API changes
- **MINOR** version for backwards-compatible functionality additions
- **PATCH** version for backwards-compatible bug fixes

## How to Read This Changelog

- Each version is organized by release date (newest first)
- Changes are grouped by type (Added, Changed, Fixed, etc.)
- Breaking changes are clearly marked with ⚠️ **BREAKING**
- Security updates are marked with 🔒 **SECURITY**

## Links

- [Unreleased]: https://github.com/n00bvn/CanvasMCPClient/compare/v1.0.0...HEAD
- [1.0.0]: https://github.com/n00bvn/CanvasMCPClient/releases/tag/v1.0.0

---

**Note**: This changelog started with version 1.0.0. For changes before this version, please refer to the git commit history.

