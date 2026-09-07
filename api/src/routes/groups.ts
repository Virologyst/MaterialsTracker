import { Router, Request, Response } from 'express';
import { dbGet, dbAll, dbRun } from '../db.js';

const router = Router();

// GET /api/groups — list all groups with unit info
router.get('/', (_req: Request, res: Response) => {
  const groups = dbAll<any>(`
    SELECT g.id, g.name, g.unit_id, g.created_at, u.name AS unit_name
    FROM groups g
    LEFT JOIN units u ON u.id = g.unit_id
    ORDER BY u.name, g.name
  `);

  res.json(groups);
});

// POST /api/groups — create a group under a unit
router.post('/', (req: Request, res: Response) => {
  const { name, unitId } = req.body;

  if (!name?.trim()) {
    res.status(400).json({ error: 'Group name is required' });
    return;
  }

  if (!unitId) {
    res.status(400).json({ error: 'unitId is required' });
    return;
  }

  const unit = dbGet('SELECT id FROM units WHERE id = ?', [unitId]);
  if (!unit) {
    res.status(404).json({ error: 'Unit not found' });
    return;
  }

  // Check for duplicate name within the same unit
  const existing = dbGet(
    'SELECT id FROM groups WHERE name = ? AND unit_id = ?',
    [name.trim(), unitId]
  );
  if (existing) {
    res.status(409).json({ error: 'A group with that name already exists in this unit' });
    return;
  }

  const result = dbRun(
    'INSERT INTO groups (name, unit_id) VALUES (?, ?)',
    [name.trim(), unitId]
  );

  res.status(201).json({
    id: result.lastId,
    name: name.trim(),
    unit_id: unitId,
  });
});

// PUT /api/groups/:id — rename a group
router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { name } = req.body;

  const existing = dbGet<any>('SELECT * FROM groups WHERE id = ?', [id]);
  if (!existing) {
    res.status(404).json({ error: 'Group not found' });
    return;
  }

  if (name !== undefined) {
    const dup = dbGet(
      'SELECT id FROM groups WHERE name = ? AND unit_id = ? AND id != ?',
      [name.trim(), existing.unit_id, id]
    );
    if (dup) {
      res.status(409).json({ error: 'A group with that name already exists in this unit' });
      return;
    }
    dbRun('UPDATE groups SET name = ? WHERE id = ?', [name.trim(), id]);
  }

  const updated = dbGet<any>('SELECT g.*, u.name AS unit_name FROM groups g LEFT JOIN units u ON u.id = g.unit_id WHERE g.id = ?', [id]);
  res.json(updated);
});

// DELETE /api/groups/:id
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  const result = dbRun('DELETE FROM groups WHERE id = ?', [id]);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Group not found' });
    return;
  }

  res.json({ success: true });
});

// GET /api/groups/:id/students — list students in a group with usage
router.get('/:id/students', (req: Request, res: Response) => {
  const { id } = req.params;

  const group = dbGet<any>('SELECT g.*, u.name AS unit_name FROM groups g LEFT JOIN units u ON u.id = g.unit_id WHERE g.id = ?', [id]);
  if (!group) {
    res.status(404).json({ error: 'Group not found' });
    return;
  }

  const materials = dbAll<{ id: number; name: string }>('SELECT id, name FROM materials ORDER BY sort_order, id');

  const sumCols = materials
    .map((m) => `COALESCE(SUM(CASE WHEN t.material = '${m.name}' THEN t.quantity ELSE 0 END), 0) AS "used_${m.name}"`)
    .join(',\n      ');

  // Join transactions on unit_id if the group has one, otherwise fall back to group_id
  const txJoin = group.unit_id
    ? 'LEFT JOIN transactions t ON t.student_id = s.id AND t.unit_id = ?'
    : 'LEFT JOIN transactions t ON t.student_id = s.id AND t.group_id = sg.group_id';
  const txParams = group.unit_id ? [group.unit_id, id] : [id];

  const students = dbAll(`
    SELECT
      s.id,
      s.name,
      ${sumCols}
    FROM student_groups sg
    JOIN students s ON s.id = sg.student_id
    ${txJoin}
    WHERE sg.group_id = ?
    GROUP BY s.id, s.name
    ORDER BY s.name
  `, txParams);

  res.json({ students });
});

export default router;
