# Frontend QA Checklist

Use this checklist to validate **all interactive frontend features** work as intended.

---

## Authentication
- [ ] Google login redirects correctly and returns to app
- [ ] User profile info is displayed after login
- [ ] Logout clears session and returns to home

---

## Dashboard (Home)
- [ ] Create Group dialog opens/closes
- [ ] Join Group dialog opens/closes
- [ ] Sync Calendar dialog opens/closes
- [ ] Clicking outside closes any dialog

---

## Group Management
- [ ] Create group generates join code and appears in list
- [ ] Join group with valid code succeeds
- [ ] Join group with invalid code shows error
- [ ] Group cards show correct member count
- [ ] Group card click opens group dashboard

---

## Group Settings
- [ ] Open group settings dialog
- [ ] Change group name → saves
- [ ] Change group timezone → saves
- [ ] Join code regenerates (admin only)
- [ ] Custom join code saves (admin only)
- [ ] Copy join code works

---

## Roles & Members
- [ ] Admin badge appears for admins
- [ ] Promote member to admin works (admin only)
- [ ] Non-admin cannot promote members

---

## Calendar Sync
- [ ] Calendar list loads in sync dialog
- [ ] Selected calendars save correctly
- [ ] Sync now pulls FreeBusy data
- [ ] Auto‑sync interval saves
- [ ] Sync success toast appears only on user action

---

## Calendar Display (FullCalendar)
- [ ] Week view renders correctly
- [ ] Day view renders correctly
- [ ] Month view renders correctly
- [ ] List view renders correctly
- [ ] Events show correct colors and labels
- [ ] Events show correct time range
- [ ] Calendar scroll works with dark mode

---

## Special Events
- [ ] Add Available time range appears on calendar
- [ ] Add Blocked time range appears on calendar
- [ ] Fields clear after submitting

---

## Propose Meetup
- [ ] Proposal appears on calendar
- [ ] Conflicts show when busy members overlap
- [ ] Fields clear after submitting

---

## Export to Google Calendar
- [ ] Export dialog opens
- [ ] Create synced calendar works
- [ ] Update synced calendar works
- [ ] Member color mapping updates
- [ ] Invite members option works
- [ ] Replace existing Phase events works

---

## Theming & UI
- [ ] Light/dark mode toggle works
- [ ] Active nav item highlights correctly
- [ ] Buttons and dialogs match theme
- [ ] Input icons display correctly in dark mode
- [ ] Toasts appear only on user actions

---

## Dev Console (if enabled)
- [ ] Dev Console link visible in dev mode
- [ ] Debug actions execute correctly

