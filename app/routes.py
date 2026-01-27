from flask import Blueprint, render_template, request, jsonify, redirect, url_for, current_app, abort
from werkzeug.utils import secure_filename
from pathlib import Path
import uuid
import secrets
from types import SimpleNamespace
from flask_login import login_required, current_user
from datetime import datetime, timezone, timedelta
from sqlalchemy import func

from app.extensions import db
from app.models import Group, Membership, BusyInterval, SpecialEvent, MeetupProposal, InviteLink, User
from app.services.invites import make_join_code, make_invite_token, verify_invite_token, expiry_from_days
from app.services.colors import generate_distinct_colors
from app.services.google_calendar import is_expired, refresh_access_token, freebusy_query, list_calendar_ids, list_calendars

main_bp = Blueprint("main", __name__)
api_bp = Blueprint("api", __name__, url_prefix="/api")

def require_membership(group_id: int):
    m = Membership.query.filter_by(group_id=group_id, user_id=current_user.id).first()
    if not m:
        abort(403)
    return m

def _parse_calendar_selection(user):
    raw = getattr(user, "calendar_ids_json", None)
    if not raw:
        return None
    try:
        data = __import__("json").loads(raw)
    except Exception:
        return None
    if not isinstance(data, list):
        return None
    filtered = [cid for cid in data if isinstance(cid, str) and cid.strip()]
    return filtered or None

def _get_user_groups(user_id: int):
    rows = (
        db.session.query(Group, func.count(Membership.id))
        .join(Membership, Membership.group_id == Group.id)
        .filter(Membership.user_id == user_id)
        .group_by(Group.id)
        .all()
    )
    return [{
        "id": g.id,
        "name": g.name,
        "join_code": g.join_code,
        "member_count": int(count or 0),
    } for g, count in rows]

def _get_debug_user():
    user = User.query.filter_by(google_sub="debug_local").first()
    if user:
        return user
    username = None
    try:
        username = _random_username()
    except Exception:
        username = f"debug_{secrets.token_hex(3)}"
    user = User(
        google_sub="debug_local",
        email="debug@local",
        name="Debug User",
        username=username,
        display_name="Debug User",
    )
    db.session.add(user)
    db.session.commit()
    return user

def _require_debug_access():
    if current_app.debug:
        return current_user if current_user.is_authenticated else _get_debug_user()
    owner = current_app.config.get("DEBUG_OWNER_EMAIL") or ""
    if not current_user.is_authenticated:
        abort(403)
    if not owner or current_user.email != owner:
        abort(403)
    return current_user

@main_bp.before_app_request
def _ensure_demo_group_membership():
    if not current_app.debug or not current_user.is_authenticated:
        return
    demo_group = Group.query.filter_by(join_code="DEMO42").first()
    if not demo_group:
        demo_group = Group(name="Demo Group", join_code="DEMO42", created_by=current_user.id)
        db.session.add(demo_group)
        db.session.flush()
    existing = Membership.query.filter_by(group_id=demo_group.id, user_id=current_user.id).first()
    if not existing:
        members = Membership.query.filter_by(group_id=demo_group.id).all()
        colors = generate_distinct_colors(len(members) + 1)
        used = {m.color_hex for m in members}
        new_color = next(c for c in colors if c not in used)
        db.session.add(Membership(user_id=current_user.id, group_id=demo_group.id, role="member", color_hex=new_color))
    db.session.commit()

@main_bp.get("/")
def index():
    groups = []
    if current_user.is_authenticated:
        groups = _get_user_groups(current_user.id)
    return render_template("index.html", groups=groups)

@main_bp.get("/demo")
def demo():
    return render_template("index.html", demo_mode=True, groups=[])

@main_bp.get("/debug")
def debug_menu():
    user = _require_debug_access()
    groups = _get_user_groups(user.id)
    return render_template("debug.html", groups=groups)

@main_bp.get("/demo/group")
def demo_group():
    demo_group = SimpleNamespace(id=0, name="Demo Group", join_code="DEMO42")
    return render_template("dashboard.html", group=demo_group, members=[], demo_mode=True)

