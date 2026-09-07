import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { dbGet, dbRun, dbAll, dbTransaction } from '../db.js';

const router = Router();

interface UsageRow {
  total: number;
}

router.post('/', (req: Request, res: Response) => {
  const { studentId, unitId, groupId: legacyGroupId, material, quantity = 1, pin } = req.body;

  // Support both unitId (new) and groupId (legacy)
  const isLegacy = !unitId && legacyGroupId;

  if (!studentId || (!unitId && !legacyGroupId) || !material) {
    res.status(400).json({ error: 'studentId, unitId (or groupId), and material are required' });
    return;
  }

  const isReturn = quantity < 0;

  if (quantity === 0) {
    res.status(400).json({ error: 'quantity cannot be zero' });
    return;
  }

  if (!isReturn && quantity < 1) {
    res.status(400).json({ error: 'quantity must be at least 1' });
    return;
  }

  // Returns require PIN
  if (isReturn) {
    if (!pin) {
      res.status(400).json({ error: 'PIN is required for returns' });
      return;
    }

    const pinRow = dbGet<{ value: string }>('SELECT value FROM config WHERE key = ?', ['pin_hash']);
    if (!pinRow) {
      res.status(400).json({ error: 'PIN has not been set' });
      return;
    }

    const match = bcrypt.compareSync(String(pin), pinRow.value);
    if (!match) {
      res.status(401).json({ error: 'Invalid PIN' });
      return;
    }
  }

  // Validate material exists
  const mat = dbGet<{ id: number; name: string }>('SELECT id, name FROM materials WHERE name = ?', [material]);
  if (!mat) {
    const validMaterials = dbAll<{ name: string }>('SELECT name FROM materials ORDER BY sort_order');
    res.status(400).json({ error: `material must be one of: ${validMaterials.map(m => m.name).join(', ')}` });
    return;
  }

  // Legacy path: groupId-based (for groups not yet assigned to a unit)
  if (isLegacy) {
    const result = dbTransaction(() => {
      const group = dbGet<{ id: number; total_limit: number }>('SELECT id, total_limit FROM groups WHERE id = ?', [legacyGroupId]);
      if (!group) return { error: 'Group not found', status: 404 };

      const enrollment = dbGet('SELECT 1 AS ok FROM student_groups WHERE student_id = ? AND group_id = ?', [studentId, legacyGroupId]);
      if (!enrollment) return { error: 'Student is not enrolled in this group', status: 400 };

      const limitRow = dbGet<{ max_quantity: number }>(
        'SELECT max_quantity FROM group_material_limits WHERE group_id = ? AND material_id = ?',
        [legacyGroupId, mat.id]
      );
      const limit = limitRow ? limitRow.max_quantity : -1;

      const usageRow = dbGet<UsageRow>(
        'SELECT COALESCE(SUM(quantity), 0) AS total FROM transactions WHERE student_id = ? AND group_id = ? AND material = ?',
        [studentId, legacyGroupId, material]
      );
      const currentUsage = usageRow?.total ?? 0;

      if (isReturn) {
        if (Math.abs(quantity) > currentUsage) {
          return { error: `Cannot return ${Math.abs(quantity)} — only ${currentUsage} currently dispensed`, status: 400 };
        }
      } else {
        if (limit !== -1) {
          if (limit === 0) return { error: 'This material is not available for this group', status: 400 };
          if (currentUsage + quantity > limit) {
            return { error: `Would exceed limit. Current usage: ${currentUsage}, limit: ${limit}, requested: ${quantity}`, status: 400 };
          }
        }
        const totalLimit = group.total_limit ?? -1;
        if (totalLimit !== -1) {
          const totalUsageRow = dbGet<UsageRow>(
            'SELECT COALESCE(SUM(quantity), 0) AS total FROM transactions WHERE student_id = ? AND group_id = ?',
            [studentId, legacyGroupId]
          );
          if ((totalUsageRow?.total ?? 0) + quantity > totalLimit) {
            return { error: `Would exceed overall limit`, status: 400 };
          }
        }
      }

      const insertResult = dbRun(
        'INSERT INTO transactions (student_id, group_id, material, quantity) VALUES (?, ?, ?, ?)',
        [studentId, legacyGroupId, material, quantity]
      );
      return { transaction: dbGet('SELECT * FROM transactions WHERE id = ?', [insertResult.lastId]) };
    });

    if ('error' in result) {
      res.status(result.status!).json({ error: result.error });
      return;
    }
    res.status(201).json(result.transaction);
    return;
  }

  // New path: unitId-based
  const result = dbTransaction(() => {
    const unit = dbGet<{ id: number; limit_type: string; total_limit: number }>(
      'SELECT id, limit_type, total_limit FROM units WHERE id = ?', [unitId]
    );
    if (!unit) return { error: 'Unit not found', status: 404 };

    // Verify student is enrolled in the unit
    const enrollment = dbGet('SELECT 1 FROM student_units WHERE student_id = ? AND unit_id = ?', [studentId, unitId]);
    if (!enrollment) return { error: 'Student is not enrolled in this unit', status: 400 };

    // Find student's group in this unit
    const groupRow = dbGet<{ id: number; name: string }>(`
      SELECT g.id, g.name FROM student_groups sg
      JOIN groups g ON g.id = sg.group_id
      WHERE sg.student_id = ? AND g.unit_id = ?
    `, [studentId, unitId]);

    // Get unit material limit
    const limitRow = dbGet<{ max_quantity: number }>(
      'SELECT max_quantity FROM unit_material_limits WHERE unit_id = ? AND material_id = ?',
      [unitId, mat.id]
    );
    const limit = limitRow ? limitRow.max_quantity : -1;

    if (unit.limit_type === 'individual') {
      // Individual mode: check this student's own usage
      const usageRow = dbGet<UsageRow>(
        'SELECT COALESCE(SUM(quantity), 0) AS total FROM transactions WHERE student_id = ? AND unit_id = ? AND material = ?',
        [studentId, unitId, material]
      );
      const currentUsage = usageRow?.total ?? 0;

      if (isReturn) {
        if (Math.abs(quantity) > currentUsage) {
          return { error: `Cannot return ${Math.abs(quantity)} — only ${currentUsage} currently dispensed`, status: 400 };
        }
      } else {
        if (limit !== -1) {
          if (limit === 0) return { error: 'This material is not available for this unit', status: 400 };
          if (currentUsage + quantity > limit) {
            return { error: `Would exceed limit. Current usage: ${currentUsage}, limit: ${limit}, requested: ${quantity}`, status: 400 };
          }
        }
        // Check overall total limit
        if (unit.total_limit !== -1) {
          const totalRow = dbGet<UsageRow>(
            'SELECT COALESCE(SUM(quantity), 0) AS total FROM transactions WHERE student_id = ? AND unit_id = ?',
            [studentId, unitId]
          );
          if ((totalRow?.total ?? 0) + quantity > unit.total_limit) {
            return { error: `Would exceed overall limit for this unit`, status: 400 };
          }
        }
      }
    } else {
      // Group mode: check entire group's usage
      if (!groupRow) {
        return { error: 'Student must be assigned to a group before dispensing in group-mode units', status: 400 };
      }

      // Sum all group members' usage for this material in this unit
      const groupUsageRow = dbGet<UsageRow>(`
        SELECT COALESCE(SUM(t.quantity), 0) AS total
        FROM transactions t
        JOIN student_groups sg ON sg.student_id = t.student_id
        WHERE sg.group_id = ? AND t.unit_id = ? AND t.material = ?
      `, [groupRow.id, unitId, material]);
      const groupUsage = groupUsageRow?.total ?? 0;

      if (isReturn) {
        // For returns, check the student's personal usage
        const personalRow = dbGet<UsageRow>(
          'SELECT COALESCE(SUM(quantity), 0) AS total FROM transactions WHERE student_id = ? AND unit_id = ? AND material = ?',
          [studentId, unitId, material]
        );
        if (Math.abs(quantity) > (personalRow?.total ?? 0)) {
          return { error: `Cannot return ${Math.abs(quantity)} — only ${personalRow?.total ?? 0} personally dispensed`, status: 400 };
        }
      } else {
        if (limit !== -1) {
          if (limit === 0) return { error: 'This material is not available for this unit', status: 400 };
          if (groupUsage + quantity > limit) {
            return { error: `Would exceed group limit. Group usage: ${groupUsage}, limit: ${limit}, requested: ${quantity}`, status: 400 };
          }
        }
        // Check overall total limit for the group
        if (unit.total_limit !== -1) {
          const groupTotalRow = dbGet<UsageRow>(`
            SELECT COALESCE(SUM(t.quantity), 0) AS total
            FROM transactions t
            JOIN student_groups sg ON sg.student_id = t.student_id
            WHERE sg.group_id = ? AND t.unit_id = ?
          `, [groupRow.id, unitId]);
          if ((groupTotalRow?.total ?? 0) + quantity > unit.total_limit) {
            return { error: `Would exceed overall group limit for this unit`, status: 400 };
          }
        }
      }
    }

    const insertResult = dbRun(
      'INSERT INTO transactions (student_id, unit_id, group_id, material, quantity) VALUES (?, ?, ?, ?, ?)',
      [studentId, unitId, groupRow?.id ?? null, material, quantity]
    );
    return { transaction: dbGet('SELECT * FROM transactions WHERE id = ?', [insertResult.lastId]) };
  });

  if ('error' in result) {
    res.status(result.status!).json({ error: result.error });
    return;
  }

  res.status(201).json(result.transaction);
});

router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  const result = dbRun('DELETE FROM transactions WHERE id = ?', [id]);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Transaction not found' });
    return;
  }

  res.json({ success: true });
});

export default router;
