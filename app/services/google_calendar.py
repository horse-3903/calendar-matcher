from datetime import datetime, timezone
import requests

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
FREEBUSY_URL = "https://www.googleapis.com/calendar/v3/freeBusy"
CALENDAR_LIST_URL = "https://www.googleapis.com/calendar/v3/users/me/calendarList"
CALENDAR_CREATE_URL = "https://www.googleapis.com/calendar/v3/calendars"
CALENDAR_DETAIL_URL = "https://www.googleapis.com/calendar/v3/calendars/{calendar_id}"
CALENDAR_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/{calendar_id}/events"
CALENDAR_ACL_URL = "https://www.googleapis.com/calendar/v3/calendars/{calendar_id}/acl"
CALENDAR_COLORS_URL = "https://www.googleapis.com/calendar/v3/colors"

def is_expired(user):
    if user.token_expiry is None:
        return True
    expiry = user.token_expiry
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)
    return expiry <= datetime.now(timezone.utc)

def _get_config_value(config, key):
    if hasattr(config, "get"):
        return config.get(key)
    return getattr(config, key, None)

def refresh_access_token(config, user):
    if not user.refresh_token:
        raise RuntimeError("No refresh_token stored; user must re-consent.")

    resp = requests.post(GOOGLE_TOKEN_URL, data={
        "client_id": _get_config_value(config, "GOOGLE_CLIENT_ID"),
        "client_secret": _get_config_value(config, "GOOGLE_CLIENT_SECRET"),
        "refresh_token": user.refresh_token,
        "grant_type": "refresh_token",
    }, timeout=15)
    resp.raise_for_status()
    data = resp.json()

    user.access_token = data["access_token"]
    # expires_in seconds
    user.token_expiry = datetime.now(timezone.utc).replace(microsecond=0) + __import__("datetime").timedelta(seconds=int(data.get("expires_in", 3600)))
    return user

def freebusy_query(access_token: str, time_min_iso: str, time_max_iso: str, calendar_ids=None):
    if calendar_ids is None:
        calendar_ids = ["primary"]
    calendar_ids = [cid for cid in calendar_ids if isinstance(cid, str) and cid.strip()]
    if not calendar_ids:
        calendar_ids = ["primary"]

    payload = {
        "timeMin": time_min_iso,
        "timeMax": time_max_iso,
        "items": [{"id": cid} for cid in calendar_ids],
    }

    resp = requests.post(
        FREEBUSY_URL,
        headers={"Authorization": f"Bearer {access_token}"},
        json=payload,
        timeout=20,
    )
    resp.raise_for_status()
    return resp.json()

def list_calendar_ids(access_token: str):
    """Return list of calendar IDs for the user."""
    ids = []
    page_token = None
    while True:
        params = {}
        if page_token:
            params["pageToken"] = page_token
        resp = requests.get(
            CALENDAR_LIST_URL,
            headers={"Authorization": f"Bearer {access_token}"},
            params=params,
            timeout=20,
        )
        resp.raise_for_status()
        data = resp.json()
        for item in data.get("items", []):
            cid = item.get("id")
            if cid:
                ids.append(cid)
        page_token = data.get("nextPageToken")
        if not page_token:
            break
    return ids

def list_calendars(access_token: str):
    """Return list of calendar metadata for the user."""
    items = []
    page_token = None
    while True:
        params = {}
        if page_token:
            params["pageToken"] = page_token
        resp = requests.get(
            CALENDAR_LIST_URL,
            headers={"Authorization": f"Bearer {access_token}"},
            params=params,
            timeout=20,
        )
        resp.raise_for_status()
        data = resp.json()
        for item in data.get("items", []):
            items.append({
                "id": item.get("id"),
                "summary": item.get("summary") or item.get("id"),
                "primary": bool(item.get("primary")),
                "accessRole": item.get("accessRole"),
                "selected": bool(item.get("selected")),
                "timeZone": item.get("timeZone"),
            })
        page_token = data.get("nextPageToken")
        if not page_token:
            break
    return items