@main_bp.post("/groups/create")
@login_required
def create_group():
    name = request.form.get("name", "").strip() or "Untitled Group"
    join_code = make_join_code()

    g = Group(name=name, join_code=join_code, created_by=current_user.id)
    db.session.add(g)
    db.session.flush()

    # Assign first color to creator
    creator_color = generate_distinct_colors(1)[0]
    db.session.add(Membership(user_id=current_user.id, group_id=g.id, role="admin", color_hex=creator_color))

    db.session.commit()
    return redirect(url_for("main.dashboard", group_id=g.id))

@main_bp.post("/groups/join")
@login_required
def join_group():
    code = request.form.get("code", "").strip().upper()
    g = Group.query.filter_by(join_code=code).first()
    if not g:
        abort(404, "Invalid join code")

    existing = Membership.query.filter_by(group_id=g.id, user_id=current_user.id).first()
    if existing:
        return redirect(url_for("main.dashboard", group_id=g.id))

    # assign next distinct color among members
    members = Membership.query.filter_by(group_id=g.id).all()
    colors = generate_distinct_colors(len(members) + 1)
    used = {m.color_hex for m in members}
    new_color = next(c for c in colors if c not in used)

    db.session.add(Membership(user_id=current_user.id, group_id=g.id, role="member", color_hex=new_color))
    db.session.commit()
    return redirect(url_for("main.dashboard", group_id=g.id))

@main_bp.get("/invite/<token>")
@login_required
def invite_link_join(token):
    # max age enforced by your stored InviteLink expiry
    link = InviteLink.query.filter_by(token=token).first()
    if not link:
        abort(404, "Invite not found")
    if link.expires_at <= datetime.now(timezone.utc):
        abort(410, "Invite expired")

    g = Group.query.get(link.group_id)
    if not g:
        abort(404)

    # same as join_group
    existing = Membership.query.filter_by(group_id=g.id, user_id=current_user.id).first()
    if not existing:
        members = Membership.query.filter_by(group_id=g.id).all()
        colors = generate_distinct_colors(len(members) + 1)
        used = {m.color_hex for m in members}
        new_color = next(c for c in colors if c not in used)
        db.session.add(Membership(user_id=current_user.id, group_id=g.id, role="member", color_hex=new_color))
        db.session.commit()

    return redirect(url_for("main.dashboard", group_id=g.id))

@main_bp.post("/groups/<int:group_id>/invite/create")
@login_required
def create_invite_link(group_id):
    require_membership(group_id)
    days = int(request.form.get("days", "7"))
    token = make_invite_token(current_app.config["SECRET_KEY"], group_id)
    expires_at = expiry_from_days(days)

    link = InviteLink(group_id=group_id, token=token, expires_at=expires_at)
    db.session.add(link)
    db.session.commit()

    share_url = f"{current_app.config['APP_BASE_URL']}/invite/{token}"
    return jsonify({"share_url": share_url, "expires_at": expires_at.isoformat()})

@main_bp.get("/groups/<int:group_id>")
@login_required
def dashboard(group_id):
    require_membership(group_id)
    g = Group.query.get_or_404(group_id)
    members = (
        db.session.query(User, Membership)
        .join(Membership, Membership.user_id == User.id)
        .filter(Membership.group_id == group_id)
        .all()
    )
    return render_template("dashboard.html", group=g, members=members)

# ---------- Account settings ----------

def _allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in {"png", "jpg", "jpeg", "gif", "webp"}

def _random_username() -> str:
    while True:
        candidate = f"user_{secrets.token_hex(3)}"
        if not User.query.filter_by(username=candidate).first():
            return candidate

@main_bp.get("/settings")
@login_required
def settings():
    error = request.args.get("error")
    if not current_user.username:
        current_user.username = _random_username()
        db.session.commit()
    return render_template("settings.html", user=current_user, error=error)

