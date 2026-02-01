# Troubleshooting

## FreeBusy error: timeRangeTooLong
Phase chunks requests into 90‑day windows. Ensure you’re on the latest code.

## OAuth mismatching_state
Clear cookies and restart Flask. Ensure redirect URI matches exactly.

## Sync fails with 401
Refresh token missing. Re‑login to Google.

## Build errors
```bash
npm install
npm run build
```

## Calendar styling missing
Ensure `app/static/schedule-x.css` exists by running:
```bash
npm run build:calendar
```

## Postgres missing columns
Run the schema update SQL in Render (see Database setup).
