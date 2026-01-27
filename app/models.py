from datetime import datetime, timezone
from app.extensions import db

def utcnow():
    return datetime.now(timezone.utc)

class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)

    google_sub = db.Column(db.String(255), unique=True, nullable=False)
    email = db.Column(db.String(255), nullable=False, index=True)
    name = db.Column(db.String(255), nullable=False, default="")
    username = db.Column(db.String(50), unique=True, nullable=True, index=True)
    display_name = db.Column(db.String(255), nullable=True)
    profile_pic_url = db.Column(db.String(500), nullable=True)
    bio = db.Column(db.Text, nullable=True)
    location = db.Column(db.String(120), nullable=True)
    timezone = db.Column(db.String(120), nullable=True)
    calendar_ids_json = db.Column(db.Text, nullable=True)

    # OAuth tokens (store securely in production; consider encryption at rest)
    access_token = db.Column(db.Text, nullable=True)
    refresh_token = db.Column(db.Text, nullable=True)
    token_expiry = db.Column(db.DateTime(timezone=True), nullable=True)

    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)

    # Flask-Login integration
    @property
    def is_authenticated(self): return True
    @property
    def is_active(self): return True
    @property
    def is_anonymous(self): return False
    def get_id(self): return str(self.id)

class Group(db.Model):
    __tablename__ = "groups"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)

    join_code = db.Column(db.String(12), unique=True, nullable=False, index=True)
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)

class Membership(db.Model):
    __tablename__ = "memberships"
    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    group_id = db.Column(db.Integer, db.ForeignKey("groups.id"), nullable=False, index=True)

    # color assigned per group member
    color_hex = db.Column(db.String(12), nullable=False, default="#3b82f6")

    role = db.Column(db.String(20), nullable=False, default="member")  # member/admin
    joined_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)

    __table_args__ = (db.UniqueConstraint("user_id", "group_id", name="uq_user_group"),)

class BusyInterval(db.Model):
    """
    Cached busy blocks (NO titles/descriptions).
    Source: Google FreeBusy results.
    """
    __tablename__ = "busy_intervals"
    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    start = db.Column(db.DateTime(timezone=True), nullable=False, index=True)
    end = db.Column(db.DateTime(timezone=True), nullable=False, index=True)

    # optionally, which calendar feed this came from (primary, etc.)
    calendar_id = db.Column(db.String(255), nullable=False, default="primary")

    fetched_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)

class SpecialEvent(db.Model):
    """
    Overlay events created inside your app.
    kind:
      - block_off: blocks time even if no calendar event
      - available: marks availability even if busy
    """
    __tablename__ = "special_events"
    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    group_id = db.Column(db.Integer, db.ForeignKey("groups.id"), nullable=False, index=True)

    kind = db.Column(db.String(20), nullable=False)  # block_off / available
    start = db.Column(db.DateTime(timezone=True), nullable=False, index=True)
    end = db.Column(db.DateTime(timezone=True), nullable=False, index=True)

    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)

class MeetupProposal(db.Model):
    __tablename__ = "meetup_proposals"
    id = db.Column(db.Integer, primary_key=True)

    group_id = db.Column(db.Integer, db.ForeignKey("groups.id"), nullable=False, index=True)
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)

    start = db.Column(db.DateTime(timezone=True), nullable=False, index=True)
    end = db.Column(db.DateTime(timezone=True), nullable=False, index=True)

    location = db.Column(db.String(255), nullable=True)
    description = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)

class InviteLink(db.Model):
    """
    Shareable invite link with expiry (token signed).
    """
    __tablename__ = "invite_links"
    id = db.Column(db.Integer, primary_key=True)

    group_id = db.Column(db.Integer, db.ForeignKey("groups.id"), nullable=False, index=True)
    token = db.Column(db.String(255), unique=True, nullable=False, index=True)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)

    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)
