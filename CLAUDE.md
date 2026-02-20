# Health Dashboard Architecture

## Overview
Personal health tracking dashboard deployed on GitHub Pages. Single-file HTML app with no external dependencies.

## Files
- `index.html` - Complete app (HTML + CSS + JS in one file)
- `health-data.json` - Canonical data source
- `health-data.js` - JS wrapper bundling the JSON (loaded via `<script src>`)
- `CLAUDE.md` - This file

## Architecture
- **Single-file app:** All CSS and JavaScript embedded in `index.html`
- **No frameworks, no dependencies:** Pure vanilla HTML/CSS/JS
- **Data flow:** GitHub API > bundled JS > fetch JSON > localStorage
- **Persistence:** localStorage (immediate) + GitHub Contents API (debounced 2s)
- **Dual file sync:** Both `health-data.json` and `health-data.js` updated on each sync

## Data Schema
- Root: `profile`, `habits`, `days`, `goals`, `supplementDefinitions`, `exercisePresets`
- Daily data keyed by date string (YYYY-MM-DD) in `days` object
- Each day contains: `habits`, `weight`, `bodyFat`, `measurements`, `water`, `sleep`, `nutrition`, `exercise`

## Tab Structure
1. **Today** - Daily command center (habits, quick stats, quick entry)
2. **Body** - Weight, BMI, body fat, measurements, trend sparkline
3. **Exercise** - Workout logger, activity stats
4. **Nutrition** - Water tracker, supplements, meal logging
5. **Goals** - Progress bars, streaks, weekly comparisons

## Design System
Same as FL3 Dashboard:
- Dark slate theme: `--bg: #0f172a`, `--card: #1e293b`, `--accent: #f59e0b`
- System fonts, responsive breakpoints at 1200/768/480px
- Card-based layout, amber accent checkboxes, progress bars

## GitHub Config
- Owner: `jscott-62`
- Repo: `health-dashboard`
- localStorage keys: `health-github-token`, `health-dashboard-data`
- JS global: `window.HEALTH_DASHBOARD_DATA`

## Deployment
Push to `main` branch. GitHub Pages serves from root.
