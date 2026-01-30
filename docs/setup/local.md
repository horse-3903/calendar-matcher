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
Create a `.env` file:
```
APP_MODE=dev
SECRET_KEY=dev_secret_change_me
DATABASE_URL=sqlite:///app.db
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

## Run the app
```bash
python run.py
```

App runs at: `http://127.0.0.1:5000`
