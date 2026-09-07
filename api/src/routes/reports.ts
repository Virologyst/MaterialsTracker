import { Router, Request, Response } from 'express';
import { dbGet, dbAll } from '../db.js';

const router = Router();

interface MaterialRow {
  id: number;
  name: string;
  label: string;
}

function getMaterials(): MaterialRow[] {
  return dbAll<MaterialRow>('SELECT id, name, label FROM materials ORDER BY sort_order, id');
}

router.get('/by-group', (_req: Request, res: Response) => {
  const materials = getMaterials();

  const sumCols = materials
    .map((m) => `COALESCE(SUM(CASE WHEN t.material = '${m.name}' THEN t.quantity ELSE 0 END), 0) AS "${m.name}_used"`)
    .join(',\n      ');

  // Include unit name when available
  const rows = dbAll(`
    SELECT
      g.id,
      g.name,
      COALESCE(u.name, '') AS unit_name,
      ${sumCols}
    FROM groups g
    LEFT JOIN units u ON u.id = g.unit_id
    LEFT JOIN transactions t ON t.group_id = g.id
    GROUP BY g.id, g.name
    ORDER BY u.name, g.name
  `);

  res.json(rows);
});

router.get('/by-student', (_req: Request, res: Response) => {
  const materials = getMaterials();

  const sumCols = materials
    .map((m) => `COALESCE(SUM(CASE WHEN t.material = '${m.name}' THEN t.quantity ELSE 0 END), 0) AS "${m.name}_used"`)
    .join(',\n      ');

  const rows = dbAll(`
    SELECT
      s.id AS student_id,
      s.name AS student_name,
      ${sumCols}
    FROM students s
    LEFT JOIN transactions t ON t.student_id = s.id
    GROUP BY s.id, s.name
    ORDER BY s.name
  `);

  res.json(rows);
});

router.get('/usage', (req: Request, res: Response) => {
  const { groupId, studentId, unitId } = req.query;
  const materials = getMaterials();

  const sumCols = materials
    .map((m) => `COALESCE(SUM(CASE WHEN t.material = '${m.name}' THEN t.quantity ELSE 0 END), 0) AS "${m.name}"`)
    .join(',\n      ');

  if (unitId) {
    const rows = dbAll(`
      SELECT
        s.id AS student_id,
        s.name AS student_name,
        ${sumCols}
      FROM student_units su
      JOIN students s ON s.id = su.student_id
      LEFT JOIN transactions t ON t.student_id = s.id AND t.unit_id = ?
      WHERE su.unit_id = ?
      GROUP BY s.id, s.name
      ORDER BY s.name
    `, [unitId, unitId]);

    res.json({ usage: rows });
    return;
  }

  if (groupId) {
    const rows = dbAll(`
      SELECT
        s.id AS student_id,
        s.name AS student_name,
        ${sumCols}
      FROM student_groups sg
      JOIN students s ON s.id = sg.student_id
      LEFT JOIN transactions t ON t.student_id = s.id AND t.group_id = sg.group_id
      WHERE sg.group_id = ?
      GROUP BY s.id, s.name
      ORDER BY s.name
    `, [groupId]);

    res.json({ usage: rows });
    return;
  }

  if (studentId) {
    // Show usage by unit for a specific student
    const rows = dbAll(`
      SELECT
        u.id AS unit_id,
        u.name AS unit_name,
        ${sumCols}
      FROM student_units su
      JOIN units u ON u.id = su.unit_id
      LEFT JOIN transactions t ON t.student_id = su.student_id AND t.unit_id = su.unit_id
      WHERE su.student_id = ?
      GROUP BY u.id, u.name
      ORDER BY u.name
    `, [studentId]);

    // Also include legacy groups
    const legacyRows = dbAll(`
      SELECT
        g.id AS group_id,
        g.name AS group_name,
        ${sumCols}
      FROM student_groups sg
      JOIN groups g ON g.id = sg.group_id
      LEFT JOIN transactions t ON t.student_id = sg.student_id AND t.group_id = sg.group_id
      WHERE sg.student_id = ? AND g.unit_id IS NULL
      GROUP BY g.id, g.name
      ORDER BY g.name
    `, [studentId]);

    res.json({ usage: [...rows, ...legacyRows] });
    return;
  }

  // Default: usage by unit
  const rows = dbAll(`
    SELECT
      u.id AS unit_id,
      u.name AS unit_name,
      ${sumCols}
    FROM units u
    LEFT JOIN transactions t ON t.unit_id = u.id
    GROUP BY u.id, u.name
    ORDER BY u.name
  `);

  // Also include legacy groups without units
  const legacyRows = dbAll(`
    SELECT
      g.id AS group_id,
      g.name AS group_name,
      ${sumCols}
    FROM groups g
    LEFT JOIN transactions t ON t.group_id = g.id
    WHERE g.unit_id IS NULL
    GROUP BY g.id, g.name
    ORDER BY g.name
  `);

  res.json({ usage: [...rows, ...legacyRows] });
});

