import { Router, Request, Response } from 'express';
import { dbGet, dbAll, dbRun } from '../db.js';

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
  let { studentId } = req.body;

  if (!studentId) {
    res.status(400).json({ error: 'studentId is required' });
    return;
  }

  // Normalize card scan: lowercase and strip last 2 digits (card version)
  studentId = studentId.toLowerCase().slice(0, -2);

  const student = dbGet<{ id: string; name: string }>('SELECT id, name FROM students WHERE id = ?', [studentId]);

  if (!student) {
    res.json({ found: false });
    return;
  }

  const materials = dbAll<MaterialRow>('SELECT id, name FROM materials ORDER BY sort_order, id');

  // Get all units the student is enrolled in
  const units = dbAll<{ id: number; name: string; limit_type: string; total_limit: number }>(`
    SELECT u.id, u.name, u.limit_type, u.total_limit
    FROM student_units su
    JOIN units u ON u.id = su.unit_id
    WHERE su.student_id = ?
    ORDER BY u.name
  `, [studentId]);

  // Also get legacy groups (no unit_id) for backward compatibility
  const legacyGroups = dbAll<{ id: number; name: string }>(`
    SELECT g.id, g.name
    FROM student_groups sg
    JOIN groups g ON g.id = sg.group_id
    WHERE sg.student_id = ? AND g.unit_id IS NULL
    ORDER BY g.name
  `, [studentId]);

  const unitsWithUsage = units.map((unit) => {
    // Find student's group in this unit
    const groupRow = dbGet<{ id: number; name: string }>(`
      SELECT g.id, g.name
      FROM student_groups sg
      JOIN groups g ON g.id = sg.group_id
      WHERE sg.student_id = ? AND g.unit_id = ?
    `, [studentId, unit.id]);

    // Get unit material limits
    const limits: Record<string, number> = {};
    for (const mat of materials) {
      const row = dbGet<{ max_quantity: number }>(
        'SELECT max_quantity FROM unit_material_limits WHERE unit_id = ? AND material_id = ?',
        [unit.id, mat.id]
      );
      limits[mat.name] = row ? row.max_quantity : -1;
    }

    // Student's personal usage in this unit
    const usage = dbAll<UsageRow>(`
      SELECT material, COALESCE(SUM(quantity), 0) AS total
      FROM transactions
      WHERE student_id = ? AND unit_id = ?
      GROUP BY material
    `, [studentId, unit.id]);

    const used: Record<string, number> = {};
    for (const mat of materials) {
      used[mat.name] = 0;
    }
    for (const row of usage) {
      if (row.material in used) {
        used[row.material] = row.total;
      }
    }
    const totalUsed = Object.values(used).reduce((sum, v) => sum + v, 0);

    const result: any = {
      id: unit.id,
      name: unit.name,
      limit_type: unit.limit_type,
      limits,
      total_limit: unit.total_limit,
      used,
      total_used: totalUsed,
      group: groupRow ? { id: groupRow.id, name: groupRow.name } : null,
    };

    // For group mode, also compute the entire group's usage
    if (unit.limit_type === 'group' && groupRow) {
      const groupUsage = dbAll<UsageRow>(`
        SELECT t.material, COALESCE(SUM(t.quantity), 0) AS total
        FROM transactions t
        JOIN student_groups sg ON sg.student_id = t.student_id
        WHERE sg.group_id = ? AND t.unit_id = ?
        GROUP BY t.material
      `, [groupRow.id, unit.id]);

      const groupUsed: Record<string, number> = {};
      for (const mat of materials) {
        groupUsed[mat.name] = 0;
      }
      for (const row of groupUsage) {
        if (row.material in groupUsed) {
          groupUsed[row.material] = row.total;
        }
      }
      result.group_used = groupUsed;
      result.group_total_used = Object.values(groupUsed).reduce((sum, v) => sum + v, 0);
    }

    return result;
  });

  // Build legacy groups as unit-like entries for backward compat
  const legacyUnits = legacyGroups.map((group) => {
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

    const groupData = dbGet<{ total_limit: number }>('SELECT total_limit FROM groups WHERE id = ?', [group.id]);

    return {
      id: group.id,
      name: group.name,
      limit_type: 'individual' as const,
      limits,
      total_limit: groupData?.total_limit ?? -1,
      used,
      total_used: Object.values(used).reduce((sum, v) => sum + v, 0),
      group: null,
      _legacy: true,
    };
  });

  res.json({
    found: true,
    student: { id: student.id, name: student.name },
    units: [...unitsWithUsage, ...legacyUnits],
  });
});

// POST /api/scan/assign-group — assign or reassign a student's group within a unit
router.post('/assign-group', (req: Request, res: Response) => {
  const { studentId, unitId, groupId } = req.body;

  if (!studentId || !unitId || !groupId) {
    res.status(400).json({ error: 'studentId, unitId, and groupId are required' });
    return;
  }

  // Verify student is enrolled in the unit
  const enrollment = dbGet(
    'SELECT 1 FROM student_units WHERE student_id = ? AND unit_id = ?',
    [studentId, unitId]
  );
  if (!enrollment) {
    res.status(400).json({ error: 'Student is not enrolled in this unit' });
    return;
  }

  // Verify group belongs to the unit
  const group = dbGet<{ id: number; name: string }>(
    'SELECT id, name FROM groups WHERE id = ? AND unit_id = ?',
    [groupId, unitId]
  );
  if (!group) {
    res.status(400).json({ error: 'Group does not belong to this unit' });
    return;
  }

  // Remove any existing group assignments for this student in this unit
  const existingGroups = dbAll<{ group_id: number }>(
    `SELECT sg.group_id FROM student_groups sg
     JOIN groups g ON g.id = sg.group_id
     WHERE sg.student_id = ? AND g.unit_id = ?`,
    [studentId, unitId]
  );
  for (const eg of existingGroups) {
    dbRun('DELETE FROM student_groups WHERE student_id = ? AND group_id = ?', [studentId, eg.group_id]);
  }

  // Assign to new group
  dbRun(
    'INSERT OR IGNORE INTO student_groups (student_id, group_id) VALUES (?, ?)',
    [studentId, groupId]
  );

  res.json({ success: true, group: { id: group.id, name: group.name } });
});

export default router;
