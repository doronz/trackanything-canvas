We're using **Alembic** for database migrations with Docker, here are the key commands for database management:

## 📊 **Database Status & Information**

### Check Current Migration Status
```bash
docker-compose exec backend alembic current
```

### View Migration History
```bash
docker-compose exec backend alembic history --verbose
```

### Show Available Migrations
```bash
docker-compose exec backend alembic heads
```

---

## ⬆️ **Migrate Forward (Apply Migrations)**

### Migrate to Latest Version
```bash
docker-compose exec backend alembic upgrade head
```

### Migrate to Specific Version
```bash
docker-compose exec backend alembic upgrade [revision_id]
# Example:
docker-compose exec backend alembic upgrade 3efb59592140
```

---

## ⬅️ **Rollback Migrations**

### Rollback One Step
```bash
docker-compose exec backend alembic downgrade -1
```

### Rollback to Specific Version
```bash
docker-compose exec backend alembic downgrade [revision_id]
# Example:
docker-compose exec backend alembic downgrade 4d55fd96d308
```

### Rollback to Base (Empty Database)
```bash
docker-compose exec backend alembic downgrade base
```

---

## 🔄 **Reset Database (Nuclear Option)**

### Option 1: Delete Database File + Recreate
```bash
# Stop containers
docker-compose down

# Remove database file
rm backend/canvas_mcp.db

# Start containers (will create fresh DB)
docker-compose up -d

# Apply all migrations
docker-compose exec backend alembic upgrade head

# Populate default data
docker-compose exec backend python scripts/populate_default_blueprints.py
```

### Option 2: Using SQLAlchemy Models (Bypass Alembic)
```bash
docker-compose exec backend python -c "
from database import Base, engine
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)
print('Database reset complete')
"
```

---

## 🆕 **Create New Migrations**

### Auto-generate Migration from Model Changes
```bash
docker-compose exec backend alembic revision --autogenerate -m "description of changes"
```

### Create Empty Migration Template
```bash
docker-compose exec backend alembic revision -m "manual migration description"
```

---

## 🛠️ **Common Scenarios**

### Scenario 1: "I made model changes and want to migrate"
```bash
# 1. Generate migration
docker-compose exec backend alembic revision --autogenerate -m "add new field to widget"

# 2. Apply migration
docker-compose exec backend alembic upgrade head
```

### Scenario 2: "I want to test a rollback"
```bash
# 1. Check current version
docker-compose exec backend alembic current

# 2. Rollback one step
docker-compose exec backend alembic downgrade -1

# 3. Migrate back forward
docker-compose exec backend alembic upgrade head
```

### Scenario 3: "I messed up and need fresh start"
```bash
# Nuclear reset
docker-compose down
rm backend/canvas_mcp.db
docker-compose up -d
docker-compose exec backend alembic upgrade head
docker-compose exec backend python scripts/populate_default_blueprints.py
```

---

## ⚠️ **Important Notes**

1. **Always backup before major changes:**
   ```bash
   cp backend/canvas_mcp.db backend/canvas_mcp.db.backup
   ```

2. **Check migration files before applying:**
   - Review generated migrations in `backend/alembic/versions/`
   - Ensure they match your intended changes

3. **Development vs Production:**
   - In development: Reset freely
   - In production: Always test migrations on copy first

4. **Data Loss Warning:**
   - `downgrade` and `reset` operations can cause **permanent data loss**
   - Always backup important data first

---

## 🔍 **Debug Migration Issues**

### If Migrations Fail:
```bash
# Check detailed error
docker-compose exec backend alembic upgrade head --verbose

# Force mark current version (use carefully)
docker-compose exec backend alembic stamp head
```

### If Database is Corrupted:
```bash
# Check database integrity
docker-compose exec backend python -c "
import sqlite3
conn = sqlite3.connect('canvas_mcp.db')
result = conn.execute('PRAGMA integrity_check').fetchall()
print(result)
"
```
