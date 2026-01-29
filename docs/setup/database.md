# Database Setup

Phase runs on SQLite by default, but supports Postgres for production.

## SQLite (default)
```
DATABASE_URL=sqlite:///app.db
```

## Postgres (local via Docker)
Start Postgres:
```bash
docker-compose up -d
```

Use:
```
DATABASE_URL=postgresql://phase_user:phase_pass@localhost:5432/phase
```

## Render Postgres
If your DB already exists, run the schema update:
```sql
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(64),
  ADD COLUMN IF NOT EXISTS synced_calendar_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS synced_calendar_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS synced_calendar_tz VARCHAR(64);

ALTER TABLE memberships
  ADD COLUMN IF NOT EXISTS google_color_id VARCHAR(8);
```
