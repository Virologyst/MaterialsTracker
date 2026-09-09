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

// POST /api/students — add individual student
router.post('/', (req: Request, res: Response) => {
  const { studentId, name, unitId, groupId } = req.body;

  if (!studentId) {
    res.status(400).json({ error: 'studentId is required' });
    return;
  }

  if (!unitId) {
    res.status(400).json({ error: 'unitId is required' });
    return;
  }

  const unit = dbGet<{ id: number; name: string }>('SELECT id, name FROM units WHERE id = ?', [unitId]);
  if (!unit) {
    res.status(404).json({ error: 'Unit not found' });
    return;
  }

  // Normalize student ID: prepend 'n' if not present
  let normalizedId = studentId.trim();
  if (!/^[nNsS]/i.test(normalizedId)) {
    normalizedId = 'n' + normalizedId;
  }

  const studentName = name?.trim() || null;

  dbTransaction(() => {
    const insertResult = dbRun(
      'INSERT OR IGNORE INTO students (id, name) VALUES (?, ?)',
      [normalizedId, studentName]
    );

    if (insertResult.changes === 0 && studentName) {
      dbRun('UPDATE students SET name = ? WHERE id = ? AND name IS NULL', [studentName, normalizedId]);
    }

    // Enroll in unit
    dbRun('INSERT OR IGNORE INTO student_units (student_id, unit_id) VALUES (?, ?)', [normalizedId, unitId]);

    // Assign to group if specified
    if (groupId) {
      const group = dbGet('SELECT id FROM groups WHERE id = ? AND unit_id = ?', [groupId, unitId]);
      if (group) {
        // Remove existing group assignments for this student in this unit
        const existingGroups = dbAll<{ group_id: number }>(
          `SELECT sg.group_id FROM student_groups sg
           JOIN groups g ON g.id = sg.group_id
           WHERE sg.student_id = ? AND g.unit_id = ?`,
          [normalizedId, unitId]
        );
        for (const eg of existingGroups) {
          dbRun('DELETE FROM student_groups WHERE student_id = ? AND group_id = ?', [normalizedId, eg.group_id]);
        }
        dbRun('INSERT OR IGNORE INTO student_groups (student_id, group_id) VALUES (?, ?)', [normalizedId, groupId]);
      }
    }
  });

  res.status(201).json({ message: `Student added to ${unit.name}` });
});

// POST /api/students/import — CSV import with new format
router.post('/import', upload.single('file'), (req: Request, res: Response) => {
  const file = req.file;
  const unitId = req.body.unitId;

  if (!file) {
    res.status(400).json({ error: 'CSV file is required' });
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
  let grouped = 0;
  let ungrouped = 0;
  let groupsCreated = 0;
  let skipped = 0;

  dbTransaction(() => {
    for (const row of records) {
      if (row.length === 0) continue;

      // Skip header row
      if (row[0]?.toLowerCase() === 'student' || row[1]?.toLowerCase() === 'integration id') {
        continue;
      }

      // Skip empty rows (all columns empty)
      if (row.every(cell => !cell || !cell.trim())) continue;

      // Skip section headers: column 0 has content but column 1 is empty or non-numeric
      let integrationId = row[1]?.trim();
      if (!integrationId) continue;

      // Strip n/s prefix if present before numeric check
      const strippedId = integrationId.replace(/^[nNsS]/, '');
      if (!/^\d+$/.test(strippedId)) {
        continue;
      }

      const studentName = row[0]?.trim() || null;
      const groupCode = row[2]?.trim() || null;

      // Normalize to 'n' + digits
      let studentId = 'n' + strippedId;

      // Create or update student
      const insertResult = dbRun(
        'INSERT OR IGNORE INTO students (id, name) VALUES (?, ?)',
        [studentId, studentName]
      );

      if (insertResult.changes > 0) {
        created++;
      } else if (studentName) {
        dbRun('UPDATE students SET name = ? WHERE id = ? AND name IS NULL', [studentName, studentId]);
      }

      // Enroll in unit
      const enrollResult = dbRun(
        'INSERT OR IGNORE INTO student_units (student_id, unit_id) VALUES (?, ?)',
        [studentId, unitId]
      );
      if (enrollResult.changes > 0) {
        enrolled++;
      }

      // Handle group assignment
      if (groupCode && groupCode !== '#N/A') {
        // Find or create group under this unit
        let group = dbGet<{ id: number }>('SELECT id FROM groups WHERE name = ? AND unit_id = ?', [groupCode, unitId]);
        if (!group) {
          const groupResult = dbRun('INSERT INTO groups (name, unit_id) VALUES (?, ?)', [groupCode, unitId]);
          group = { id: groupResult.lastId };
          groupsCreated++;
        }

        // Remove any existing group assignment for this student in this unit
        const existingGroups = dbAll<{ group_id: number }>(
          `SELECT sg.group_id FROM student_groups sg
           JOIN groups g ON g.id = sg.group_id
           WHERE sg.student_id = ? AND g.unit_id = ?`,
          [studentId, unitId]
        );
        for (const eg of existingGroups) {
          dbRun('DELETE FROM student_groups WHERE student_id = ? AND group_id = ?', [studentId, eg.group_id]);
        }

        dbRun('INSERT OR IGNORE INTO student_groups (student_id, group_id) VALUES (?, ?)', [studentId, group.id]);
        grouped++;
      } else {
        ungrouped++;
      }
    }
  });

  res.json({ created, enrolled, grouped, ungrouped, groups_created: groupsCreated, skipped });
});

export default router;
