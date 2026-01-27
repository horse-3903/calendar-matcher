from flask import Blueprint, redirect, url_for, session, current_app, request
import re
import secrets
from authlib.integrations.flask_client import OAuth
from flask_login import login_user, logout_user
from datetime import datetime, timezone, timedelta

from app.extensions import db
from app.models import User

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")
oauth = OAuth()

def init_oauth(app):
    oauth.init_app(app)
    oauth.register(
        name="google",
        client_id=app.config["GOOGLE_CLIENT_ID"],
        client_secret=app.config["GOOGLE_CLIENT_SECRET"],
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": " ".join(app.config["GOOGLE_SCOPES"])},
    )

@auth_bp.get("/login")
def login():
    redirect_uri = current_app.config["GOOGLE_REDIRECT_URI"]
    return oauth.google.authorize_redirect(
        redirect_uri,
        access_type="offline",
        prompt="consent",  # ensures refresh_token on first auth (sometimes needed)
    )

@auth_bp.get("/callback")
def callback():
    token = oauth.google.authorize_access_token()
    userinfo = oauth.google.userinfo()
    if not userinfo:
        userinfo = token.get("userinfo", {})

    google_sub = userinfo["sub"]
    email = userinfo.get("email", "")
    name = userinfo.get("name", email)
    picture = userinfo.get("picture")

    def unique_username() -> str:
        while True:
            candidate = f"user_{secrets.token_hex(3)}"
            if not User.query.filter_by(username=candidate).first():
                return candidate

    user = User.query.filter_by(google_sub=google_sub).first()
    if not user:
        user = User(google_sub=google_sub, email=email, name=name)
        db.session.add(user)

    if not user.display_name:
        user.display_name = name
    if not user.username:
        user.username = unique_username()
    if picture and not user.profile_pic_url:
        user.profile_pic_url = picture

    # Store tokens
    user.access_token = token.get("access_token")
    user.refresh_token = token.get("refresh_token") or user.refresh_token
    expires_in = int(token.get("expires_in", 3600))
    user.token_expiry = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

    db.session.commit()
    login_user(user)
    return redirect(url_for("main.index"))

@auth_bp.get("/logout")
def logout():
    logout_user()
    session.clear()
    return redirect(url_for("main.index"))
