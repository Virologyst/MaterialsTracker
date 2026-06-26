import { Router, Request, Response } from 'express';
import { dbGet, dbAll, dbRun } from '../db.js';

const router = Router();

interface MaterialRow {
  id: number;
  name: string;
}

function getMaterials(): MaterialRow[] {
  return dbAll<MaterialRow>('SELECT id, name FROM materials ORDER BY sort_order, id');
}

router.get('/', (_req: Request, res: Response) => {
  const materials = getMaterials();
  const groups = dbAll<any>('SELECT * FROM groups ORDER BY name');

  // Attach limits from group_material_limits
  const result = groups.map((g: any) => {
    const limits: Record<string, number> = {};
    for (const mat of materials) {
      const row = dbGet<{ max_quantity: number }>(
        'SELECT max_quantity FROM group_material_limits WHERE group_id = ? AND material_id = ?',
        [g.id, mat.id]
      );
      limits[mat.name] = row ? row.max_quantity : -1;
    }
    return {
      id: g.id,
      name: g.name,
      limits,
      created_at: g.created_at,
    };
  });

  res.json(result);
});

router.post('/', (req: Request, res: Response) => {
  const { name, limits = {} } = req.body;

  if (!name) {
    res.status(400).json({ error: 'Group name is required' });
    return;
  }

  try {
    const result = dbRun('INSERT INTO groups (name) VALUES (?)', [name]);
    const groupId = result.lastId;

    // Insert limits for each material
    const materials = getMaterials();
    for (const mat of materials) {
      const maxQty = limits[mat.name] !== undefined ? limits[mat.name] : -1;
      dbRun(
        'INSERT INTO group_material_limits (group_id, material_id, max_quantity) VALUES (?, ?, ?)',
        [groupId, mat.id, maxQty]
      );
    }

    // Return the group with limits
    const groupLimits: Record<string, number> = {};
    for (const mat of materials) {
      groupLimits[mat.name] = limits[mat.name] !== undefined ? limits[mat.name] : -1;
    }

    res.status(201).json({
      id: groupId,
      name,
      limits: groupLimits,
    });
  } catch (err: any) {
    if (err.message?.includes('UNIQUE constraint failed')) {
      res.status(409).json({ error: 'A group with that name already exists' });
      return;
    }
    throw err;
  }
});

router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, limits } = req.body;

  const existing = dbGet('SELECT * FROM groups WHERE id = ?', [id]);
  if (!existing) {
    res.status(404).json({ error: 'Group not found' });
    return;
  }

  if (name !== undefined) {
    try {
      dbRun('UPDATE groups SET name = ? WHERE id = ?', [name, id]);
    } catch (err: any) {
      if (err.message?.includes('UNIQUE constraint failed')) {
        res.status(409).json({ error: 'A group with that name already exists' });
        return;
      }
      throw err;
    }
  }

  // Upsert limits
  if (limits && typeof limits === 'object') {
    const materials = getMaterials();
    for (const mat of materials) {
      if (limits[mat.name] !== undefined) {
        const exists = dbGet(
          'SELECT 1 AS ok FROM group_material_limits WHERE group_id = ? AND material_id = ?',
          [id, mat.id]
        );
        if (exists) {
          dbRun(
            'UPDATE group_material_limits SET max_quantity = ? WHERE group_id = ? AND material_id = ?',
            [limits[mat.name], id, mat.id]
          );
        } else {
          dbRun(
            'INSERT INTO group_material_limits (group_id, material_id, max_quantity) VALUES (?, ?, ?)',
            [id, mat.id, limits[mat.name]]
          );
        }
      }
    }
  }

  // Return updated group
  const materials = getMaterials();
  const updatedLimits: Record<string, number> = {};
  for (const mat of materials) {
    const row = dbGet<{ max_quantity: number }>(
      'SELECT max_quantity FROM group_material_limits WHERE group_id = ? AND material_id = ?',
      [id, mat.id]
    );
    updatedLimits[mat.name] = row ? row.max_quantity : -1;
  }

  const group = dbGet<any>('SELECT * FROM groups WHERE id = ?', [id]);
  res.json({
    id: group.id,
    name: group.name,
    limits: updatedLimits,
    created_at: group.created_at,
  });
});

router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  // Delete associated limits
  dbRun('DELETE FROM group_material_limits WHERE group_id = ?', [id]);
  const result = dbRun('DELETE FROM groups WHERE id = ?', [id]);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Group not found' });
    return;
  }

  res.json({ success: true });
});

router.get('/:id/students', (req: Request, res: Response) => {
  const { id } = req.params;

  const group = dbGet('SELECT * FROM groups WHERE id = ?', [id]);
  if (!group) {
    res.status(404).json({ error: 'Group not found' });
    return;
  }

  const materials = getMaterials();

  // Build dynamic SUM columns for each material
  const sumCols = materials
    .map((m) => `COALESCE(SUM(CASE WHEN t.material = '${m.name}' THEN t.quantity ELSE 0 END), 0) AS "used_${m.name}"`)
    .join(',\n      ');

  const students = dbAll(`
    SELECT
      s.id,
      s.name,
      ${sumCols}
    FROM student_groups sg
    JOIN students s ON s.id = sg.student_id
    LEFT JOIN transactions t ON t.student_id = s.id AND t.group_id = sg.group_id
    WHERE sg.group_id = ?
    GROUP BY s.id, s.name
    ORDER BY s.name
  `, [id]);

  res.json({ students });
});

export default router;
