import secrets
from datetime import datetime, timezone, timedelta
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

def make_join_code(length=8):
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(length))

def make_invite_token(secret_key, group_id):
    s = URLSafeTimedSerializer(secret_key)
    return s.dumps({"group_id": group_id})

def verify_invite_token(secret_key, token, max_age_seconds):
    s = URLSafeTimedSerializer(secret_key)
    data = s.loads(token, max_age=max_age_seconds)
    return data["group_id"]

def expiry_from_days(days: int):
    return datetime.now(timezone.utc) + timedelta(days=days)
