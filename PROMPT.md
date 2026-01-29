# Phase — Full Repository Context Prompt

You are working in the **Phase** repository (calendar-matcher). This is a Flask + SQLAlchemy app with a Tailwind frontend and a shared group calendar UI. It integrates Google OAuth and uses **FreeBusy** (not Events) to sync availability. The calendar UI uses **FullCalendar**.

Use this prompt to understand architecture, data flow, and key constraints.

---

## 1) Core Purpose
- Help groups coordinate schedules without exposing event details.
- Google Calendar **FreeBusy only** (no event titles or descriptions are pulled).
- Users can add **Available / Blocked / Proposed** events inside the app.
- Optional export of a **synced Google Calendar** for the group.

---

## 2) Tech Stack
- **Backend:** Flask, SQLAlchemy
- **Frontend:** Jinja templates + Tailwind CSS
- **Calendar UI:** FullCalendar (built with esbuild)
- **Auth:** Google OAuth via Authlib
- **Storage:** SQLite or Postgres (Render)

---

## 3) Key Routes (Backend)
- `POST /api/sync/me` → FreeBusy sync (6 months, chunked to 90‑day windows)
- `GET /api/calendars` → list Google calendars
- `POST /api/calendars/save` → save selected calendar IDs
- `POST /api/groups/<id>/special` → add Available/Blocked
- `POST /api/groups/<id>/proposal` → propose meetup
- `GET /api/groups/<id>/events` → fetch events for calendar
- `POST /api/groups/<id>/export/google` → create/update synced calendar
- `GET /api/groups/<id>/export/google/options` → export settings (colors, etc.)

---

## 4) FreeBusy & Privacy
- The app **only reads busy ranges** using Google FreeBusy.
- It never accesses event titles/details.
- Sync window = now → 6 months (chunked to avoid `timeRangeTooLong`).

---

## 5) Calendar UI (FullCalendar)
- Built via `scripts/build-calendar.mjs` and bundled into `app/static/fullcalendar.css`.
- Main JS is bundled via `scripts/build-main.mjs` into `app/static/main.bundle.js`.
- Calendar event data is fetched from `/api/groups/<id>/events`.
- Events are mapped into FullCalendar with member colors and labels like:
  - `Busy - <Member>`
  - `Available`
  - `Blocked`
  - `Proposed`

---

## 6) Group Export to Google Calendar
- Export creates or updates a dedicated calendar:
  - default name: `Phase - <Group Name>`
  - timezone default = group timezone
- Events are inserted for busy/special/proposal items.
- Member color mapping uses Google color IDs (stored in memberships).

---

## 7) Data Model (Important Fields)
- `groups`: `timezone`, `synced_calendar_id`, `synced_calendar_name`, `synced_calendar_tz`
- `memberships`: `color_hex`, `google_color_id`, `role`

---

## 8) App Modes
`APP_MODE` can be `dev`, `test`, or `prod`.
- Dev Console visible in `dev`
- In `prod`, Dev Console only for `DEBUG_OWNER_EMAIL`

---

## 9) Build / Run
```bash
npm run build
python run.py
```

---

## 10) Constraints
- Do not break OAuth or FreeBusy privacy guarantees.
- Avoid migrations unless requested.
- UI should preserve existing design (dark/light, purple theme).
