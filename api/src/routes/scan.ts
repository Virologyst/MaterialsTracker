import { Router, Request, Response } from 'express';
import { dbGet, dbAll } from '../db.js';

const router = Router();

interface MaterialRow {
  id: number;
  name: string;
}

interface UsageRow {
  material: string;
  total: number;
}

router.post('/lookup', (req: Request, res: Response) => {
  const { studentId } = req.body;

  if (!studentId) {
    res.status(400).json({ error: 'studentId is required' });
    return;
  }

  const student = dbGet<{ id: string; name: string }>('SELECT id, name FROM students WHERE id = ?', [studentId]);

  if (!student) {
    res.json({ found: false });
    return;
  }

  const materials = dbAll<MaterialRow>('SELECT id, name FROM materials ORDER BY sort_order, id');

  const groups = dbAll<{ id: number; name: string }>(`
    SELECT g.id, g.name
    FROM student_groups sg
    JOIN groups g ON g.id = sg.group_id
    WHERE sg.student_id = ?
    ORDER BY g.name
  `, [studentId]);

  const groupsWithUsage = groups.map((group) => {
    const usage = dbAll<UsageRow>(`
      SELECT material, COALESCE(SUM(quantity), 0) AS total
      FROM transactions
      WHERE student_id = ? AND group_id = ?
      GROUP BY material
    `, [studentId, group.id]);

    const used: Record<string, number> = {};
    const limits: Record<string, number> = {};

    for (const mat of materials) {
      used[mat.name] = 0;
      // Look up limit from group_material_limits
      const limitRow = dbGet<{ max_quantity: number }>(
        'SELECT max_quantity FROM group_material_limits WHERE group_id = ? AND material_id = ?',
        [group.id, mat.id]
      );
      limits[mat.name] = limitRow ? limitRow.max_quantity : -1;
    }

    for (const row of usage) {
      if (row.material in used) {
        used[row.material] = row.total;
      }
    }

    return {
      id: group.id,
      name: group.name,
      limits,
      used,
    };
  });

  res.json({
    found: true,
    student: { id: student.id, name: student.name },
    groups: groupsWithUsage,
  });
});

export default router;