router.get('/transactions', (req: Request, res: Response) => {
  const { groupId, studentId, unitId, from, to } = req.query;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.max(1, Math.min(200, parseInt(req.query.limit as string) || 50));
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: any[] = [];

  if (unitId) {
    conditions.push('t.unit_id = ?');
    params.push(unitId);
  }
  if (groupId) {
    conditions.push('t.group_id = ?');
    params.push(groupId);
  }
  if (studentId) {
    conditions.push('t.student_id = ?');
    params.push(studentId);
  }
  if (from) {
    conditions.push('t.dispensed_at >= ?');
    params.push(from);
  }
  if (to) {
    conditions.push('t.dispensed_at <= ?');
    params.push(to);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRow = dbGet<{ total: number }>(
    `SELECT COUNT(*) AS total FROM transactions t ${whereClause}`,
    params
  );

  const transactions = dbAll(
    `SELECT t.*, s.name AS student_name, g.name AS group_name, u.name AS unit_name
    FROM transactions t
    JOIN students s ON s.id = t.student_id
    LEFT JOIN groups g ON g.id = t.group_id
    LEFT JOIN units u ON u.id = t.unit_id
    ${whereClause}
    ORDER BY t.dispensed_at DESC
    LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const total = countRow?.total ?? 0;

  res.json({
    transactions,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
});

router.get('/export', (_req: Request, res: Response) => {
  const materials = getMaterials();

  const sumCols = materials
    .map((m) => `COALESCE(SUM(CASE WHEN t.material = '${m.name}' THEN t.quantity ELSE 0 END), 0) AS "${m.name}"`)
    .join(',\n      ');

  const rows = dbAll<Record<string, any>>(`
    SELECT
      COALESCE(u.name, g.name) AS unit_name,
      g.name AS group_name,
      s.id AS student_id,
      s.name AS student_name,
      ${sumCols}
    FROM student_groups sg
    JOIN students s ON s.id = sg.student_id
    JOIN groups g ON g.id = sg.group_id
    LEFT JOIN units u ON u.id = g.unit_id
    LEFT JOIN transactions t ON t.student_id = sg.student_id AND (t.unit_id = g.unit_id OR (t.unit_id IS NULL AND t.group_id = sg.group_id))
    GROUP BY u.name, g.name, s.id, s.name
    ORDER BY u.name, g.name, s.name
  `);

  const materialHeaders = materials.map((m) => m.label);
  const csvLines = [`Unit,Group,Student ID,Student Name,${materialHeaders.join(',')}`];

  for (const row of rows) {
    const name = row.student_name ? `"${String(row.student_name).replace(/"/g, '""')}"` : '';
    const materialValues = materials.map((m) => row[m.name] ?? 0);
    csvLines.push(`"${row.unit_name ?? ''}","${row.group_name}",${row.student_id},${name},${materialValues.join(',')}`);
  }

  const csv = csvLines.join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="usage-report.csv"');
  res.send(csv);
});

export default router;
