# Phase

Phase is a group scheduling app that connects to Google Calendar, shows shared availability, and helps teams find meeting times without sharing event details.

## Table of contents
- Overview
- Features
- Quick start
- Detailed setup
- Google OAuth setup
- Database and migrations
- Running the app
- Frontend build
- Syncing behavior
- Using the app (beginner guide)
- Demo mode
- API reference
- Troubleshooting
- Project structure
- Scripts
- Environment variables

## Overview
- Built with Flask + SQLAlchemy on the backend.
- Uses Google OAuth 2.0 for sign-in and Google Calendar read-only access.
- Renders HTML with Jinja templates and uses Schedule-X for the calendar UI.
- Uses a background scheduler to refresh calendar data every 15 minutes.

## Features
Authentication and accounts
- Login with Google OAuth 2.0.
- Profile settings: username, display name, bio, location, timezone, profile photo.
- Theme toggle (light/dark) persisted in localStorage.

Groups
- Create groups with unique join codes.
- Join groups using a join code or invite link.
- Shareable invite links with expiry.
- Auto-assign distinct member colors within a group.

Calendar and availability
- Calendar view powered by Schedule-X (week/day/month/list views).
- Displays member busy time from Google Calendar without event titles/details.
- Custom color coding per member.
- Special events:
  - Available: mark yourself available even if busy.
  - Block-off: mark time blocked even if no events exist.
- Meetup proposals with conflict warnings.
- Calendar theme matches app theme (light/dark).
- Optional auto-scroll to first event in the current range.

Syncing
- Manual sync via UI.
- Auto-sync interval selection (client side).
- Server-side background sync every 15 minutes.
- Choose which Google calendars to include in sync.

Demo
- Demo dashboard and demo group experience (enabled in debug).
- Pre-filled demo events and UI state.

## Quick start
1) Install Python and Node.js
- Python 3.10+ recommended
- Node.js 18+ recommended

2) Create and activate a Python environment
```bash
python -m venv .venv
.venv\Scripts\activate
```

3) Install backend dependencies
```bash
pip install -r requirements.txt
```

4) Install frontend dependencies
```bash
npm install
```

5) Configure environment variables
Create a `.env` file in the project root (see Environment variables section).

6) Build frontend assets
```bash
npm run build
```

7) Run the app
```bash
python run.py
```

Visit `http://127.0.0.1:5000`.

## Detailed setup

### 1) Python environment
```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

### 2) Node environment
```bash
npm install
```

### 3) Environment variables
Create `.env` in the project root. Example:
```env
FLASK_ENV=development
FLASK_DEBUG=1
SECRET_KEY=replace-me
APP_BASE_URL=http://127.0.0.1:5000
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
DATABASE_URL=sqlite:///app.db
```

### 4) OAuth setup (Google)
1. Go to Google Cloud Console.
2. Create a project.
3. Enable Google Calendar API.
4. Configure OAuth consent screen.
5. Create OAuth Client ID (Web Application).
6. Add Authorized redirect URIs:
   - `http://127.0.0.1:5000/auth/callback`
7. Copy Client ID and Client Secret into `.env`.

### 5) Database
The app uses SQLite by default. Tables are created automatically on startup.
- To reset DB: delete `instance/app.db` (if using default sqlite path) and restart.

### 6) Build frontend assets
```bash
npm run build
```
This builds:
- `app/static/main.bundle.js`
- `app/static/schedule-x.css`
- `app/static/styles.css` (Tailwind build)

### 7) Run
```bash
python run.py
```

## Frontend build
- JavaScript bundle: `scripts/build-main.mjs` -> `app/static/main.bundle.js`
- Schedule-X theme CSS: `scripts/build-calendar.mjs` -> `app/static/schedule-x.css`
- Tailwind CSS build: configured in `tailwind.config.js`

Common commands:
```bash
npm run build:js
npm run build:calendar
npm run build:css
npm run build:assets
npm run build
```

## Syncing behavior
- Manual sync: Sync Calendar card on the dashboard.
- Auto-sync (client): choose interval in Sync dialog; stored in localStorage.
- Server scheduler: runs every 15 minutes for all users with tokens.
- Calendar selection: choose which calendars to include before syncing.

## Using the app (beginner guide)

### First time
1) Open the app and click Login with Google.
2) Grant read-only calendar access.
3) You will land on your dashboard.

### Create a group
1) Click “Create a Group”.
2) Name the group and create.
3) Share the join code or invite link with others.

### Join a group
1) Click “Join a Group”.
2) Enter a join code.

### Sync your calendar
1) Click “Sync Calendar”.
2) Choose which calendars to include.
3) Click “Sync now”.
4) Optional: choose an auto-sync interval.

### View shared availability
- Go to a group page.
- The calendar shows member busy blocks as “Busy - <Name>”.
- No event details are shown.

### Add availability or block-off
1) Select a time range on the calendar.
2) Click “Add Available Time” or “Block Off Time”.
3) Submit.

### Propose a meetup
1) Select a time range on the calendar.
2) Click “Propose Meetup”.
3) Add location/description.
4) If conflicts exist, the app warns which members are busy.

## Demo mode
- When `FLASK_DEBUG=1`, users automatically see a Demo Group and Demo page.
- Demo events are generated locally and do not sync with Google.

## API reference (internal)

### Auth
- `GET /auth/login` -> Google OAuth flow
- `GET /auth/callback` -> OAuth callback

### Groups
- `POST /groups/create`
- `POST /groups/join`
- `GET /groups/<id>`
- `POST /groups/<id>/invite/create`
- `GET /invite/<token>`

### Calendar data
- `GET /api/groups/<id>/members`
- `GET /api/groups/<id>/events?start=...&end=...`
- `POST /api/groups/<id>/special`
- `POST /api/groups/<id>/proposal`

### Sync
- `POST /api/sync/me`
- `GET /api/calendars`
- `POST /api/calendars/selection`

## Troubleshooting

### Sync fails or returns 500
- Make sure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set.
- Ensure the OAuth consent screen is configured.
- Confirm the user has granted calendar read-only access.

### Calendar not rendering
- Run `npm run build` to regenerate assets.
- Confirm `app/static/main.bundle.js` exists.

### No events appear
- Sync calendar and wait for the scheduler, or click Sync now.
- Confirm you selected at least one calendar in Sync settings.

### AM/PM or timezone mismatch
- Set your timezone in Settings.

## Project structure
```
app/
  auth.py
  config.py
  extensions.py
  models.py
  routes.py
  scheduler.py
  services/
    colors.py
    google_calendar.py
    invites.py
  static/
    main.js
    main.bundle.js
    schedule-x.css
    styles.css
  templates/
    base.html
    index.html
    dashboard.html
    settings.html
scripts/
  build-calendar.mjs
  build-main.mjs
run.py
package.json
requirements.txt
```

## Scripts
- `npm run build:js` - bundle `app/static/main.js`
- `npm run build:calendar` - copy Schedule-X theme CSS
- `npm run build:css` - build Tailwind CSS
- `npm run build:assets` - build JS + calendar CSS
- `npm run build` - build assets + CSS

## Environment variables
- `FLASK_ENV` - set to `development` or `production`
- `FLASK_DEBUG` - `1` to enable debug/demo
- `SECRET_KEY` - Flask session secret
- `APP_BASE_URL` - base URL for invite links
- `GOOGLE_CLIENT_ID` - OAuth client ID
- `GOOGLE_CLIENT_SECRET` - OAuth client secret
- `DATABASE_URL` - SQLAlchemy database URI (default: sqlite:///app.db)
