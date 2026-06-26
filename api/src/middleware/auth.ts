import { Request, Response, NextFunction } from 'express';

export const validTokens = new Set<string>();

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = authHeader.slice(7);

  if (!validTokens.has(token)) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  next();
}
