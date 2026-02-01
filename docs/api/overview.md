# API Overview

High‑level endpoints used by the frontend:

## Sync & calendars
- `POST /api/sync/me` → sync FreeBusy (6 months)
- `GET /api/calendars` → list calendars
- `POST /api/calendars/selection` → save selection

## Events
- `GET /api/groups/<id>/events` → calendar data for Schedule-X
- `POST /api/groups/<id>/special` → add available/blocked
- `POST /api/groups/<id>/proposal` → propose meetup

## Export
- `GET /api/groups/<id>/export/google/options`
- `POST /api/groups/<id>/export/google`

## Group management
- `POST /groups/<id>/settings`
- `POST /groups/<id>/join-code/regenerate`
