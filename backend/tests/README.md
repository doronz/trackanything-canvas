# Backend Test Suite

This directory contains comprehensive tests for the Canvas MCP Client backend API. The test suite covers API endpoints, service layer functionality, database operations, and integration scenarios.

## Test Structure

```
tests/
├── conftest.py              # Test configuration and fixtures
├── test_dashboards.py       # Dashboard API endpoint tests
├── test_widgets.py          # Widget API endpoint tests
├── test_mcp_service.py      # MCP service layer tests
├── test_database.py         # Database model and operation tests
└── test_integration.py      # End-to-end integration tests
```

## Test Categories

### 1. API Endpoint Tests
- **Dashboard Tests** (`test_dashboards.py`): CRUD operations, export/import, duplication
- **Widget Tests** (`test_widgets.py`): Widget management, blueprint relationships, bulk operations

### 2. Service Layer Tests
- **MCP Service Tests** (`test_mcp_service.py`): MCP server connections, tool calls, error handling

### 3. Database Tests
- **Model Tests** (`test_database.py`): Database models, relationships, constraints, data integrity

### 4. Integration Tests
- **End-to-End Tests** (`test_integration.py`): Complete workflows, error handling, performance scenarios

## Running Tests

### Prerequisites

Install test dependencies:
```bash
pip install pytest pytest-asyncio pytest-mock httpx pytest-cov
```

Or use the test runner:
```bash
python run_tests.py install
```

### Test Commands

#### Run All Tests
```bash
# Using pytest directly
python -m pytest tests/ -v

# Using test runner
python run_tests.py all
```

#### Run Specific Test Categories
```bash
# API endpoint tests only
python run_tests.py api

# Service layer tests only
python run_tests.py service

# Database tests only
python run_tests.py database

# Integration tests only
python run_tests.py integration
```

#### Run with Coverage
```bash
python run_tests.py coverage
```

#### Run Specific Test File
```bash
python run_tests.py specific --path tests/test_dashboards.py
```

#### Run Fast Tests (excluding slow tests)
```bash
python run_tests.py fast
```

### Test Markers

Tests are organized with markers for flexible execution:

- `@pytest.mark.unit` - Unit tests
- `@pytest.mark.integration` - Integration tests
- `@pytest.mark.slow` - Slow-running tests
- `@pytest.mark.mcp` - MCP-related tests
- `@pytest.mark.database` - Database tests
- `@pytest.mark.api` - API endpoint tests

### Docker Testing

Run tests in the Docker environment:
```bash
# From project root
docker compose exec backend python -m pytest tests/ -v

# Or using the test runner
docker compose exec backend python run_tests.py all
```

## Test Configuration

### Environment Variables
Tests use a separate test database to avoid conflicts with development data:
- Database: In-memory SQLite for fast test execution
- MCP Services: Mocked for consistent testing

### Fixtures
Key test fixtures available in `conftest.py`:
- `client`: FastAPI TestClient with database overrides
- `test_db_session`: Isolated database session
- `sample_dashboard`: Sample dashboard for testing
- `sample_widget`: Sample widget with blueprint
- `sample_widget_blueprint`: Sample widget blueprint
- `mock_mcp_service`: Mocked MCP service

### Test Data Factory
Use `TestDataFactory` for creating test objects with optional overrides:
```python
def test_example(test_data_factory, sample_dashboard, sample_widget_blueprint):
    widget_data = test_data_factory.create_widget_data(
        dashboard_id=sample_dashboard.id,
        blueprint_id=sample_widget_blueprint.id,
        title="Custom Widget"
    )
```

## Writing Tests

### Test Organization
- Group related tests in classes (e.g., `TestDashboardAPI`)
- Use descriptive test names that explain the scenario
- Include both positive and negative test cases
- Test edge cases and error conditions

### Example Test Structure
```python
class TestDashboardAPI:
    """Test suite for dashboard API endpoints."""

    def test_create_dashboard(self, client, sample_dashboard_data):
        """Test creating a new dashboard."""
        response = client.post("/api/dashboards/", json=sample_dashboard_data)

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == sample_dashboard_data["name"]

    def test_create_dashboard_invalid_data(self, client):
        """Test creating a dashboard with invalid data."""
        response = client.post("/api/dashboards/", json={})
        assert response.status_code == 422
```

### Async Testing
For testing async code (like MCP services):
```python
@pytest.mark.asyncio
async def test_async_operation(self, mcp_service):
    """Test asynchronous MCP operation."""
    result = await mcp_service.call_tool("server", "tool", {})
    assert result is not None
```

### Database Testing
Database tests use transactions that are rolled back after each test:
```python
def test_model_creation(self, test_db_session):
    """Test creating a database model."""
    model = MyModel(name="test")
    test_db_session.add(model)
    test_db_session.commit()
    test_db_session.refresh(model)

    assert model.id is not None
    assert model.name == "test"
```

## Test Coverage

The test suite aims for high coverage of:
- ✅ API endpoint functionality (CRUD operations)
- ✅ Database models and relationships
- ✅ Service layer business logic
- ✅ Error handling and edge cases
- ✅ Integration scenarios
- ✅ Data validation and constraints

### Coverage Report
Generate HTML coverage report:
```bash
python run_tests.py coverage
# Report available at htmlcov/index.html
```

## Continuous Integration

Tests are designed to run in CI environments:
- Fast execution with in-memory database
- No external dependencies required
- Consistent test data and mocking
- Comprehensive error reporting

### GitHub Actions Example
```yaml
- name: Run Backend Tests
  run: |
    cd backend
    python -m pytest tests/ -v --cov=. --cov-report=xml
```

## Troubleshooting

### Common Issues

1. **Import Errors**: Ensure you're running tests from the backend directory
2. **Database Errors**: Tests use isolated test database - check conftest.py setup
3. **Async Errors**: Use `@pytest.mark.asyncio` for async test functions
4. **Fixture Errors**: Check fixture dependencies and scope

### Debug Mode
Run tests with more verbose output:
```bash
python -m pytest tests/ -v -s --tb=long
```

### Test Environment Check
Verify test environment setup:
```bash
python run_tests.py check
```

## Contributing

When adding new tests:
1. Follow existing test patterns and naming conventions
2. Include both positive and negative test cases
3. Use appropriate fixtures and test data
4. Add integration tests for complex workflows
5. Update this README if adding new test categories

### Test Review Checklist
- [ ] Tests cover new functionality completely
- [ ] Error cases and edge cases included
- [ ] Tests use appropriate fixtures and mocking
- [ ] Tests are fast and don't depend on external services
- [ ] Tests clean up after themselves
- [ ] Test names are descriptive and clear
