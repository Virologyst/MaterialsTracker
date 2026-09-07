import { Router, Request, Response } from 'express';
import { dbGet, dbAll, dbRun, dbTransaction } from '../db.js';

const router = Router();

interface MaterialRow {
  id: number;
  name: string;
}

// GET /api/units — list all units with limits and group summaries
router.get('/', (_req: Request, res: Response) => {
  const units = dbAll<{
    id: number;
    name: string;
    limit_type: string;
    total_limit: number;
    created_at: string;
  }>('SELECT * FROM units ORDER BY name');

  const materials = dbAll<MaterialRow>('SELECT id, name FROM materials ORDER BY sort_order, id');

  const result = units.map((unit) => {
    const limits: Record<string, number> = {};
    for (const mat of materials) {
      const row = dbGet<{ max_quantity: number }>(
        'SELECT max_quantity FROM unit_material_limits WHERE unit_id = ? AND material_id = ?',
        [unit.id, mat.id]
      );
      limits[mat.name] = row ? row.max_quantity : -1;
    }

    const groups = dbAll<{ id: number; name: string; student_count: number }>(`
      SELECT g.id, g.name, COUNT(sg.student_id) AS student_count
      FROM groups g
      LEFT JOIN student_groups sg ON sg.group_id = g.id
      WHERE g.unit_id = ?
      GROUP BY g.id, g.name
      ORDER BY g.name
    `, [unit.id]);

    return {
      ...unit,
      limits,
      groups,
    };
  });

  res.json(result);
});

// POST /api/units — create a unit
router.post('/', (req: Request, res: Response) => {
  const { name, limit_type = 'individual', limits = {}, total_limit = -1 } = req.body;

  if (!name?.trim()) {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  if (!['individual', 'group'].includes(limit_type)) {
    res.status(400).json({ error: 'limit_type must be "individual" or "group"' });
    return;
  }

  const existing = dbGet('SELECT id FROM units WHERE name = ?', [name.trim()]);
  if (existing) {
    res.status(409).json({ error: 'A unit with this name already exists' });
    return;
  }

  const materials = dbAll<MaterialRow>('SELECT id, name FROM materials ORDER BY sort_order, id');

  const result = dbTransaction(() => {
    const { lastId } = dbRun(
      'INSERT INTO units (name, limit_type, total_limit) VALUES (?, ?, ?)',
      [name.trim(), limit_type, total_limit]
    );

    for (const mat of materials) {
      const qty = limits[mat.name] ?? -1;
      dbRun(
        'INSERT INTO unit_material_limits (unit_id, material_id, max_quantity) VALUES (?, ?, ?)',
        [lastId, mat.id, qty]
      );
    }

    return lastId;
  });

  const unit = dbGet('SELECT * FROM units WHERE id = ?', [result]);
  const unitLimits: Record<string, number> = {};
  for (const mat of materials) {
    const row = dbGet<{ max_quantity: number }>(
      'SELECT max_quantity FROM unit_material_limits WHERE unit_id = ? AND material_id = ?',
      [result, mat.id]
    );
    unitLimits[mat.name] = row ? row.max_quantity : -1;
  }

  res.status(201).json({ ...unit, limits: unitLimits, groups: [] });
});

// PUT /api/units/:id — update a unit
router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, limit_type, limits, total_limit } = req.body;

  const unit = dbGet('SELECT * FROM units WHERE id = ?', [id]);
  if (!unit) {
    res.status(404).json({ error: 'Unit not found' });
    return;
  }

  if (limit_type && !['individual', 'group'].includes(limit_type)) {
    res.status(400).json({ error: 'limit_type must be "individual" or "group"' });
    return;
  }

  const materials = dbAll<MaterialRow>('SELECT id, name FROM materials ORDER BY sort_order, id');

  dbTransaction(() => {
    if (name !== undefined) {
      dbRun('UPDATE units SET name = ? WHERE id = ?', [name.trim(), id]);
    }
    if (limit_type !== undefined) {
      dbRun('UPDATE units SET limit_type = ? WHERE id = ?', [limit_type, id]);
    }
    if (total_limit !== undefined) {
      dbRun('UPDATE units SET total_limit = ? WHERE id = ?', [total_limit, id]);
    }
    if (limits) {
      for (const mat of materials) {
        if (mat.name in limits) {
          const existing = dbGet(
            'SELECT 1 FROM unit_material_limits WHERE unit_id = ? AND material_id = ?',
            [id, mat.id]
          );
          if (existing) {
            dbRun(
              'UPDATE unit_material_limits SET max_quantity = ? WHERE unit_id = ? AND material_id = ?',
              [limits[mat.name], id, mat.id]
            );
          } else {
            dbRun(
              'INSERT INTO unit_material_limits (unit_id, material_id, max_quantity) VALUES (?, ?, ?)',
              [id, mat.id, limits[mat.name]]
            );
          }
        }
      }
    }
  });

  // Return updated unit
  const updated = dbGet('SELECT * FROM units WHERE id = ?', [id]);
  const unitLimits: Record<string, number> = {};
  for (const mat of materials) {
    const row = dbGet<{ max_quantity: number }>(
      'SELECT max_quantity FROM unit_material_limits WHERE unit_id = ? AND material_id = ?',
      [id, mat.id]
    );
    unitLimits[mat.name] = row ? row.max_quantity : -1;
  }

  const groups = dbAll<{ id: number; name: string; student_count: number }>(`
    SELECT g.id, g.name, COUNT(sg.student_id) AS student_count
    FROM groups g
    LEFT JOIN student_groups sg ON sg.group_id = g.id
    WHERE g.unit_id = ?
    GROUP BY g.id, g.name
    ORDER BY g.name
  `, [id]);

  res.json({ ...updated, limits: unitLimits, groups });
});

