# Database Migrations Guide

Canvas MCP Client now uses **Alembic** for proper database migrations instead of manual table creation. This provides version control for your database schema and enables safe rollbacks.

## 🚀 **Migration System Overview**

### **Automatic Migrations**
- ✅ **Startup**: Migrations run automatically when the backend starts
- ✅ **Docker**: Migrations are handled in the Docker container
- ✅ **Fallback**: Falls back to `create_all()` if migrations fail (development mode)

### **Manual Migration Commands**

Run migrations manually (inside Docker container):
```bash
# Run all pending migrations
docker-compose exec backend alembic upgrade head

# Check current migration status
docker-compose exec backend alembic current

# View migration history
docker-compose exec backend alembic history

# Create a new migration (after model changes)
docker-compose exec backend alembic revision --autogenerate -m "Description of changes"
```

Or use the migration script:
```bash
# Run migrations via Python script
docker-compose exec backend python scripts/migrate_database.py
```

## 📂 **Migration Files**

- **`alembic/`** - Migration configuration and version files
- **`alembic.ini`** - Alembic configuration (database URL, logging)
- **`alembic/env.py`** - Environment setup for migrations
- **`alembic/versions/`** - Individual migration files
- **`migrations.py`** - Python utilities for running migrations
- **`scripts/migrate_database.py`** - Standalone migration script

## 🗄️ **Current Database Schema**

The initial migration includes all existing tables:
- `dashboards` - Dashboard configurations
- `widgets` - Widget instances
- `widget_templates` - Widget templates
- `widget_blueprints` - Widget blueprints
- `dashboard_templates` - Dashboard templates
- `mcp_servers` - User MCP server configurations
- `mcp_server_directory` - Legacy MCP server directory
- `mcp_registry_servers` - **NEW**: Official MCP Registry servers
- `ai_configs` - AI configuration settings

## 🔄 **Creating New Migrations**

When you modify database models:

1. **Update your model** in `database.py`
2. **Generate migration**:
   ```bash
   docker-compose exec backend alembic revision --autogenerate -m "Add new column to widgets"
   ```
3. **Review the migration** in `alembic/versions/`
4. **Apply migration**:
   ```bash
   docker-compose exec backend alembic upgrade head
   ```

## 🛠️ **Development Workflow**

### **Fresh Development Setup**
```bash
# 1. Start containers
docker-compose up -d

# 2. Migrations run automatically on startup ✅

# 3. Populate registry data (optional)
docker-compose exec backend python scripts/populate_registry_servers.py
```

### **Adding New Features**
```bash
# 1. Modify models in database.py
# 2. Generate migration
docker-compose exec backend alembic revision --autogenerate -m "Add feature X"
# 3. Review generated migration file
# 4. Apply migration (or restart backend - it runs automatically)
docker-compose exec backend alembic upgrade head
```

## 🚨 **Production Deployment**

For production deployments:

1. **Run migrations before deployment**:
   ```bash
   python scripts/migrate_database.py
   ```

2. **Backup database** before major migrations:
   ```bash
   cp data/canvas_mcp.db data/canvas_mcp.db.backup
   ```

3. **Test migrations** on a copy of production data first

## 🔄 **Rollback (if needed)**

```bash
# Rollback to specific revision
docker-compose exec backend alembic downgrade <revision_id>

# Rollback one migration
docker-compose exec backend alembic downgrade -1
```

## ❓ **Troubleshooting**

### **Migration Failed**
If migration fails, the system falls back to `create_all()` mode for development.

### **Schema Mismatch**
If your database schema doesn't match migrations:
```bash
# Mark current database as being at latest migration
docker-compose exec backend alembic stamp head
```

### **Clean Start**
To completely reset the database:
```bash
# Remove database
rm backend/data/canvas_mcp.db
# Restart backend (migrations create new database)
docker-compose restart backend
```

## 📋 **Migration Best Practices**

1. ✅ **Always review** generated migrations before applying
2. ✅ **Test migrations** on development data first
3. ✅ **Backup production** databases before major migrations
4. ✅ **Use descriptive messages** for migration names
5. ✅ **One logical change** per migration
6. ❌ **Don't edit** existing migration files (create new ones)
7. ❌ **Don't skip** migration versions