@main_bp.post("/settings")
@login_required
def update_settings():
    user = current_user
    requested_username = request.form.get("username", "").strip()
    if requested_username and requested_username != user.username:
        exists = User.query.filter(User.username == requested_username, User.id != user.id).first()
        if exists:
            return redirect(url_for("main.settings", error="username_taken"))
        user.username = requested_username
    user.display_name = request.form.get("display_name", "").strip() or user.display_name
    user.bio = request.form.get("bio", "").strip() or None
    user.location = request.form.get("location", "").strip() or None
    user.timezone = request.form.get("timezone", "").strip() or None

    file = request.files.get("profile_pic")
    if file and file.filename and _allowed_file(file.filename):
        upload_dir = Path(current_app.config["UPLOAD_FOLDER"])
        upload_dir.mkdir(parents=True, exist_ok=True)
        ext = file.filename.rsplit(".", 1)[1].lower()
        filename = f"{uuid.uuid4().hex}.{ext}"
        file.save(str(upload_dir / filename))
        user.profile_pic_url = f"/static/uploads/{filename}"

    db.session.commit()
    return redirect(url_for("main.settings"))

# ---------- Calendar Data APIs ----------

@api_bp.get("/groups/<int:group_id>/members")
@login_required
def group_members(group_id):
    require_membership(group_id)
    rows = (
        db.session.query(User, Membership)
        .join(Membership, Membership.user_id == User.id)
        .filter(Membership.group_id == group_id)
        .all()
    )
    return jsonify([{
        "user_id": u.id,
        "name": u.name,
        "email": u.email,
        "color": m.color_hex,
    } for u, m in rows])

@api_bp.get("/groups/<int:group_id>/events")
@login_required
def group_events(group_id):
    require_membership(group_id)

    start = request.args.get("start")
    end = request.args.get("end")
    if not start or not end:
        abort(400, "start/end required (ISO8601)")

    start_dt = datetime.fromisoformat(start.replace("Z", "+00:00"))
    end_dt = datetime.fromisoformat(end.replace("Z", "+00:00"))

    # members
    memberships = Membership.query.filter_by(group_id=group_id).all()
    user_ids = [m.user_id for m in memberships]
    member_color = {m.user_id: m.color_hex for m in memberships}

    # busy intervals
    busy = (BusyInterval.query
            .filter(BusyInterval.user_id.in_(user_ids))
            .filter(BusyInterval.end > start_dt)
            .filter(BusyInterval.start < end_dt)
            .all())

    # special events
    specials = (SpecialEvent.query
                .filter_by(group_id=group_id)
                .filter(SpecialEvent.end > start_dt)
                .filter(SpecialEvent.start < end_dt)
                .all())

    # meetup proposals
    proposals = (MeetupProposal.query
                 .filter_by(group_id=group_id)
                 .filter(MeetupProposal.end > start_dt)
                 .filter(MeetupProposal.start < end_dt)
                 .all())

    events = []

    # Busy shown as background events (no titles)
    for b in busy:
        events.append({
            "id": f"busy:{b.id}",
            "start": b.start.isoformat(),
            "end": b.end.isoformat(),
            "display": "background",
            "backgroundColor": member_color.get(b.user_id, "#999999"),
            "extendedProps": {"type": "busy", "user_id": b.user_id},
        })

    # Special overlays
    for s in specials:
        # block_off = background; available = "inverse-background" (visual override)
        display = "background" if s.kind == "block_off" else "inverse-background"
        color = "#111827" if s.kind == "block_off" else "#10b981"
        events.append({
            "id": f"special:{s.id}",
            "title": s.kind.replace("_", " ").title(),
            "start": s.start.isoformat(),
            "end": s.end.isoformat(),
            "display": display,
            "backgroundColor": color,
            "extendedProps": {"type": "special", "kind": s.kind, "user_id": s.user_id},
        })

    # Proposals as normal events
    for p in proposals:
        events.append({
            "id": f"proposal:{p.id}",
            "title": "Meetup Proposal",
            "start": p.start.isoformat(),
            "end": p.end.isoformat(),
            "extendedProps": {
                "type": "proposal",
                "location": p.location,
                "description": p.description,
                "created_by": p.created_by
            },
        })

    return jsonify(events)

