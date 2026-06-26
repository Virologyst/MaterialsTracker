# Materials Tracker

Web app replacing `MaterialUsage.xlsx` — used for tracking material dispensing to students at an educational institution.

## What It Replaces

The Excel spreadsheet tracks:
- **Barcode scanning** of student IDs (with N/S prefix for student/staff detection)
- **Material dispensing**: Acrylic, Plywood, HDF sheets (1-3 at a time)
- **Kit collection**: Blue and yellow kits per student per unit
- **Two units**: EGx101 and EGB210 — students can be enrolled in both with separate limits
- **Groups within units**: e.g., group "1A" in EGx101 with max 1 acrylic, 2 ply, 2 HDF
- **Special groups**: Motorsport, EGB345, EGB320, EGH400, FoE staff, FoS staff, Aerospace, WIL projects
- **Per-student MAX limits** enforced per group/unit
- **Summary reporting** with totals by unit and overall

## Tech Stack
- **Backend:** Node.js, Express 5, sql.js (SQLite), TypeScript — in `api/`
- **Frontend:** React 19, Vite, react-router-dom, TypeScript — in `web/`
- **Auth:** PIN-based with bcryptjs, UUID session tokens

## Development
```bash
# Install dependencies
npm install --prefix api && npm install --prefix web

# Dev mode (run both)
npm run dev:api --prefix api   # tsx watch, port 3000
npm run dev:web --prefix web   # Vite dev server, proxies /api to :3000

# Production
scripts/start.bat              # Builds frontend, runs API
```

## Project Structure
- `api/src/index.ts` — Express app setup, serves static frontend in production
- `api/src/db.ts` — SQLite schema, all DB operations
- `api/src/routes/` — auth, scan, dispense, groups, students, reports
- `api/src/middleware/auth.ts` — Bearer token auth middleware
- `web/src/App.tsx` — React Router setup
- `web/src/pages/` — LoginPage, ScanPage, GroupsPage, ImportPage, ReportsPage
- `web/src/components/` — Navbar, ScanInput, StudentCard, DispenseForm, UsageBar, CsvUploader
- `web/src/hooks/useApi.ts` — Fetch wrapper with auth token

## Database
SQLite via sql.js, stored in `api/data/materials.db`. Tables: groups, students, student_groups, transactions, config.

## Domain Concepts
- **Units** = course codes (EGx101, EGB210). Groups exist within units.
- **Groups** = class groups (e.g., "1A") with per-student material limits
- **Students** identified by barcode ID, can be in multiple units with different limits
- **Materials** = Acrylic, Plywood, HDF (tracked in sheet count)
- **Kits** = Blue/yellow kits collected per unit (separate from sheets)
- **Special groups** = groups outside the normal unit structure (Motorsport, staff groups, etc.)

## Limits Convention
- `-1` = unlimited (no cap enforced)
- `0` = not available (dispensing blocked)
- `>0` = specific limit per student per group

## Materials
- **Sheets:** acrylic, plywood, hdf
- **Kits:** kit_blue, kit_yellow

## API Endpoints
- `POST /api/auth/login` / `POST /api/auth/set-pin` (public)
- `POST /api/scan/lookup` — barcode lookup, returns groups with usage
- `POST /api/dispense` — dispense material (supports quantity 1-3)
- `DELETE /api/dispense/:id` — undo transaction
- `GET/POST/PUT/DELETE /api/groups` — group CRUD
- `GET /api/groups/:id/students` — group members with usage
- `GET /api/students` — paginated student list
- `POST /api/students/import` — CSV upload
- `GET /api/reports/by-group` — totals per group
- `GET /api/reports/by-student` — totals per student
- `GET /api/reports/export` — CSV download