def create_calendar(access_token: str, summary: str, timezone: str = "UTC"):
    payload = {
        "summary": summary,
        "timeZone": timezone or "UTC",
    }
    resp = requests.post(
        CALENDAR_CREATE_URL,
        headers={"Authorization": f"Bearer {access_token}"},
        json=payload,
        timeout=20,
    )
    if resp.status_code >= 400:
        detail = ""
        try:
            detail = resp.text
        except Exception:
            detail = ""
        raise requests.HTTPError(f"{resp.status_code} {resp.reason} {detail}", response=resp)
    return resp.json()

def freebusy_query_chunked(access_token: str, time_min_iso: str, time_max_iso: str, calendar_ids=None, chunk_days: int = 90):
    """Query FreeBusy in smaller chunks and merge results."""
    def parse_iso(value: str):
        return datetime.fromisoformat(value.replace("Z", "+00:00"))

    start = parse_iso(time_min_iso)
    end = parse_iso(time_max_iso)
    if start >= end:
        return {"calendars": {}}

    merged = {}
    cursor = start
    while cursor < end:
        chunk_end = min(cursor + __import__("datetime").timedelta(days=chunk_days), end)
        fb = freebusy_query(access_token, cursor.isoformat(), chunk_end.isoformat(), calendar_ids=calendar_ids)
        calendars = fb.get("calendars", {})
        for cid, data in calendars.items():
            merged.setdefault(cid, {"busy": []})
            merged[cid]["busy"].extend(data.get("busy", []))
        cursor = chunk_end

    return {"calendars": merged}

def update_calendar(access_token: str, calendar_id: str, summary: str | None = None, timezone: str | None = None):
    payload = {}
    if summary:
        payload["summary"] = summary
    if timezone:
        payload["timeZone"] = timezone
    if not payload:
        return {"id": calendar_id}
    resp = requests.patch(
        CALENDAR_DETAIL_URL.format(calendar_id=calendar_id),
        headers={"Authorization": f"Bearer {access_token}"},
        json=payload,
        timeout=20,
    )
    if resp.status_code >= 400:
        detail = ""
        try:
            detail = resp.text
        except Exception:
            detail = ""
        raise requests.HTTPError(f"{resp.status_code} {resp.reason} {detail}", response=resp)
    return resp.json()

def insert_calendar_event(access_token: str, calendar_id: str, event_body: dict):
    resp = requests.post(
        CALENDAR_EVENTS_URL.format(calendar_id=calendar_id),
        headers={"Authorization": f"Bearer {access_token}"},
        json=event_body,
        timeout=20,
    )
    resp.raise_for_status()
    return resp.json()

def list_calendar_colors(access_token: str):
    resp = requests.get(
        CALENDAR_COLORS_URL,
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=20,
    )
    resp.raise_for_status()
    return resp.json()

def list_calendar_events(access_token: str, calendar_id: str, time_min: str | None = None, time_max: str | None = None, private_prop: str | None = None):
    params = {"singleEvents": True, "orderBy": "startTime"}
    if time_min:
        params["timeMin"] = time_min
    if time_max:
        params["timeMax"] = time_max
    if private_prop:
        params["privateExtendedProperty"] = private_prop
    events = []
    page_token = None
    while True:
        if page_token:
            params["pageToken"] = page_token
        resp = requests.get(
            CALENDAR_EVENTS_URL.format(calendar_id=calendar_id),
            headers={"Authorization": f"Bearer {access_token}"},
            params=params,
            timeout=20,
        )
        resp.raise_for_status()
        data = resp.json()
        events.extend(data.get("items", []))
        page_token = data.get("nextPageToken")
        if not page_token:
            break
    return events

def delete_calendar_event(access_token: str, calendar_id: str, event_id: str):
    resp = requests.delete(
        CALENDAR_EVENTS_URL.format(calendar_id=calendar_id) + f"/{event_id}",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=20,
    )
    if resp.status_code not in (200, 204):
        resp.raise_for_status()
    return True

def add_calendar_acl(access_token: str, calendar_id: str, email: str, role: str = "reader"):
    payload = {
        "role": role,
        "scope": {"type": "user", "value": email},
    }
    resp = requests.post(
        CALENDAR_ACL_URL.format(calendar_id=calendar_id),
        headers={"Authorization": f"Bearer {access_token}"},
        json=payload,
        timeout=20,
    )
    resp.raise_for_status()
    return resp.json()
