# Materials Tracker

Web app replacing `MaterialUsage.xlsx` — used for tracking material dispensing to students at an educational institution.

## Repository
- **GitHub:** https://github.com/Virologyst/MaterialsTracker.git
- **Branch:** main
- **Always commit and push after every change.** Ask the user before pushing.

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
scripts\setup.bat
# Or manually:
cd api && npm install && cd ..\web && npm install

# Dev mode (two terminals)
cd api && npm run dev       # tsx watch, port 3000
cd web && npm run dev       # Vite dev server, port 5173, proxies /api to :3000

# Production
scripts\start.bat           # Builds frontend + API, runs on port 3000
```

## Project Structure
- `api/src/index.ts` — Express app setup, serves static frontend in production
- `api/src/db.ts` — SQLite schema, migrations, all DB operations
- `api/src/routes/` — auth, scan, dispense, groups, students, reports, materials
- `api/src/middleware/auth.ts` — Bearer token auth middleware
- `web/src/App.tsx` — React Router setup
- `web/src/pages/` — LoginPage, ScanPage, GroupsPage, MaterialsPage, ImportPage, ReportsPage
- `web/src/components/` — Navbar, ScanInput, StudentCard, DispenseForm, UsageBar, CsvUploader
- `web/src/hooks/useApi.ts` — Fetch wrapper with auth token
- `web/src/types.ts` — Shared TypeScript interfaces

## Database
SQLite via sql.js, stored in `api/data/materials.db`. Tables: materials, groups, group_material_limits, students, student_groups, transactions, config.

## Domain Concepts
- **Units** = course codes (EGx101, EGB210). Groups exist within units.
- **Groups** = class groups (e.g., "1A") with per-student material limits
- **Students** identified by barcode ID, can be in multiple units with different limits
- **Materials** = dynamic, managed via the Materials page. Default: Acrylic, Plywood, HDF, Kit (Blue), Kit (Yellow)
- **Special groups** = groups outside the normal unit structure (Motorsport, staff groups, etc.)

## Materials System
Materials are stored in the `materials` table and are fully dynamic — add/edit/delete from the Materials page. Each material has:
- `name` — internal key (lowercase, underscores), used in transactions
- `label` — display name shown in the UI
- `color` — hex color for dispense buttons and UI elements
- `sort_order` — controls display ordering

Group limits are stored in `group_material_limits` (junction table between groups and materials).

## Limits Convention
- `-1` = unlimited (no cap enforced)
- `0` = not available (dispensing blocked)
- `>0` = specific limit per student per group

## API Endpoints
- `POST /api/auth/login` / `POST /api/auth/set-pin` (public)
- `POST /api/scan/lookup` — barcode lookup, returns groups with usage
- `POST /api/dispense` — dispense material (supports quantity 1-3)
- `DELETE /api/dispense/:id` — undo transaction
- `GET/POST/PUT/DELETE /api/groups` — group CRUD (limits as `Record<string, number>`)
- `GET /api/groups/:id/students` — group members with usage
- `GET/POST/PUT/DELETE /api/materials` — material CRUD
- `GET /api/students` — paginated student list
- `POST /api/students/import` — CSV upload
- `GET /api/reports/by-group` — totals per group
- `GET /api/reports/by-student` — totals per student
- `GET /api/reports/export` — CSV download
