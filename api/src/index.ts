import express from 'express';
import cors from 'cors';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { initDb } from './db.js';
import { requireAuth } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import scanRoutes from './routes/scan.js';
import dispenseRoutes from './routes/dispense.js';
import groupsRoutes from './routes/groups.js';
import studentsRoutes from './routes/students.js';
import reportsRoutes from './routes/reports.js';
import materialsRoutes from './routes/materials.js';
import adminRoutes from './routes/admin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(cors());
app.use(express.json());

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/scan', requireAuth, scanRoutes);
app.use('/api/dispense', requireAuth, dispenseRoutes);
app.use('/api/groups', requireAuth, groupsRoutes);
app.use('/api/students', requireAuth, studentsRoutes);
app.use('/api/reports', requireAuth, reportsRoutes);
app.use('/api/materials', requireAuth, materialsRoutes);
app.use('/api/admin', requireAuth, adminRoutes);

// Production static file serving
if (process.env.NODE_ENV === 'production') {
  const webDist = path.join(__dirname, '..', '..', 'web', 'dist');
  app.use(express.static(webDist));

  app.get('/{*splat}', (_req, res) => {
    res.sendFile(path.join(webDist, 'index.html'));
  });
}

// Error handling (must be after all routes)
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

function getLocalIP(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const nets = interfaces[name];
    if (!nets) continue;
    for (const net of nets) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

async function start() {
  await initDb();

  app.listen(PORT, '0.0.0.0', () => {
    const localIP = getLocalIP();
    console.log('Materials Tracker API running on:');
    console.log(`  Local:   http://localhost:${PORT}`);
    console.log(`  Network: http://${localIP}:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
