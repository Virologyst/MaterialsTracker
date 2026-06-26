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

  const txCount = dbGet<{ count: number }>('SELECT COUNT(*) AS count FROM transactions');
  const studentCount = dbGet<{ count: number }>('SELECT COUNT(*) AS count FROM students');
  const transactions = txCount?.count ?? 0;
  const students = studentCount?.count ?? 0;

  const semLabel = semester.trim();

  dbTransaction(() => {
    // Archive transactions
    if (transactions > 0) {
      dbRun(
        `INSERT INTO transactions_archive (id, student_id, group_id, material, quantity, dispensed_at, semester)
         SELECT id, student_id, group_id, material, quantity, dispensed_at, ?
         FROM transactions`,
        [semLabel]
      );
    }

    // Archive students with their group memberships
    if (students > 0) {
      dbRun(
        `INSERT INTO students_archive (id, name, group_id, group_name, semester)
         SELECT s.id, s.name, sg.group_id, g.name, ?
         FROM students s
         JOIN student_groups sg ON sg.student_id = s.id
         JOIN groups g ON g.id = sg.group_id`,
        [semLabel]
      );
    }

    // Clear all active data
    dbRun('DELETE FROM transactions');
    dbRun('DELETE FROM student_groups');
    dbRun('DELETE FROM students');
  });

  res.json({
    archived_transactions: transactions,
    archived_students: students,
    message: `Archived ${transactions} transaction(s) and ${students} student(s) under semester "${semLabel}". All usage reset.`,
  });
});

export default router;
