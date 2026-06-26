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

  const rows = dbAll(`
    SELECT
      g.id,
      g.name,
      ${sumCols}
    FROM groups g
    LEFT JOIN transactions t ON t.group_id = g.id
    GROUP BY g.id, g.name
    ORDER BY g.name
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
  const { groupId, studentId } = req.query;
  const materials = getMaterials();

  const sumCols = materials
    .map((m) => `COALESCE(SUM(CASE WHEN t.material = '${m.name}' THEN t.quantity ELSE 0 END), 0) AS "${m.name}"`)
    .join(',\n      ');

  if (groupId) {
    // Build limit columns dynamically
    const limitCols = materials
      .map((m) => {
        return `COALESCE((SELECT max_quantity FROM group_material_limits gml JOIN materials mat ON mat.id = gml.material_id WHERE gml.group_id = sg.group_id AND mat.name = '${m.name}'), -1) AS "max_${m.name}"`;
      })
      .join(',\n      ');

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
    const limitCols = materials
      .map((m) => {
        return `COALESCE((SELECT max_quantity FROM group_material_limits gml JOIN materials mat ON mat.id = gml.material_id WHERE gml.group_id = sg.group_id AND mat.name = '${m.name}'), -1) AS "max_${m.name}"`;
      })
      .join(',\n      ');

    const rows = dbAll(`
      SELECT
        g.id AS group_id,
        g.name AS group_name,
        ${limitCols},
        ${sumCols}
      FROM student_groups sg
      JOIN groups g ON g.id = sg.group_id
      LEFT JOIN transactions t ON t.student_id = sg.student_id AND t.group_id = sg.group_id
      WHERE sg.student_id = ?
      GROUP BY g.id, g.name
      ORDER BY g.name
    `, [studentId]);

    res.json({ usage: rows });
    return;
  }

  const rows = dbAll(`
    SELECT
      g.id AS group_id,
      g.name AS group_name,
      ${sumCols}
    FROM groups g
    LEFT JOIN transactions t ON t.group_id = g.id
    GROUP BY g.id, g.name
    ORDER BY g.name
  `);

  res.json({ usage: rows });
});

router.get('/transactions', (req: Request, res: Response) => {
  const { groupId, studentId, from, to } = req.query;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.max(1, Math.min(200, parseInt(req.query.limit as string) || 50));
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: any[] = [];

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
    `SELECT t.*, s.name AS student_name, g.name AS group_name
    FROM transactions t
    JOIN students s ON s.id = t.student_id
    JOIN groups g ON g.id = t.group_id
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
      g.name AS group_name,
      s.id AS student_id,
      s.name AS student_name,
      ${sumCols}
    FROM student_groups sg
    JOIN students s ON s.id = sg.student_id
    JOIN groups g ON g.id = sg.group_id
    LEFT JOIN transactions t ON t.student_id = sg.student_id AND t.group_id = sg.group_id
    GROUP BY g.name, s.id, s.name
    ORDER BY g.name, s.name
  `);

  const materialHeaders = materials.map((m) => m.label);
  const csvLines = [`Group,Student ID,Student Name,${materialHeaders.join(',')}`];

  for (const row of rows) {
    const name = row.student_name ? `"${String(row.student_name).replace(/"/g, '""')}"` : '';
    const materialValues = materials.map((m) => row[m.name] ?? 0);
    csvLines.push(`"${row.group_name}",${row.student_id},${name},${materialValues.join(',')}`);
  }

  const csv = csvLines.join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="usage-report.csv"');
  res.send(csv);
});

export default router;
