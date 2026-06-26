import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { dbGet, dbRun } from '../db.js';
import { validTokens } from '../middleware/auth.js';

const router = Router();

router.post('/login', (req: Request, res: Response) => {
  const { pin } = req.body;

  if (!pin) {
    res.status(400).json({ error: 'PIN is required' });
    return;
  }

  const row = dbGet<{ value: string }>('SELECT value FROM config WHERE key = ?', ['pin_hash']);

  if (!row) {
    res.status(400).json({ error: 'PIN needs to be set first' });
    return;
  }

  const match = bcrypt.compareSync(String(pin), row.value);

  if (!match) {
    res.status(401).json({ error: 'Invalid PIN' });
    return;
  }

  const token = uuidv4();
  validTokens.add(token);

  res.json({ token });
});

router.post('/set-pin', (req: Request, res: Response) => {
  const { pin, currentPin } = req.body;

  if (!pin) {
    res.status(400).json({ error: 'PIN is required' });
    return;
  }

  const row = dbGet<{ value: string }>('SELECT value FROM config WHERE key = ?', ['pin_hash']);

  if (row) {
    if (!currentPin) {
      res.status(400).json({ error: 'Current PIN is required to change PIN' });
      return;
    }

    const match = bcrypt.compareSync(String(currentPin), row.value);

    if (!match) {
      res.status(401).json({ error: 'Current PIN is incorrect' });
      return;
    }
  }

  const hash = bcrypt.hashSync(String(pin), 10);
  dbRun('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', ['pin_hash', hash]);

  res.json({ success: true });
});

export default router;
