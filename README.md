<div align="center">

# calendar-matcher

Group scheduling app that overlays shared Google Calendar availability without exposing event details

[![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-000000?style=flat-square&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![Google Calendar](https://img.shields.io/badge/Google_Calendar_API-4285F4?style=flat-square&logo=google-calendar&logoColor=white)](https://developers.google.com/calendar)
[![License](https://img.shields.io/github/license/horse-3903/calendar-matcher?style=flat-square)](LICENSE)
[![Last Commit](https://img.shields.io/github/last-commit/horse-3903/calendar-matcher?style=flat-square)](../../commits)

</div>

---

## Overview

**calendar-matcher** (Phase) is a group scheduling web app that connects to Google Calendar, displays shared availability across team members, and helps find meeting times — without ever revealing event titles or details. Members see each other's busy blocks color-coded by person, can propose meetups with conflict warnings, and can mark custom availability or block-off times.

## Features

- **Google OAuth 2.0** sign-in with read-only Calendar access
- **Groups** — create with unique join codes, join via code or shareable invite link
- **Calendar view** powered by Schedule-X (week/day/month/list views)
- **Busy-time overlay** — member availability shown as color-coded blocks with no event details exposed
- **Special events** — mark yourself available despite busy events, or block off free time
- **Meetup proposals** — propose a time slot with conflict warnings for each member
- **Auto-sync** — background scheduler refreshes calendar data every 15 minutes; configurable client-side interval
- **Light/dark theme** toggle persisted in localStorage
- **Demo mode** — pre-filled demo group and events when running in debug mode

## Tech Stack

[![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-000000?style=for-the-badge&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-D71F00?style=for-the-badge)](https://sqlalchemy.org)
[![Google Calendar](https://img.shields.io/badge/Google_Calendar_API-4285F4?style=for-the-badge&logo=google-calendar&logoColor=white)](https://developers.google.com/calendar)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org)

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- A Google Cloud project with the **Google Calendar API** enabled

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project and enable the **Google Calendar API**
3. Configure the **OAuth consent screen** (External, read-only calendar scope)
4. Create an **OAuth 2.0 Client ID** (Web Application)
5. Add Authorized redirect URI: `http://127.0.0.1:5000/auth/callback`
6. Copy your **Client ID** and **Client Secret** — you will need them below

### Installation

```bash
git clone https://github.com/horse-3903/calendar-matcher.git
cd calendar-matcher

# Python environment
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt

# Frontend dependencies
npm install
```

### Configuration

Create a `.env` file in the project root:

```env
FLASK_ENV=development
FLASK_DEBUG=1
SECRET_KEY=replace-me-with-a-random-string
APP_BASE_URL=http://127.0.0.1:5000
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
DATABASE_URL=sqlite:///app.db
```

### Build and Run

```bash
# Build frontend assets (JS bundle + Tailwind CSS)
npm run build

# Start the app
python run.py
```

Visit `http://127.0.0.1:5000`.

The database is created automatically on first startup. To reset it, delete `instance/app.db` and restart.

## Project Structure

```
calendar-matcher/
├── app/
│   ├── auth.py                  # Google OAuth flow
│   ├── config.py
│   ├── models.py                # SQLAlchemy models
│   ├── routes.py                # Flask routes
│   ├── scheduler.py             # Background sync scheduler (15 min interval)
│   ├── services/
│   │   ├── colors.py            # Member color assignment
│   │   ├── google_calendar.py   # Calendar API integration
│   │   └── invites.py           # Invite link generation
│   ├── static/                  # Built JS and CSS assets
│   └── templates/               # Jinja2 HTML templates
├── scripts/
│   ├── build-main.mjs           # JS bundle build
│   └── build-calendar.mjs       # Schedule-X CSS build
├── docs/                        # MkDocs documentation
├── run.py
├── package.json
└── requirements.txt
```

## Frontend Build Commands

| Command | Description |
|---------|-------------|
| `npm run build:js` | Bundle `app/static/main.js` |
| `npm run build:calendar` | Copy Schedule-X theme CSS |
| `npm run build:css` | Build Tailwind CSS |
| `npm run build` | Full build (all assets) |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `FLASK_ENV` | `development` or `production` |
| `FLASK_DEBUG` | `1` to enable debug/demo mode |
| `SECRET_KEY` | Flask session secret |
| `APP_BASE_URL` | Base URL for invite links |
| `GOOGLE_CLIENT_ID` | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret |
| `DATABASE_URL` | SQLAlchemy database URI (default: `sqlite:///app.db`) |

## API Reference

| Endpoint | Description |
|----------|-------------|
| `GET /auth/login` | Initiate Google OAuth flow |
| `GET /auth/callback` | OAuth callback |
| `POST /groups/create` | Create a group |
| `POST /groups/join` | Join a group |
| `GET /api/groups/<id>/events` | Get busy events for calendar view |
| `POST /api/groups/<id>/special` | Add available/block-off event |
| `POST /api/groups/<id>/proposal` | Propose a meetup |
| `POST /api/sync/me` | Trigger manual calendar sync |

## License

MIT License — see [LICENSE](LICENSE) for details.