import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { dbGet, dbRun, dbAll, dbTransaction } from '../db.js';

const router = Router();

interface UsageRow {
  total: number;
}

router.post('/', (req: Request, res: Response) => {
  const { studentId, groupId, material, quantity = 1, pin } = req.body;

  if (!studentId || !groupId || !material) {
    res.status(400).json({ error: 'studentId, groupId, and material are required' });
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

  // Validate material exists in the materials table
  const mat = dbGet<{ id: number; name: string }>('SELECT id, name FROM materials WHERE name = ?', [material]);
  if (!mat) {
    const validMaterials = dbAll<{ name: string }>('SELECT name FROM materials ORDER BY sort_order');
    res.status(400).json({ error: `material must be one of: ${validMaterials.map(m => m.name).join(', ')}` });
    return;
  }

  const result = dbTransaction(() => {
    const group = dbGet('SELECT id FROM groups WHERE id = ?', [groupId]);
    if (!group) {
      return { error: 'Group not found', status: 404 };
    }

    const enrollment = dbGet('SELECT 1 AS ok FROM student_groups WHERE student_id = ? AND group_id = ?', [studentId, groupId]);
    if (!enrollment) {
      return { error: 'Student is not enrolled in this group', status: 400 };
    }

    // Look up limit from group_material_limits
    const limitRow = dbGet<{ max_quantity: number }>(
      'SELECT max_quantity FROM group_material_limits WHERE group_id = ? AND material_id = ?',
      [groupId, mat.id]
    );
    const limit = limitRow ? limitRow.max_quantity : -1;

    const usageRow = dbGet<UsageRow>(
      'SELECT COALESCE(SUM(quantity), 0) AS total FROM transactions WHERE student_id = ? AND group_id = ? AND material = ?',
      [studentId, groupId, material]
    );
    const currentUsage = usageRow?.total ?? 0;

    if (isReturn) {
      // Can't return more than what's been used
      const returnAmount = Math.abs(quantity);
      if (returnAmount > currentUsage) {
        return {
          error: `Cannot return ${returnAmount} — only ${currentUsage} currently dispensed`,
          status: 400,
        };
      }
    } else {
      // Check limits for dispensing
      if (limit !== -1) {
        if (limit === 0) {
          return { error: 'This material is not available for this group', status: 400 };
        }

        if (currentUsage + quantity > limit) {
          return {
            error: `Would exceed limit. Current usage: ${currentUsage}, limit: ${limit}, requested: ${quantity}`,
            status: 400,
          };
        }
      }
    }

    const insertResult = dbRun(
      'INSERT INTO transactions (student_id, group_id, material, quantity) VALUES (?, ?, ?, ?)',
      [studentId, groupId, material, quantity]
    );

    const transaction = dbGet('SELECT * FROM transactions WHERE id = ?', [insertResult.lastId]);
    return { transaction };
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
