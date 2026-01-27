import os

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev_secret_change_me")
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", "sqlite:///app.db")
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:5000/auth/callback")

    APP_BASE_URL = os.getenv("APP_BASE_URL", "http://localhost:5000")
    UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", "app/static/uploads")
    MAX_CONTENT_LENGTH = 5 * 1024 * 1024
    DEBUG_OWNER_EMAIL = os.getenv("DEBUG_OWNER_EMAIL", "")

    # Minimal scopes:
    # - openid/email/profile for login
    # - calendar.readonly for freebusy queries (busy-only)
    # Google scopes list: :contentReference[oaicite:0]{index=0}
    GOOGLE_SCOPES = [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/calendar.readonly",
    ]
