import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'materials.db');

let db: SqlJsDatabase;

export async function initDb(): Promise<void> {
  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');

  // Materials: dynamic list of trackable materials
  db.run(`
    CREATE TABLE IF NOT EXISTS materials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        label TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '#4361ee',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Groups table (legacy max_* columns kept for migration, new data uses group_material_limits)
  db.run(`
    CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        max_acrylic INTEGER NOT NULL DEFAULT -1,
        max_plywood INTEGER NOT NULL DEFAULT -1,
        max_hdf INTEGER NOT NULL DEFAULT -1,
        max_kits_blue INTEGER NOT NULL DEFAULT -1,
        max_kits_yellow INTEGER NOT NULL DEFAULT -1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Migrate existing tables: add kit columns if missing
  try {
    db.run('SELECT max_kits_blue FROM groups LIMIT 0');
  } catch {
    db.run('ALTER TABLE groups ADD COLUMN max_kits_blue INTEGER NOT NULL DEFAULT -1');
    db.run('ALTER TABLE groups ADD COLUMN max_kits_yellow INTEGER NOT NULL DEFAULT -1');
  }

  // Group-material limits junction table
  db.run(`
    CREATE TABLE IF NOT EXISTS group_material_limits (
        group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        material_id INTEGER NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
        max_quantity INTEGER NOT NULL DEFAULT -1,
        PRIMARY KEY (group_id, material_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS students (
        id TEXT PRIMARY KEY,
        name TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS student_groups (
        student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        PRIMARY KEY (student_id, group_id)
    )
  `);

  // Check if transactions table has old CHECK constraint by checking if it exists already
  const txTableExists = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='transactions'");
  if (txTableExists.length > 0 && txTableExists[0].values.length > 0) {
    // Table exists — check if it has the old CHECK constraint
    const tableInfo = db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='transactions'");
    const createSql = tableInfo[0]?.values[0]?.[0] as string || '';
    if (createSql.includes('CHECK')) {
      // Recreate without CHECK constraint
      db.run('ALTER TABLE transactions RENAME TO transactions_old');
      db.run(`
        CREATE TABLE transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT NOT NULL REFERENCES students(id),
            group_id INTEGER NOT NULL REFERENCES groups(id),
            material TEXT NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 1,
            dispensed_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
      db.run('INSERT INTO transactions SELECT * FROM transactions_old');
      db.run('DROP TABLE transactions_old');
    }
  } else {
    db.run(`
      CREATE TABLE IF NOT EXISTS transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          student_id TEXT NOT NULL REFERENCES students(id),
          group_id INTEGER NOT NULL REFERENCES groups(id),
          material TEXT NOT NULL,
          quantity INTEGER NOT NULL DEFAULT 1,
          dispensed_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS transactions_archive (
        id INTEGER PRIMARY KEY,
        student_id TEXT NOT NULL,
        group_id INTEGER NOT NULL,
        material TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        dispensed_at TEXT NOT NULL,
        semester TEXT NOT NULL,
        archived_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS students_archive (
        id TEXT NOT NULL,
        name TEXT,
        group_id INTEGER NOT NULL,
        group_name TEXT NOT NULL,
        semester TEXT NOT NULL,
        archived_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_transactions_student ON transactions(student_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_transactions_group ON transactions(group_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_transactions_student_group ON transactions(student_id, group_id)');

  // Seed default materials if the materials table is empty
  const materialCount = db.exec('SELECT COUNT(*) FROM materials');
  const count = materialCount[0]?.values[0]?.[0] as number || 0;
  if (count === 0) {
    db.run("INSERT INTO materials (name, label, color, sort_order) VALUES ('acrylic', 'Acrylic', '#4361ee', 1)");
    db.run("INSERT INTO materials (name, label, color, sort_order) VALUES ('plywood', 'Plywood', '#2a9d8f', 2)");
    db.run("INSERT INTO materials (name, label, color, sort_order) VALUES ('hdf', 'HDF', '#e76f51', 3)");
    db.run("INSERT INTO materials (name, label, color, sort_order) VALUES ('kit_blue', 'Kit (Blue)', '#3a86ff', 4)");
    db.run("INSERT INTO materials (name, label, color, sort_order) VALUES ('kit_yellow', 'Kit (Yellow)', '#f4a261', 5)");
  }

  // Migrate existing group limits from max_* columns into group_material_limits
  const limitsCount = db.exec('SELECT COUNT(*) FROM group_material_limits');
  const existingLimits = limitsCount[0]?.values[0]?.[0] as number || 0;
  if (existingLimits === 0) {
    // Migrate from legacy columns
    const allGroups = db.exec('SELECT id, max_acrylic, max_plywood, max_hdf, max_kits_blue, max_kits_yellow FROM groups');
    if (allGroups.length > 0) {
      const materialMap: Record<string, string> = {
        'max_acrylic': 'acrylic',
        'max_plywood': 'plywood',
        'max_hdf': 'hdf',
        'max_kits_blue': 'kit_blue',
        'max_kits_yellow': 'kit_yellow',
      };
      const columns = allGroups[0].columns;
      for (const row of allGroups[0].values) {
        const groupId = row[0] as number;
        for (let i = 1; i < columns.length; i++) {
          const colName = columns[i];
          const materialName = materialMap[colName];
          const limit = row[i] as number;
          if (materialName) {
            const mat = db.exec(`SELECT id FROM materials WHERE name = '${materialName}'`);
            if (mat.length > 0 && mat[0].values.length > 0) {
              const materialId = mat[0].values[0][0] as number;
              db.run(
                'INSERT OR IGNORE INTO group_material_limits (group_id, material_id, max_quantity) VALUES (?, ?, ?)',
                [groupId, materialId, limit]
              );
            }
          }
        }
      }
    }
  }

  save();
}

let inTransaction = false;

function save(): void {
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

export function dbRun(sql: string, params: any[] = []): { changes: number; lastId: number } {
  db.run(sql, params);
  const changes = db.getRowsModified();
  const lastIdRow = db.exec('SELECT last_insert_rowid() AS id');
  const lastId = lastIdRow.length > 0 ? (lastIdRow[0].values[0][0] as number) : 0;
  if (!inTransaction) {
    save();
  }
  return { changes, lastId };
}

export function dbGet<T = Record<string, any>>(sql: string, params: any[] = []): T | undefined {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject() as T;
    stmt.free();
    return row;
  }
  stmt.free();
  return undefined;
}

export function dbAll<T = Record<string, any>>(sql: string, params: any[] = []): T[] {
  const results: T[] = [];
  const stmt = db.prepare(sql);
  stmt.bind(params);
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

export function dbExec(sql: string): void {
  db.run(sql);
  save();
}

export function dbTransaction<T>(fn: () => T): T {
  inTransaction = true;
  db.run('BEGIN');
  try {
    const result = fn();
    db.run('COMMIT');
    inTransaction = false;
    save();
    return result;
  } catch (err) {
    inTransaction = false;
    try { db.run('ROLLBACK'); } catch { /* already rolled back */ }
    throw err;
  }
}