// DELETE /api/units/:id
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  const result = dbRun('DELETE FROM units WHERE id = ?', [id]);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Unit not found' });
    return;
  }

  res.json({ success: true });
});

// GET /api/units/:id/groups/:groupId/students — group detail with per-student usage
router.get('/:id/groups/:groupId/students', (req: Request, res: Response) => {
  const { id, groupId } = req.params;

  const unit = dbGet<{ id: number; name: string; limit_type: string; total_limit: number }>(
    'SELECT id, name, limit_type, total_limit FROM units WHERE id = ?', [id]
  );
  if (!unit) {
    res.status(404).json({ error: 'Unit not found' });
    return;
  }

  const group = dbGet<{ id: number; name: string; unit_id: number }>(
    'SELECT id, name, unit_id FROM groups WHERE id = ? AND unit_id = ?', [groupId, id]
  );
  if (!group) {
    res.status(404).json({ error: 'Group not found in this unit' });
    return;
  }

  const materials = dbAll<{ id: number; name: string; label: string }>(
    'SELECT id, name, label FROM materials ORDER BY sort_order, id'
  );

  // Get unit limits
  const limits: Record<string, number> = {};
  for (const mat of materials) {
    const row = dbGet<{ max_quantity: number }>(
      'SELECT max_quantity FROM unit_material_limits WHERE unit_id = ? AND material_id = ?',
      [id, mat.id]
    );
    limits[mat.name] = row ? row.max_quantity : -1;
  }

  // Get students in this group with per-material usage
  const sumCols = materials
    .map((m) => `COALESCE(SUM(CASE WHEN t.material = '${m.name}' THEN t.quantity ELSE 0 END), 0) AS "used_${m.name}"`)
    .join(',\n      ');

  const students = dbAll<Record<string, any>>(`
    SELECT
      s.id,
      s.name,
      ${sumCols}
    FROM student_groups sg
    JOIN students s ON s.id = sg.student_id
    LEFT JOIN transactions t ON t.student_id = s.id AND t.unit_id = ?
    WHERE sg.group_id = ?
    GROUP BY s.id, s.name
    ORDER BY s.name
  `, [id, groupId]);

  // Calculate group totals
  const group_totals: Record<string, number> = {};
  for (const mat of materials) {
    group_totals[mat.name] = 0;
  }
  for (const student of students) {
    for (const mat of materials) {
      group_totals[mat.name] += (student[`used_${mat.name}`] as number) || 0;
    }
  }

  res.json({
    unit: { id: unit.id, name: unit.name, limit_type: unit.limit_type, total_limit: unit.total_limit },
    group: { id: group.id, name: group.name },
    limits,
    group_totals,
    students,
    materials: materials.map((m) => ({ name: m.name, label: m.label })),
  });
});

export default router;
