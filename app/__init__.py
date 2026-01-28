from flask import Flask, render_template
from sqlalchemy import text
from dotenv import load_dotenv

from app.config import Config
from app.extensions import db, login_manager
from app.models import User
from app.auth import auth_bp, init_oauth
from app.routes import main_bp, api_bp
from app.scheduler import start_scheduler

load_dotenv()

@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    db.init_app(app)
    login_manager.init_app(app)
    init_oauth(app)

    app.register_blueprint(auth_bp)
    app.register_blueprint(main_bp)
    app.register_blueprint(api_bp)

    @app.errorhandler(403)
    def forbidden(_):
        return render_template("errors/403.html"), 403

    @app.errorhandler(404)
    def not_found(_):
        return render_template("errors/404.html"), 404

    @app.errorhandler(500)
    def server_error(_):
        return render_template("errors/500.html"), 500

    with app.app_context():
        db.create_all()
        # lightweight schema patching for new user profile fields
        try:
            cols = db.session.execute(text("PRAGMA table_info(users)")).fetchall()
            col_names = {c[1] for c in cols}
            new_cols = {
                "username": "VARCHAR(50)",
                "display_name": "VARCHAR(255)",
                "profile_pic_url": "VARCHAR(500)",
                "bio": "TEXT",
                "location": "VARCHAR(120)",
                "timezone": "VARCHAR(120)",
                "calendar_ids_json": "TEXT",
            }
            for col, ctype in new_cols.items():
                if col not in col_names:
                    db.session.execute(text(f"ALTER TABLE users ADD COLUMN {col} {ctype}"))
            db.session.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users (username)"))
            db.session.commit()
        except Exception:
            db.session.rollback()

    start_scheduler(app)
    return app
