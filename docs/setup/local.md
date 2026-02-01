# Local Development

## Requirements
- Python 3.10+
- Node.js 18+
- npm

## Install dependencies
```bash
pip install -r requirements.txt
npm install
```

## Configure environment
Create a `.env` file in the repo root:
```env
FLASK_ENV=development
FLASK_DEBUG=1
SECRET_KEY=dev_secret_change_me
APP_BASE_URL=http://127.0.0.1:5000
DATABASE_URL=sqlite:///app.db
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

!!! tip
    You can start without Google OAuth by running in demo mode. Set `FLASK_DEBUG=1` and use the demo group.

## Build frontend assets
```bash
npm run build
```

## Run the app
```bash
python run.py
```

App runs at: `http://127.0.0.1:5000`
