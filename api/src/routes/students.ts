import { Router, Request, Response } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { dbGet, dbAll, dbRun, dbTransaction } from '../db.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', (req: Request, res: Response) => {
  const search = req.query.search as string | undefined;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.max(1, Math.min(200, parseInt(req.query.limit as string) || 50));
  const offset = (page - 1) * limit;

  let countRow: { total: number } | undefined;
  let students: any[];

  if (search) {
    const pattern = `%${search}%`;
    countRow = dbGet<{ total: number }>('SELECT COUNT(*) AS total FROM students WHERE id LIKE ? OR name LIKE ?', [pattern, pattern]);
    students = dbAll('SELECT * FROM students WHERE id LIKE ? OR name LIKE ? ORDER BY name LIMIT ? OFFSET ?', [pattern, pattern, limit, offset]);
  } else {
    countRow = dbGet<{ total: number }>('SELECT COUNT(*) AS total FROM students');
    students = dbAll('SELECT * FROM students ORDER BY name LIMIT ? OFFSET ?', [limit, offset]);
  }

  const total = countRow?.total ?? 0;

  res.json({
    students,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
});

router.post('/', (req: Request, res: Response) => {
  const { studentId, name, groupId } = req.body;

  if (!studentId) {
    res.status(400).json({ error: 'studentId is required' });
    return;
  }

  if (!groupId) {
    res.status(400).json({ error: 'groupId is required' });
    return;
  }

  const group = dbGet<{ id: number; name: string }>('SELECT id, name FROM groups WHERE id = ?', [groupId]);
  if (!group) {
    res.status(404).json({ error: 'Group not found' });
    return;
  }

  const studentName = name?.trim() || null;

  const insertResult = dbRun(
    'INSERT OR IGNORE INTO students (id, name) VALUES (?, ?)',
    [studentId.trim(), studentName]
  );

  const created = insertResult.changes > 0;

  // Update name if student already exists and had no name
  if (!created && studentName) {
    dbRun('UPDATE students SET name = ? WHERE id = ? AND name IS NULL', [studentName, studentId.trim()]);
  }

  const enrollResult = dbRun(
    'INSERT OR IGNORE INTO student_groups (student_id, group_id) VALUES (?, ?)',
    [studentId.trim(), groupId]
  );

  const added = enrollResult.changes > 0;

  if (!created && !added) {
    res.json({ message: `Student is already in ${group.name}` });
    return;
  }

  res.status(201).json({
    message: `Student added to ${group.name}`,
  });
});

router.post('/import', upload.single('file'), (req: Request, res: Response) => {
  const file = req.file;
  const groupId = req.body.groupId;

  if (!file) {
    res.status(400).json({ error: 'CSV file is required' });
    return;
  }

  if (!groupId) {
    res.status(400).json({ error: 'groupId is required' });
    return;
  }

  const group = dbGet('SELECT id FROM groups WHERE id = ?', [groupId]);
  if (!group) {
    res.status(404).json({ error: 'Group not found' });
    return;
  }

  const content = file.buffer.toString('utf-8');
  let records: string[][];

  try {
    records = parse(content, {
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });
  } catch {
    res.status(400).json({ error: 'Failed to parse CSV file' });
    return;
  }

  let created = 0;
  let enrolled = 0;
  let skipped = 0;
  const total = records.length;

  dbTransaction(() => {
    for (const row of records) {
      if (row.length === 0 || !row[0]) continue;

      const studentId = row[0].trim();
      const name = row.length > 1 ? row[1]?.trim() || null : null;

      const insertResult = dbRun(
        'INSERT OR IGNORE INTO students (id, name) VALUES (?, ?)',
        [studentId, name]
      );

      if (insertResult.changes > 0) {
        created++;
      } else if (name) {
        dbRun('UPDATE students SET name = ? WHERE id = ? AND name IS NULL', [name, studentId]);
      }

      const enrollResult = dbRun(
        'INSERT OR IGNORE INTO student_groups (student_id, group_id) VALUES (?, ?)',
        [studentId, groupId]
      );

      if (enrollResult.changes > 0) {
        enrolled++;
      } else {
        skipped++;
      }
    }
  });

  res.json({ created, added: enrolled, skipped, total });
});

export default router;
