# Calendar Sync (FreeBusy)

Phase syncs **only FreeBusy** data.

## How it works
- Fetches availability from selected Google calendars
- Stores **busy ranges only**
- Client-side auto-sync is optional
- Server-side background refresh runs every 15 minutes

## Sync range
- Now → **6 months**
- Split into 90‑day chunks to avoid Google API limits

## Privacy
No event titles, descriptions, or attendees are accessed.

## Calendar selection
Only calendars you select in the Sync dialog are included in FreeBusy requests.
