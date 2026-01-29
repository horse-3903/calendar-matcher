# Google OAuth Setup

1) Create a Google Cloud project  
2) Enable **Google Calendar API**  
3) Configure OAuth consent screen  
4) Create OAuth Client ID (Web App)  
5) Add redirect URI:
```
http://127.0.0.1:5000/auth/callback
```

Set these env vars:
```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

Scopes used:
- `openid`, `email`, `profile`
- `https://www.googleapis.com/auth/calendar.readonly`
- `https://www.googleapis.com/auth/calendar` (for export)
