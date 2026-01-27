from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timezone, timedelta

from app.extensions import db
from app.models import User, BusyInterval
from app.services.google_calendar import is_expired, refresh_access_token, freebusy_query, list_calendar_ids

def start_scheduler(app):
    scheduler = BackgroundScheduler(daemon=True)

    def job():
        with app.app_context():
            # sync a 30-day window per user
            time_min = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
            time_max = (datetime.now(timezone.utc) + timedelta(days=30)).replace(microsecond=0).isoformat()

            users = User.query.all()
            for user in users:
                if not user.access_token:
                    continue
                try:
                    if is_expired(user):
                        refresh_access_token(app.config, user)
                        db.session.commit()

                    selected_ids = None
                    raw = getattr(user, "calendar_ids_json", None)
                    if raw:
                        try:
                            data = __import__("json").loads(raw)
                            if isinstance(data, list):
                                selected_ids = [cid for cid in data if isinstance(cid, str) and cid.strip()]
                        except Exception:
                            selected_ids = None
                    calendar_ids = selected_ids or (list_calendar_ids(user.access_token) or ["primary"])
                    fb = freebusy_query(user.access_token, time_min, time_max, calendar_ids=calendar_ids)

                    BusyInterval.query.filter_by(user_id=user.id).delete()
                    calendars = fb.get("calendars", {})
                    for cid, data in calendars.items():
                        for blk in data.get("busy", []):
                            db.session.add(BusyInterval(
                                user_id=user.id,
                                calendar_id=cid,
                                start=datetime.fromisoformat(blk["start"].replace("Z", "+00:00")),
                                end=datetime.fromisoformat(blk["end"].replace("Z", "+00:00")),
                            ))
                    db.session.commit()
                except Exception:
                    db.session.rollback()

    scheduler.add_job(job, "interval", minutes=15)
    scheduler.start()
    return scheduler
