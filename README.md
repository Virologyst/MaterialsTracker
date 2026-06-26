# Materials Tracker

A web app for tracking material dispensing to students, replacing the `MaterialUsage.xlsx` spreadsheet. Built for QUT OP3 Blueprint.

Tracks sheets (Acrylic, Plywood, HDF), kits, and any custom materials you define. Enforces per-student limits by group, supports barcode scanning, and exports CSV reports.

---

## Requirements

- **Node.js** v18 or later — [download here](https://nodejs.org/)
- **Git** (to clone the repo) — [download here](https://git-scm.com/downloads)

To check if you already have them installed, open a terminal and run:

```
node --version
git --version
```

---

## Installation

### 1. Clone the repository

Open a terminal (Command Prompt, PowerShell, or Git Bash) and run:

```bash
git clone https://github.com/Virologyst/MaterialsTracker.git
cd MaterialsTracker
```

### 2. Install dependencies

Run the setup script:

```bash
scripts\setup.bat
```

Or install manually:

```bash
cd api && npm install
cd ..\web && npm install
cd ..
```

That's it — no database setup needed. The SQLite database is created automatically on first run.

---

## Running the App

### Production mode (recommended for daily use)

```bash
scripts\start.bat
```

This builds the frontend and API, then starts the server. Open your browser to:

```
http://localhost:3000
```

Press `Ctrl+C` in the terminal to stop the server.

### Development mode

If you're making code changes, run the API and frontend dev servers separately in two terminals:

**Terminal 1 — API (port 3000):**
```bash
cd api
npm run dev
```

**Terminal 2 — Frontend (port 5173):**
```bash
cd web
npm run dev
```

Open `http://localhost:5173` in your browser. Changes to the code will hot-reload automatically.

---

## First-Time Setup

1. Start the app using either method above
2. Open the app in your browser
3. You'll be prompted to **set a PIN** — this is the shared access PIN for the app
4. After setting the PIN, you can log in and start using the app

---

## Creating a Desktop Shortcut (Windows)

To launch the app with a double-click from your desktop:

1. **Right-click** on your Desktop and select **New > Shortcut**
2. For the location, enter:
   ```
   cmd /c "cd /d C:\path\to\MaterialsTracker && scripts\start.bat"
   ```
   Replace `C:\path\to\MaterialsTracker` with the actual folder path where you cloned the repo (e.g. `C:\Users\craig\PhpstormProjects\Materials`).
3. Click **Next**, name it `Materials Tracker`, and click **Finish**
4. (Optional) Right-click the shortcut > **Properties** > **Change Icon** to pick a custom icon

When you double-click the shortcut, it will build and start the server. A terminal window will stay open — keep it open while using the app. Close it or press `Ctrl+C` to stop.

### Auto-open browser on launch

If you'd like the browser to open automatically, create a `.bat` file on your desktop instead:

1. Right-click Desktop > **New > Text Document**
2. Paste the following (update the path):
   ```bat
   @echo off
   cd /d "C:\path\to\MaterialsTracker"
   start http://localhost:3000
   call scripts\start.bat
   ```
3. Save and rename the file from `New Text Document.txt` to `Materials Tracker.bat`

---

## Features

- **Barcode scanning** — scan student ID cards to look up their groups and usage
- **Material dispensing** — dispense 1-3 sheets/kits at a time with limit enforcement
- **Dynamic materials** — add, edit, or remove trackable materials from the Materials page
- **Group management** — create groups with per-student material limits
- **Student import** — bulk import students from CSV files
- **Reports** — view usage by group or by student, export to CSV
- **PIN authentication** — simple shared PIN access, no accounts needed

---

## Project Structure

```
MaterialsTracker/
  api/                  # Backend — Node.js, Express 5, SQLite
    src/
      routes/           # API route handlers
      middleware/        # Auth middleware
      db.ts             # Database schema and operations
      index.ts          # Express app entry point
    data/               # SQLite database (auto-created)
  web/                  # Frontend — React 19, Vite, TypeScript
    src/
      pages/            # Page components
      components/       # Reusable UI components
      hooks/            # API fetch wrapper
      types.ts          # Shared TypeScript types
  scripts/
    setup.bat           # Install dependencies
    start.bat           # Build and run production server
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `node: command not found` | Install Node.js from https://nodejs.org/ and restart your terminal |
| `git: command not found` | Install Git from https://git-scm.com/downloads and restart your terminal |
| Port 3000 already in use | Another app is using port 3000. Stop it, or set a custom port: `set PORT=3001` before running `scripts\start.bat` |
| Blank page in browser | Make sure you ran `scripts\start.bat` (not just the API). The frontend needs to be built first |
| Database reset needed | Delete `api/data/materials.db` and restart the app — a fresh database will be created |
