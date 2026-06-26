import { Router, Request, Response } from 'express';
import { dbGet, dbAll, dbRun } from '../db.js';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const materials = dbAll('SELECT * FROM materials ORDER BY sort_order, id');
  res.json(materials);
});

router.post('/', (req: Request, res: Response) => {
  const { name, label, color = '#4361ee', sort_order = 0 } = req.body;

  if (!name || !label) {
    res.status(400).json({ error: 'name and label are required' });
    return;
  }

  // Validate name is a simple identifier (lowercase, underscores, digits)
  if (!/^[a-z][a-z0-9_]*$/.test(name)) {
    res.status(400).json({ error: 'name must be lowercase letters, digits, and underscores, starting with a letter' });
    return;
  }

  try {
    const result = dbRun(
      'INSERT INTO materials (name, label, color, sort_order) VALUES (?, ?, ?, ?)',
      [name, label, color, sort_order]
    );

    const material = dbGet('SELECT * FROM materials WHERE id = ?', [result.lastId]);
    res.status(201).json(material);
  } catch (err: any) {
    if (err.message?.includes('UNIQUE constraint failed')) {
      res.status(409).json({ error: 'A material with that name already exists' });
      return;
    }
    throw err;
  }
});

router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, label, color, sort_order } = req.body;

  const existing = dbGet('SELECT * FROM materials WHERE id = ?', [id]);
  if (!existing) {
    res.status(404).json({ error: 'Material not found' });
    return;
  }

  if (name !== undefined && !/^[a-z][a-z0-9_]*$/.test(name)) {
    res.status(400).json({ error: 'name must be lowercase letters, digits, and underscores, starting with a letter' });
    return;
  }

  const fields: string[] = [];
  const values: any[] = [];

  if (name !== undefined) { fields.push('name = ?'); values.push(name); }
  if (label !== undefined) { fields.push('label = ?'); values.push(label); }
  if (color !== undefined) { fields.push('color = ?'); values.push(color); }
  if (sort_order !== undefined) { fields.push('sort_order = ?'); values.push(sort_order); }

  if (fields.length === 0) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }

  values.push(id);

  try {
    dbRun(`UPDATE materials SET ${fields.join(', ')} WHERE id = ?`, values);
  } catch (err: any) {
    if (err.message?.includes('UNIQUE constraint failed')) {
      res.status(409).json({ error: 'A material with that name already exists' });
      return;
    }
    throw err;
  }

  // If name changed, update transactions to match
  if (name !== undefined) {
    const old = existing as any;
    if (old.name !== name) {
      dbRun('UPDATE transactions SET material = ? WHERE material = ?', [name, old.name]);
    }
  }

  const material = dbGet('SELECT * FROM materials WHERE id = ?', [id]);
  res.json(material);
});

router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = dbGet<{ name: string }>('SELECT name FROM materials WHERE id = ?', [id]);
  if (!existing) {
    res.status(404).json({ error: 'Material not found' });
    return;
  }

  // Check if any transactions reference this material
  const txCount = dbGet<{ count: number }>(
    'SELECT COUNT(*) AS count FROM transactions WHERE material = ?',
    [existing.name]
  );
  if (txCount && txCount.count > 0) {
    res.status(409).json({ error: `Cannot delete: ${txCount.count} transaction(s) reference this material` });
    return;
  }

  // Delete associated limits
  dbRun('DELETE FROM group_material_limits WHERE material_id = ?', [id]);
  dbRun('DELETE FROM materials WHERE id = ?', [id]);

  res.json({ success: true });
});

export default router;
