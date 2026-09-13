import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/api.ts';
import { initializeDB } from './server/proxy.ts';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check endpoints
app.get(['/health', '/api/health', '/api/health-check'], (_req, res) => {
  res.status(200).json({ status: 'ok', healthy: true, timestamp: new Date().toISOString() });
});

// Mount API routes FIRST
app.use('/api', apiRouter);

async function startServer() {
  try {
    await initializeDB();
    console.log('Database initialized');
  } catch (e) {
    console.error('Failed to initialize database', e);
    console.warn('Continuing with purely in-memory transient data.');
  }

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 CodeSymposium Platform running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

