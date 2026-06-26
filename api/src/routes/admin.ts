import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { dbGet, dbRun, dbTransaction } from '../db.js';

const router = Router();

router.post('/semester-reset', (req: Request, res: Response) => {
  const { pin, semester } = req.body;

  if (!pin) {
    res.status(400).json({ error: 'PIN is required' });
    return;
  }

  if (!semester || !semester.trim()) {
    res.status(400).json({ error: 'Semester label is required (e.g. "2026-S1")' });
    return;
  }

  // Verify PIN
  const row = dbGet<{ value: string }>('SELECT value FROM config WHERE key = ?', ['pin_hash']);
  if (!row) {
    res.status(400).json({ error: 'PIN has not been set' });
    return;
  }

  const match = bcrypt.compareSync(String(pin), row.value);
  if (!match) {
    res.status(401).json({ error: 'Invalid PIN' });
    return;
  }

  const countRow = dbGet<{ count: number }>('SELECT COUNT(*) AS count FROM transactions');
  const txCount = countRow?.count ?? 0;

  if (txCount === 0) {
    res.json({ archived: 0, message: 'No transactions to archive' });
    return;
  }

  dbTransaction(() => {
    // Copy all transactions to archive with semester label
    dbRun(
      `INSERT INTO transactions_archive (id, student_id, group_id, material, quantity, dispensed_at, semester)
       SELECT id, student_id, group_id, material, quantity, dispensed_at, ?
       FROM transactions`,
      [semester.trim()]
    );

    // Delete all transactions
    dbRun('DELETE FROM transactions');
  });

  res.json({
    archived: txCount,
    message: `Archived ${txCount} transaction(s) under semester "${semester.trim()}"`,
  });
});

export default router;
