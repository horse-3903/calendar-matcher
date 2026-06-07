<div align="center">

# Calendar Matcher

A privacy-preserving group scheduling app that finds shared free time from Google Calendar without exposing private event details.

[![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-000000?style=flat-square&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![Google Calendar](https://img.shields.io/badge/Google_Calendar_API-4285F4?style=flat-square&logo=google-calendar&logoColor=white)](https://developers.google.com/calendar)
[![License](https://img.shields.io/github/license/horse-3903/calendar-matcher?style=flat-square)](LICENSE)
[![Last Commit](https://img.shields.io/github/last-commit/horse-3903/calendar-matcher?style=flat-square)](../../commits)

</div>

---

## Overview

**Calendar Matcher** is a group scheduling web app that connects to Google Calendar and displays shared availability across team members. It solves the coordination problem by computing when everyone is free using only busy/free interval data — event titles, descriptions, and attendees are never accessed or stored. Members see color-coded availability overlays and can propose meeting times with real-time conflict warnings.

## Features

- **Privacy-first calendar access** - only FreeBusy intervals are fetched; event titles and descriptions are never read or stored
- **Google OAuth 2.0** sign-in with scoped calendar access
- **Groups** - create with unique join codes, join via code or time-limited shareable invite link
- **Calendar view** powered by Schedule-X with week, day, month, and list views
- **Busy-time overlay** - member availability shown as color-coded blocks, no event details exposed
- **Special events** - mark yourself available despite a busy block, or block off free time
- **Meetup proposals** - propose a time slot and see which members have conflicts
- **Google Calendar export** - sync a group's proposals back to members' Google Calendars
- **Calendar selection** - choose which of your calendars to include in availability checks
- **Auto-sync** - background scheduler refreshes FreeBusy data every 15 minutes
- **Light/dark theme** toggle persisted in localStorage
- **Demo mode** - pre-populated demo group available when running with `FLASK_DEBUG=1`

---

## Privacy-first scheduling

Most calendar sharing tools require you to expose event titles and descriptions to other participants. Calendar Matcher avoids this entirely.

**What the app reads:**
- Google FreeBusy API responses: only whether a time slot is busy or free
- No event titles, descriptions, locations, or attendees are ever requested

**What is stored:**
- Busy intervals (start time, end time, source calendar ID) in the local database
- OAuth access and refresh tokens for background sync (see security notes below)
- User profile data from Google sign-in (name, email, profile picture, timezone)

**What is not stored:**
- Event titles or descriptions
- Attendee lists
- Event recurrence rules or other metadata

**What group members can see:**
- Which time slots are busy or free for each member (color-coded by person)
- Nothing about what the underlying events are

**OAuth scopes requested:**
- `openid`, `email`, `profile` - standard sign-in
- `https://www.googleapis.com/auth/calendar.readonly` - read FreeBusy data and list calendars
- `https://www.googleapis.com/auth/calendar` - write access, used only for the optional export-to-Google-Calendar feature

---

## Product workflow

1. Sign in with Google
2. Create a scheduling group (generates a unique join code)
3. Share the join code or a time-limited invite link with teammates
4. Each member connects their Google Calendar on first sign-in
5. The app syncs FreeBusy data in the background every 15 minutes
6. Members view the shared calendar to identify common free slots
7. Any member can propose a meeting time; the app shows who has conflicts
8. Admins can export the group's proposals back to Google Calendar

---

## Architecture

```mermaid
graph TD
    Browser["Browser / Jinja2 UI<br/>(Schedule-X calendar)"] --> Flask["Flask Route handlers<br/>app/routes.py"]
    Flask --> Auth["Flask-Login session<br/>app/auth.py"]
    Auth --> Google["Google OAuth 2.0<br/>(Authlib)"]
    Flask --> ORM["SQLAlchemy ORM<br/>app/models.py"]
    ORM --> DB[("SQLite (dev)<br/>PostgreSQL (prod)")]
    Scheduler["APScheduler<br/>app/scheduler.py<br/>(every 15 min)"] --> CalAPI["Google Calendar API<br/>FreeBusy endpoint"]
    CalAPI --> ORM
    Flask --> Engine["Conflict detection<br/>BusyInterval + SpecialEvent<br/>overlap queries"]
    Engine --> ORM
```

### Component table

| Component | Purpose | Main files |
|---|---|---|
| Frontend UI | Jinja2 templates + Schedule-X calendar | `app/templates/`, `app/static/main.js` |
| Auth | Google OAuth 2.0 sign-in and session management | `app/auth.py`, `app/config.py` |
| Calendar integration | FreeBusy queries, calendar list, token refresh | `app/services/google_calendar.py` |
| Availability engine | Conflict detection for meetup proposals | `app/routes.py` (proposal endpoint) |
| Database | Users, groups, busy intervals, proposals, invites | `app/models.py` |
| Background sync | Refreshes all users' FreeBusy data every 15 minutes | `app/scheduler.py` |
| Build pipeline | esbuild JS bundle + Tailwind CSS | `scripts/`, `package.json` |
| Demo mode | Pre-populated group when `FLASK_DEBUG=1` | `app/routes.py` (debug routes) |

---

## Tech Stack

[![Python](https://img.shields.io/badge/Python_3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-000000?style=for-the-badge&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-D71F00?style=for-the-badge)](https://sqlalchemy.org)
[![SQLite](https://img.shields.io/badge/SQLite-07405E?style=for-the-badge&logo=sqlite&logoColor=white)](https://sqlite.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://postgresql.org)
[![Google Calendar](https://img.shields.io/badge/Google_Calendar_API-4285F4?style=for-the-badge&logo=google-calendar&logoColor=white)](https://developers.google.com/calendar)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Node.js](https://img.shields.io/badge/Node.js_18+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org)

| Layer | Technology |
|---|---|
| Backend framework | Flask 3.x |
| ORM | SQLAlchemy 2.0 + Flask-SQLAlchemy |
| Database | SQLite (development), PostgreSQL 16 (production) |
| Auth | Google OAuth 2.0 via Authlib, session management via Flask-Login |
| Calendar API | Google Calendar API v3 (FreeBusy, CalendarList, Events) |
| Frontend | Jinja2 templates, vanilla JavaScript |
| Calendar UI | Schedule-X v4.1 |
| CSS | Tailwind CSS v3 |
| JS bundler | esbuild |
| Background jobs | APScheduler |
| Deployment | Docker Compose (PostgreSQL service provided) |
| Testing | pytest (see [Tests](#tests)) |

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- A Google Cloud project with the Google Calendar API enabled (see [Google OAuth Setup](#google-oauth-setup))

### Installation

```bash
git clone https://github.com/horse-3903/calendar-matcher.git
cd calendar-matcher

# Python environment
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt

# Frontend dependencies
npm install
```

### Configuration

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

For a quick local demo using SQLite and debug mode (no PostgreSQL needed):

```env
FLASK_DEBUG=1
SECRET_KEY=replace-with-random-string
DATABASE_URL=sqlite:///app.db
APP_BASE_URL=http://127.0.0.1:5000
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://127.0.0.1:5000/auth/callback
```

### Build and Run

```bash
# Build frontend assets (JS bundle + Tailwind CSS)
npm run build

# Start the app
python run.py
```

Visit `http://127.0.0.1:5000`.

The database is created automatically on first run. To reset it, delete `instance/app.db` and restart.

---

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create a new project
2. Enable the **Google Calendar API** under APIs & Services
3. Configure the **OAuth consent screen**:
   - User type: External
   - Add scopes: `calendar.readonly` and `calendar` (needed for the export feature)
   - While the app is in testing mode, add your Google account as a test user
4. Create an **OAuth 2.0 Client ID** (Application type: Web Application)
5. Add an Authorized redirect URI: `http://127.0.0.1:5000/auth/callback`
6. Copy the Client ID and Client Secret into your `.env`

**Note:** While the OAuth consent screen is in "Testing" status, only accounts you add as test users can sign in. To allow any Google account, submit the app for verification (not required for local development or personal use).

---

## Database Setup

### SQLite (default, zero configuration)

Set `DATABASE_URL=sqlite:///app.db` in `.env`. The database file is created automatically on first run inside the `instance/` directory.

### PostgreSQL (production)

A Docker Compose file is provided for local PostgreSQL:

```bash
docker-compose up -d
```

Then set:

```env
DATABASE_URL=postgresql://horse3903:password123@localhost:5432/calendar_matcher
```

The schema is created automatically on startup via SQLAlchemy `create_all`. No migration tool is required for initial setup. Schema changes are applied with a startup patching routine in `app/__init__.py`.

To reset the database:
- SQLite: delete `instance/app.db`
- PostgreSQL: drop and recreate the database, or use `docker-compose down -v && docker-compose up -d`

---

## Quickstart

### A. Demo mode (no Google Calendar required)

Run with `FLASK_DEBUG=1` and a minimal `.env` (SQLite, no real Google credentials needed to explore the UI — you will need credentials to actually sign in):

```bash
FLASK_DEBUG=1 python run.py
```

When debug mode is enabled, a "Demo Group" (join code `DEMO42`) is automatically created and you are added to it on your first sign-in. The demo group is pre-populated with synthetic busy intervals so you can explore the calendar view.

### B. Full Google Calendar mode

```bash
python run.py
```

1. Visit `http://127.0.0.1:5000`
2. Click "Sign in with Google"
3. Create a group — a join code is generated automatically
4. Share the join code or click "Create invite link" to share a time-limited URL
5. When a second member joins and signs in, their FreeBusy data syncs within 15 minutes (or trigger a manual sync)
6. View the shared calendar to find common free time
7. Propose a meeting time — the app reports which members have conflicts

---

## Screenshots

> TODO: Add screenshot of the sign-in / landing page.

> TODO: Add screenshot of the group calendar view showing color-coded busy blocks.

> TODO: Add screenshot of the meetup proposal dialog with conflict warnings.

> TODO: Add screenshot of the group settings and join code panel.

> TODO: Add a short demo GIF of creating a group and viewing shared availability.

---

## How availability matching works

### FreeBusy data fetching

On sign-in and every 15 minutes thereafter, the app calls the [Google Calendar FreeBusy API](https://developers.google.com/calendar/api/v3/reference/freebusy/query) for each user. The query covers a 6-month window (180 days forward), split into 90-day chunks to stay within API limits.

The response contains only `{"busy": [{"start": "...", "end": "..."}]}` per calendar — no event titles, descriptions, or attendees.

### Storage

Busy intervals are stored in the `busy_intervals` table with only: `user_id`, `start`, `end`, `calendar_id`, `fetched_at`. There is no title or description column.

### Conflict detection

When a user proposes a meeting time, the backend runs two overlap queries:

```python
# Busy intervals from Google Calendar
busy = BusyInterval.query
    .filter(user_id.in_(member_ids))
    .filter(BusyInterval.end > proposal.start)
    .filter(BusyInterval.start < proposal.end)
    .all()

# Manual block-off overlays
blockoffs = SpecialEvent.query
    .filter_by(group_id=group_id, kind="block_off")
    .filter(SpecialEvent.end > proposal.start)
    .filter(SpecialEvent.start < proposal.end)
    .all()
```

Any member appearing in either result is returned as a conflict. The proposal is still saved — it is the user's choice whether to proceed.

### Special event overrides

Members can create two kinds of overlays:
- **available** - marks a time as free even if Google Calendar shows a busy block (displayed as an inverse-background event)
- **block_off** - marks a time as unavailable even if the calendar is clear (treated as a busy block in conflict detection)

### Calendar selection

Users can choose which of their Google Calendars to include in FreeBusy queries (e.g. exclude personal calendars, include only work). The selection is stored per user and applied on the next sync.

---

## Timezone handling

- **Storage:** all datetimes in the database use UTC with timezone info
- **User timezone:** extracted from the primary Google Calendar on first sign-in and stored as a GMT offset string (e.g. `GMT+08:00`)
- **Group timezone:** defaults to the creator's timezone, editable by admins; used to initialise the Schedule-X calendar display
- **Display:** the Schedule-X calendar library handles local display conversion in the browser
- **FreeBusy queries:** sent and received in ISO 8601 UTC format
- **DST:** handled via Python `zoneinfo.ZoneInfo` for offset calculation; the `_to_gmt_offset` helper converts IANA timezone names to current GMT offsets
- **Limitation:** cross-timezone availability display depends on the browser's local time rendering; explicit per-user timezone support in the UI is a planned improvement

---

## Privacy and security notes

| Concern | Current approach |
|---|---|
| Event content | FreeBusy API used; titles, descriptions, attendees never requested or stored |
| OAuth scopes | `calendar.readonly` for reading; `calendar` added only for the export-to-Google-Calendar feature |
| Token storage | Access and refresh tokens stored in plaintext in the database. The model comment notes: *"store securely in production; consider encryption at rest."* This is adequate for personal/team use but not for a public production deployment without hardening |
| Session security | Flask-Login cookie sessions; Authlib OAuth state parameter prevents CSRF on the callback |
| Group access control | Every API endpoint verifies `Membership` before returning data; role checks guard admin operations |
| Invite links | Tokens signed with `SECRET_KEY` via itsdangerous; expiry enforced on every redemption |
| Join codes | Generated from an unambiguous alphabet (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`) using `secrets.choice`; admins can regenerate at any time |
| Debug endpoints | Protected by a `_require_debug_access()` check; in production require matching `DEBUG_OWNER_EMAIL` |

**Before deploying publicly:** rotate `SECRET_KEY`, use a strong `DATABASE_URL`, consider encrypting tokens at rest, and enforce HTTPS.

---

## Project structure

```
calendar-matcher/
├── app/
│   ├── __init__.py              # App factory, DB init, schema patching
│   ├── auth.py                  # Google OAuth 2.0 flow
│   ├── config.py                # Configuration from environment
│   ├── extensions.py            # SQLAlchemy and Flask-Login setup
│   ├── models.py                # 6 SQLAlchemy models
│   ├── routes.py                # All Flask route handlers (~1050 lines)
│   ├── scheduler.py             # APScheduler background sync (15-min interval)
│   ├── services/
│   │   ├── colors.py            # Distinct color generation (HSV + golden ratio)
│   │   ├── google_calendar.py   # Google Calendar API client
│   │   └── invites.py           # Join code and invite token generation
│   ├── static/
│   │   ├── main.js              # Calendar UI logic (Schedule-X, theme, dialogs)
│   │   ├── main.bundle.js       # Bundled output (esbuild)
│   │   ├── tailwind.css         # Tailwind CSS output
│   │   ├── styles.css           # Global custom styles
│   │   └── favicon.svg
│   └── templates/
│       ├── base.html            # Layout and navigation
│       ├── index.html           # Landing page / dashboard
│       ├── dashboard.html       # Group calendar view
│       ├── settings.html        # User profile settings
│       └── errors/              # 403, 404, 500 pages
├── scripts/
│   ├── build-main.mjs           # esbuild: bundles app/static/main.js
│   └── build-calendar.mjs       # Copies Schedule-X theme CSS
├── tests/
│   └── test_availability.py     # Unit tests for conflict detection logic
├── docs/                        # MkDocs documentation source
│   ├── features/                # Feature docs (availability, groups, export, sync)
│   └── setup/                   # Setup guides (local, database, OAuth, build)
├── docker-compose.yml           # PostgreSQL 16 service for local development
├── run.py                       # App entry point
├── requirements.txt             # Python dependencies
├── package.json                 # Frontend build scripts and dependencies
├── tailwind.config.js           # Tailwind configuration
├── mkdocs.yml                   # Documentation site configuration
├── .env.example                 # Environment variable template
└── LICENSE                      # MIT
```

---

## Build commands

| Command | Description |
|---|---|
| `npm run build` | Full build: JS bundle + Schedule-X CSS + Tailwind |
| `npm run build:js` | Bundle `app/static/main.js` with esbuild |
| `npm run build:calendar` | Copy Schedule-X theme CSS |
| `npm run build:css` | Build Tailwind CSS |
| `npm run watch:css` | Watch and rebuild Tailwind CSS |

---

## Tests

Unit tests cover the core availability logic without requiring Google OAuth or a running server.

```bash
pip install pytest
pytest tests/
```

Tests cover:
- Busy interval overlap detection
- Conflict detection across multiple group members
- Special event override logic (available / block_off)
- Timezone UTC normalization

---

## Environment variables

See `.env.example` for the full list. Summary:

| Variable | Required | Description |
|---|---|---|
| `SECRET_KEY` | Yes | Flask session secret and invite token signing key |
| `GOOGLE_CLIENT_ID` | Yes | OAuth 2.0 client ID from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Yes | OAuth 2.0 client secret |
| `GOOGLE_REDIRECT_URI` | Yes | Must match the redirect URI in Google Cloud Console |
| `DATABASE_URL` | No | SQLAlchemy connection string (default: `sqlite:///app.db`) |
| `APP_BASE_URL` | No | Base URL used in invite link generation (default: `http://127.0.0.1:5000`) |
| `FLASK_DEBUG` | No | Set to `1` to enable debug mode and the demo group |
| `FLASK_ENV` | No | `development` or `production` |
| `DEBUG_OWNER_EMAIL` | No | Email address that can access debug endpoints in production |
| `APP_MODE` | No | `dev` or `prod`; controls additional runtime behaviour |

---

## Limitations

- **Google OAuth required for full functionality** - demo mode lets you explore the UI but you still need Google credentials to sign in
- **OAuth consent screen verification** - without Google verification, only manually added test users can sign in
- **Token storage** - OAuth tokens are stored in plaintext in the database; encryption at rest is recommended before any public deployment
- **No automatic conflict resolution** - the app warns about conflicts but does not suggest alternative times
- **Timezone display** - times are displayed in the browser's local timezone via Schedule-X; explicit per-user timezone controls are not yet in the UI
- **No recurring meeting support** - proposals are single time slots
- **Availability freshness** - depends on the 15-minute sync interval; manual sync is available via the UI

---

## Future work

- Recurring meeting support
- More calendar providers (Outlook, Apple Calendar)
- Suggested alternative times when a proposal has conflicts
- Better mobile UI
- Notification and reminder integration
- Stronger privacy controls and token encryption at rest
- Team and organisation support with hierarchical groups
- Availability preferences (working hours, focus time)
- Public share links for availability without requiring sign-in
- Audit logging for group access and data sync events
- Full test coverage including API route smoke tests

---

## Why this project is interesting

**Calendar Matcher** tackles a coordination problem that most people encounter repeatedly but most tools solve poorly. Existing options either ask everyone to manually describe their schedule, or require sharing full calendar access that exposes private event details.

This project demonstrates:
- **Full-stack product engineering** - Flask backend, Jinja2 + vanilla JS frontend, background scheduler, build pipeline, and Docker-based local development
- **OAuth and external API integration** - production-grade Google OAuth 2.0 flow with offline access, token refresh, and scoped permissions
- **Privacy-aware system design** - the FreeBusy-only data model is a deliberate architectural choice that shapes the schema, the API calls, and the UI
- **Non-trivial date and time handling** - UTC storage, IANA timezone normalization, DST-aware offset computation, and chunked multi-month API queries
- **Real product decisions** - join codes, invite links with expiry, per-member color assignment, admin roles, and export back to Google Calendar are features a real team scheduling tool needs

---

## License

MIT License - see [LICENSE](LICENSE) for details.