@api_bp.post("/groups/<int:group_id>/special")
@login_required
def add_special(group_id):
    require_membership(group_id)
    data = request.get_json(force=True)

    kind = data.get("kind")
    start = data.get("start")
    end = data.get("end")
    if kind not in {"block_off", "available"}:
        abort(400, "kind must be block_off or available")
    if not start or not end:
        abort(400, "start/end required")

    s = SpecialEvent(
        user_id=current_user.id,
        group_id=group_id,
        kind=kind,
        start=datetime.fromisoformat(start.replace("Z", "+00:00")),
        end=datetime.fromisoformat(end.replace("Z", "+00:00")),
    )
    db.session.add(s)
    db.session.commit()
    return jsonify({"ok": True, "id": s.id})

def overlaps(a_start, a_end, b_start, b_end):
    return (a_start < b_end) and (b_start < a_end)

@api_bp.post("/groups/<int:group_id>/proposal")
@login_required
def add_proposal(group_id):
    require_membership(group_id)
    data = request.get_json(force=True)

    start = datetime.fromisoformat(data["start"].replace("Z", "+00:00"))
    end = datetime.fromisoformat(data["end"].replace("Z", "+00:00"))
    location = data.get("location")
    description = data.get("description")

    # Conflict detection against cached busy intervals (plus block_off)
    memberships = Membership.query.filter_by(group_id=group_id).all()
    user_ids = [m.user_id for m in memberships]

    busy = (BusyInterval.query
            .filter(BusyInterval.user_id.in_(user_ids))
            .filter(BusyInterval.end > start)
            .filter(BusyInterval.start < end)
            .all())

    blockoffs = (SpecialEvent.query
                 .filter_by(group_id=group_id, kind="block_off")
                 .filter(SpecialEvent.end > start)
                 .filter(SpecialEvent.start < end)
                 .all())

    conflict_user_ids = set([b.user_id for b in busy] + [s.user_id for s in blockoffs])

    p = MeetupProposal(
        group_id=group_id,
        created_by=current_user.id,
        start=start,
        end=end,
        location=location,
        description=description,
    )
    db.session.add(p)
    db.session.commit()

    # Return warning list
    conflicters = User.query.filter(User.id.in_(list(conflict_user_ids))).all()
    return jsonify({
        "ok": True,
        "proposal_id": p.id,
        "conflicts": [{"user_id": u.id, "name": u.name, "email": u.email} for u in conflicters]
    })

# ---------- Manual sync endpoint (useful for testing) ----------

@api_bp.post("/sync/me")
@login_required
def sync_me():
    # sync next 30 days for current user
    time_min = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    time_max = (datetime.now(timezone.utc) + timedelta(days=30)).replace(microsecond=0).isoformat()

    user = current_user
    if is_expired(user):
        refresh_access_token(current_app.config, user)
        db.session.commit()

    selected_ids = _parse_calendar_selection(user)
    calendar_ids = selected_ids or (list_calendar_ids(user.access_token) or ["primary"])
    fb = freebusy_query(user.access_token, time_min, time_max, calendar_ids=calendar_ids)

    # replace cache window for simplicity (production: smarter upsert)
    BusyInterval.query.filter_by(user_id=user.id).delete()

    calendars = fb.get("calendars", {})
    total_blocks = 0
    for cid, data in calendars.items():
        for blk in data.get("busy", []):
            db.session.add(BusyInterval(
                user_id=user.id,
                calendar_id=cid,
                start=datetime.fromisoformat(blk["start"].replace("Z", "+00:00")),
                end=datetime.fromisoformat(blk["end"].replace("Z", "+00:00")),
            ))
            total_blocks += 1
    db.session.commit()
    return jsonify({"ok": True, "busy_blocks": total_blocks})

# ---------- Debug APIs (debug mode only) ----------

def _require_debug():
    if not current_app.debug:
        abort(404)

@api_bp.post("/debug/clear/busy")
def debug_clear_busy():
    user = _require_debug_access()
    BusyInterval.query.filter_by(user_id=user.id).delete()
    db.session.commit()
    return jsonify({"ok": True})

@api_bp.post("/debug/clear/specials")
def debug_clear_specials():
    user = _require_debug_access()
    data = request.get_json(force=True) or {}
    group_id = data.get("group_id")
    q = SpecialEvent.query.filter_by(user_id=user.id)
    if group_id:
        q = q.filter_by(group_id=int(group_id))
    q.delete()
    db.session.commit()
    return jsonify({"ok": True})

