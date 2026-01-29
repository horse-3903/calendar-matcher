# Phase — Calendar Matcher

Phase helps groups coordinate availability without exposing private event details. It pulls **FreeBusy** data from Google Calendar, lets members add **Available / Blocked / Proposed** time ranges, and provides a shared calendar view with member-specific colors. You can also export the group view into a synced Google Calendar.

---

## Table of Contents

- Overview
- Key Features
- Quick Start (Local)
- Environment Configuration
- Google OAuth Setup
- Database (Postgres / SQLite)
- Running & Building
- Documentation
- Using the App
- Group Roles & Permissions
- Calendar Sync & Privacy
- Export to Google Calendar
- Debug / Dev Console
- API Overview (High-Level)
- Troubleshooting
- Deployment Notes (Render)
- Security Notes

---

## Overview

Phase is a Flask app with SQLAlchemy and a modern frontend. It uses Google’s **FreeBusy** endpoint (not Events) to avoid reading event titles or details. The UI is optimized for dark/light themes and includes a shared group calendar.

---

## Key Features

- **Google OAuth login** (Calendar read access for FreeBusy)
- **FreeBusy-only** sync — no event titles/details fetched
- **Group creation & joining** via join code or invite link
- **Group dashboard** with shared calendar
- **Special events**: available or blocked time ranges
- **Meetup proposals** with conflict warnings
- **Auto-sync** intervals (optional)
- **Export group calendar** to Google Calendar (create/update)
- **Per-member colors** with Google calendar color mapping
- **Admin roles** with member promotion
- **Dev Console** (only in dev mode, or owner in prod)

---

## Quick Start (Local)

### 1) Install Python dependencies
```bash
pip install -r requirements.txt
```

### 2) Install Node dependencies
```bash
npm install
```

### 3) Configure environment
Create `.env` based on `.env.example` (or set env vars in your shell).

### 4) Run
```bash
python run.py
```

App runs at: `http://127.0.0.1:5000`

---

## Environment Configuration

Minimum:
- `SECRET_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `DATABASE_URL`

Additional:
- `APP_MODE` → `dev` | `test` | `prod`
- `DEBUG_OWNER_EMAIL` → only used in prod for Dev Console access

Example:
```
APP_MODE=dev
SECRET_KEY=dev_secret_change_me
DATABASE_URL=postgresql://user:pass@localhost:5432/phase
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

---

## Google OAuth Setup

1) Create a Google Cloud project  
2) Enable **Google Calendar API**  
3) Configure OAuth consent screen  
4) Add OAuth Client ID (Web Application)  
5) Authorized redirect URI:  
   ```
   http://127.0.0.1:5000/auth/callback
   ```
6) Add Client ID/Secret to `.env`

Scopes used:
- `openid`, `email`, `profile`
- `https://www.googleapis.com/auth/calendar.readonly`
- `https://www.googleapis.com/auth/calendar` (needed for export)

---

## Database (Postgres / SQLite)

Phase uses SQLAlchemy with `db.create_all()` (no migrations by default).

### Local Postgres via Docker
```bash
docker-compose up -d
```
Set:
```
DATABASE_URL=postgresql://phase_user:phase_pass@localhost:5432/phase
```

### Existing DB updates (Render)
If a Postgres DB already exists, add new columns manually:
```sql
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(64),
  ADD COLUMN IF NOT EXISTS synced_calendar_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS synced_calendar_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS synced_calendar_tz VARCHAR(64);

ALTER TABLE memberships
  ADD COLUMN IF NOT EXISTS google_color_id VARCHAR(8);
```

---

## Running & Building

### Dev server
```bash
python run.py
```

### Frontend build
```bash
npm run build
```

This builds:
- `app/static/main.bundle.js`
- `app/static/fullcalendar.css`
- `app/static/tailwind.css`

---

## Documentation

Full docs live in `docs/` and are configured with `mkdocs.yml`.

---

## Using the App

### 1) Login
Sign in with Google to connect your calendar.

### 2) Create or Join a Group
- **Create**: generates a unique join code.
- **Join**: use join code or invite link.

### 3) Sync Calendar
Opens the sync dialog where you can:
- Select which calendars to include
- Sync now
- Enable auto-sync interval

### 4) Add Time Ranges
Use **Add Time Range**:
- Available
- Blocked

### 5) Propose Meetup
Suggest a time with optional location/description. Conflicts are shown if other members are busy.

### 6) Export to Google
From group dashboard:
- Create synced calendar (first time)
- Update synced calendar (subsequent)
- Customize name, timezone, member colors
- Invite members to the calendar

---

## Group Roles & Permissions

Roles:
- **Admin**
- **Member**

Admins can:
- Change group settings (name, timezone, join code)
- Promote members to admin
- Export/Update synced calendars

Members can:
- View calendar
- Add available/blocked time
- Propose meetups

---

## Calendar Sync & Privacy

Phase uses **FreeBusy** only:
- ✅ Time ranges are synced
- ❌ Event titles/details are never accessed

Sync window:
- Current time → **6 months ahead**
- The FreeBusy API is chunked (90-day slices) to avoid timeRangeTooLong errors.

---

## Export to Google Calendar

Exporting creates or updates a separate Google Calendar with:
- Busy blocks labeled per member
- Available/Blocked special events
- Proposed meetups

Export options:
- Calendar name (default: `Phase - <Group Name>`)
- Timezone (default: group timezone)
- Per‑member color selection
- Invite members to the calendar
- Overwrite existing Phase events

---

## Debug / Dev Console

Available only in:
- `APP_MODE=dev`
- `APP_MODE=prod` **only** if logged in as `DEBUG_OWNER_EMAIL`

Functions:
- Clear busy cache
- Clear proposals
- Clear invite links
- Force sync

---

## API Overview (High‑Level)

Key endpoints:
- `POST /api/sync/me` → FreeBusy sync (6 months)
- `GET /api/calendars` → list calendars
- `POST /api/calendars/save` → save selection
- `POST /api/groups/<id>/special` → add available/blocked
- `POST /api/groups/<id>/proposal` → propose meetup
- `POST /api/groups/<id>/export/google` → create/update synced calendar
- `GET /api/groups/<id>/export/google/options` → export settings

---

## Troubleshooting

**FreeBusy 400 “timeRangeTooLong”**  
Fixed by chunking. Make sure latest code is deployed.

**OAuth mismatch_state**  
Clear cookies / restart Flask.

**Sync fails with 401**  
Refresh token missing; sign in again.

**Build errors**  
Run:
```bash
npm install
npm run build
```

---

## Deployment Notes (Render)

1) Create Render Postgres instance  
2) Set `DATABASE_URL` in Render env vars  
3) Set OAuth vars + `SECRET_KEY`  
4) Deploy  
5) Run the SQL migrations above if DB already exists  

---

## Security Notes

- Do not commit `.env`
- Rotate credentials if shared
- Use strong `SECRET_KEY`
- Limit Dev Console access in prod

---

If you want a dedicated docs site (Docusaurus, MkDocs, etc.), I can generate it with this content.*** End Patch"}}Output code bug at end? apply_patch should be plain. I must send freeform. Let's redo apply_patch.```
