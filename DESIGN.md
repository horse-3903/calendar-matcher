# Phase design system

Direction: quiet utility, a calendar-first workspace inspired by a printed weekly planner. Product surfaces prioritize completion and scanning; the public landing page explains the mechanism with a real-shaped example calendar.

- Palette and geometry: see `app/static/phase.css`; forest green primary action, neutral surfaces, green availability, amber unverified/proposals. Both themes use semantic tokens.
- Type: existing Inter family, fixed application type sizes, tabular time labels. Buttons use a six-pixel radius; calendar cells use minimal rounding.
- Navigation: group list, compact workspace header, member filter sidebar, contextual proposal controls. Mobile uses a single day with explicit date selection.
- Availability: verified free time requires a recent successful sync covering the entire interval or an explicit availability override. Explicit blocked time takes precedence. Missing/stale coverage is unknown, not free. Half-hour grid, 08:00–22:00 local browser time; full individual calendar remains available.
- Accessibility: visible keyboard focus, labeled controls, native dialogs, textual counts, reduced-motion preference. Do not rely on colors alone.
