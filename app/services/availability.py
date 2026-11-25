"""Conservative interval matching; no private event metadata needed."""
from datetime import datetime, timezone


def utc(value):
    if isinstance(value, str):
        value = datetime.fromisoformat(value.replace('Z', '+00:00'))
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def covered(start, end, intervals):
    cursor = start
    for a, b in sorted((utc(a), utc(b)) for a, b in intervals):
        if b <= cursor:
            continue
        if a > cursor:
            return False
        cursor = max(cursor, b)
        if cursor >= end:
            return True
    return cursor >= end


def member_state(start, end, busy, available, blocked, verified):
    """Explicit block wins; manual free overrides only covered busy portions."""
    if any(utc(a) < end and utc(b) > start for a, b in blocked):
        return 'busy'
    for a, b in busy:
        a, b = max(start, utc(a)), min(end, utc(b))
        if a < b and not covered(a, b, available):
            return 'busy' if verified else 'unknown'
    if verified or covered(start, end, available):
        return 'free'
    return 'unknown'
