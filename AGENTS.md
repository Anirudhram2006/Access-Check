# AGENTS.md

## Project Overview

Accessibility auditing and visual experience simulator. Two independent Node.js packages with no shared workspace tooling — each has its own `node_modules/`.

- `backend/` — Express + Puppeteer + axe-core accessibility scanner (port 5000)
- `frontend/` — React 19 + Vite 8 UI (default Vite port 5173)

## Running Locally

Install and start each package separately:

```bash
# Terminal 1 — backend
cd backend && npm install && npm start

# Terminal 2 — frontend
cd frontend && npm install && npm run dev
```

Frontend talks to `http://localhost:5000` (hardcoded in multiple components). Both must run for full functionality.

## Commands

| What | Command | Notes |
|------|---------|-------|
| Frontend dev server | `npm run dev` (in `frontend/`) | Vite HMR |
| Frontend lint | `npm run lint` (in `frontend/`) | ESLint flat config |
| Frontend build | `npm run build` (in `frontend/`) | Outputs to `frontend/dist/` |
| Backend start | `npm start` (in `backend/`) | Express on :5000 |

No tests exist. No CI pipeline. No root-level scripts.

## Key Architecture Notes

- **No monorepo tooling.** Dependencies must be installed independently in each directory.
- **No TypeScript.** Plain JS/JSX throughout. `@types/react` is a devDependency only for editor IntelliSense.
- **Backend API:** `POST /api/scan` accepts `{ "url": "..." }`, returns audit JSON + screenshot path + extracted Tamil/Hindi text. `GET /api/health` for health check. Static serving: `/screenshots/*`.
- **Frontend routing:** Client-side tab switching via React state (no React Router). Root component: `frontend/src/App.jsx`.
- **Hardcoded backend URL:** `http://localhost:5000` is referenced in `App.jsx`, `VisionSimulator.jsx`, and `WebsitePreview.jsx`.
- **Screenshots:** Backend saves scan screenshots to `backend/screenshots/`. This directory has a `.gitkeep`.
- **Demo mode:** Pre-canned scan of `example.com` lives in `frontend/src/utils/demoScan.js`.
- **Score calculation:** `frontend/src/utils/score.js` — starts at 100, subtracts by severity (critical -15, serious -8, moderate -4, minor -1).
- **Dark theme:** CSS custom properties in `frontend/src/index.css`. Most component styling is inline `<style>` blocks in JSX.

## Gotchas

- Changing the backend port requires updating the hardcoded URL in at least 3 frontend files.
- `frontend/dist/` contains pre-built assets but is also in `.gitignore` — verify intent before committing.
- Backend has no graceful shutdown handling — scanning in progress will abort if the server is killed.
- Puppeteer requires a compatible Chromium binary. If `npm install` succeeds but scans fail, check Puppeteer's browser download.