@api_bp.post("/debug/clear/proposals")
def debug_clear_proposals():
    user = _require_debug_access()
    data = request.get_json(force=True) or {}
    group_id = data.get("group_id")
    q = MeetupProposal.query.filter_by(created_by=user.id)
    if group_id:
        q = q.filter_by(group_id=int(group_id))
    q.delete()
    db.session.commit()
    return jsonify({"ok": True})

@api_bp.post("/debug/clear/invites")
def debug_clear_invites():
    user = _require_debug_access()
    data = request.get_json(force=True) or {}
    group_id = data.get("group_id")
    q = InviteLink.query
    if group_id:
        q = q.filter_by(group_id=int(group_id))
    else:
        owned_groups = Group.query.filter_by(created_by=user.id).all()
        owned_ids = [g.id for g in owned_groups]
        if owned_ids:
            q = q.filter(InviteLink.group_id.in_(owned_ids))
        else:
            return jsonify({"ok": True})
    q.delete(synchronize_session=False)
    db.session.commit()
    return jsonify({"ok": True})

@api_bp.post("/debug/reset/calendar-selection")
def debug_reset_calendar_selection():
    user = _require_debug_access()
    user.calendar_ids_json = None
    db.session.commit()
    return jsonify({"ok": True})

@api_bp.post("/debug/leave/group")
def debug_leave_group():
    user = _require_debug_access()
    data = request.get_json(force=True) or {}
    group_id = data.get("group_id")
    if not group_id:
        abort(400, "group_id required")
    Membership.query.filter_by(group_id=int(group_id), user_id=user.id).delete()
    db.session.commit()
    return jsonify({"ok": True})

@api_bp.post("/debug/delete/group")
def debug_delete_group():
    user = _require_debug_access()
    data = request.get_json(force=True) or {}
    group_id = data.get("group_id")
    if not group_id:
        abort(400, "group_id required")
    g = Group.query.get_or_404(int(group_id))
    if g.created_by != user.id:
        abort(403)
    InviteLink.query.filter_by(group_id=g.id).delete()
    SpecialEvent.query.filter_by(group_id=g.id).delete()
    MeetupProposal.query.filter_by(group_id=g.id).delete()
    Membership.query.filter_by(group_id=g.id).delete()
    db.session.delete(g)
    db.session.commit()
    return jsonify({"ok": True})

@api_bp.post("/debug/ensure-demo")
def debug_ensure_demo():
    _require_debug_access()
    _ensure_demo_group_membership()
    return jsonify({"ok": True})

@api_bp.post("/debug/clear/all")
def debug_clear_all():
    user = _require_debug_access()
    BusyInterval.query.filter_by(user_id=user.id).delete()
    SpecialEvent.query.filter_by(user_id=user.id).delete()
    MeetupProposal.query.filter_by(created_by=user.id).delete()
    user.calendar_ids_json = None
    db.session.commit()
    return jsonify({"ok": True})

@api_bp.get("/calendars")
@login_required
def get_calendar_list():
    user = current_user
    if not user.access_token:
        return jsonify({"calendars": []})
    if is_expired(user):
        refresh_access_token(current_app.config, user)
        db.session.commit()
    calendars = list_calendars(user.access_token)
    selected_ids = set(_parse_calendar_selection(user) or [])
    if selected_ids:
        for c in calendars:
            c["selected"] = c.get("id") in selected_ids
    else:
        for c in calendars:
            c["selected"] = True
    return jsonify({"calendars": calendars})

@api_bp.post("/calendars/selection")
@login_required
def save_calendar_selection():
    data = request.get_json(force=True) or {}
    ids = data.get("calendar_ids") or []
    if not isinstance(ids, list):
        abort(400, "calendar_ids must be a list")
    filtered = [cid for cid in ids if isinstance(cid, str) and cid.strip()]
    current_user.calendar_ids_json = __import__("json").dumps(filtered)
    db.session.commit()
    return jsonify({"ok": True, "selected": filtered})
