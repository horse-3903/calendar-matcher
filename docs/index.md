# Phase Documentation {.hero}

Phase helps groups coordinate schedules without exposing event details. It connects to Google Calendar using FreeBusy, supports group availability, and offers a synced export calendar.

<div class="cta-row">
  <a class="cta" href="setup/local.md">Get started</a>
  <a class="cta secondary" href="features/sync.md">How sync works</a>
  <a class="cta secondary" href="features/availability.md">Availability basics</a>
</div>

!!! info "Privacy by design"
    Phase only stores busy ranges, not event titles, attendees, or descriptions.

## What you can do
- Sign in with Google
- Sync availability (FreeBusy only)
- Create or join groups
- Add Available or Blocked times
- Propose meetups with conflict warnings
- Export a synced group calendar to Google

## Core principles
- **Privacy first:** only FreeBusy data is fetched
- **Transparency:** users can see exactly what is shared
- **Collaboration:** group members see availability with color coding

## Documentation map
<div class="card-grid">
  <div class="card">
    <h3>Setup</h3>
    <p>Install dependencies, configure OAuth, and run the app locally.</p>
    <p><a href="setup/local.md">Local development</a></p>
  </div>
  <div class="card">
    <h3>Features</h3>
    <p>Learn how availability, proposals, and syncing work.</p>
    <p><a href="features/availability.md">Availability and proposals</a></p>
  </div>
  <div class="card">
    <h3>Sync</h3>
    <p>Understand FreeBusy syncing and range limits.</p>
    <p><a href="features/sync.md">Calendar sync</a></p>
  </div>
  <div class="card">
    <h3>API</h3>
    <p>Key endpoints used by the frontend.</p>
    <p><a href="api/overview.md">API overview</a></p>
  </div>
</div>

## Next steps
- Follow the local setup guide
- Connect Google OAuth
- Create a group and invite teammates
