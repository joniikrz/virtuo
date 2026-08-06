import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import prisma from './prisma';

import authRouter from './routes/auth';
import spacesRouter from './routes/spaces';
import tasksRouter from './routes/tasks';
import notificationsRouter from './routes/notifications';
import tagsRouter from './routes/tags';
import { seedDatabase } from './seed';

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const requestTimeoutMs = Number(process.env.REQUEST_TIMEOUT_MS) || 30000;

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use((req, res, next) => {
  const requestId = typeof req.headers['x-request-id'] === 'string' && req.headers['x-request-id'].length <= 100
    ? req.headers['x-request-id']
    : crypto.randomUUID();
  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// Konfigurimi i CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173', // Adresa e frontend-it me Vite
  credentials: true, // Lejon kalimin e cookies
}));

app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }));
app.use(cookieParser());

// Montimi i rrugëve (Routes)
app.use('/api/auth', authRouter);
app.use('/api/spaces', spacesRouter);
app.use('/api/spaces/:spaceId/tasks', tasksRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api', tagsRouter);

// Një rrugë bazë për të kontrolluar statusin e serverit
app.get('/health/live', (_req, res) => {
  res.json({ status: 'alive', timestamp: new Date().toISOString() });
});

app.get('/health/ready', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ready', timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Readiness check failed:', error);
    res.status(503).json({ status: 'not_ready' });
  }
});

app.get('/health', (_req, res) => res.redirect(307, '/health/ready'));

app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint-i nuk u gjet' }));

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err.name === 'MulterError') {
    return res.status(400).json({ error: 'Ngarkimi i skedarit dështoi: ' + err.message });
  }
  console.error('Unhandled error:', err);
  return res.status(500).json({ error: 'Ndodhi një gabim i papritur në server' });
});

// Eksporto app për teste
export { app };

// Nisja e serverit
if (process.env.NODE_ENV !== 'test') {
  const startServer = async () => {
    try {
      await prisma.$connect();
      if (process.env.NODE_ENV !== 'production') await seedDatabase();
    } catch (error) {
      console.error('[Startup] Lidhja me databazën dështoi:', error);
      process.exit(1);
    }

    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`Serveri po punon në portën http://0.0.0.0:${PORT}`);
    });
    server.requestTimeout = requestTimeoutMs;
    server.headersTimeout = Math.min(requestTimeoutMs + 5000, 65000);
    server.keepAliveTimeout = 5000;

    let shuttingDown = false;
    const shutdown = (signal: string) => {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log(`[Shutdown] ${signal}: po mbyllen lidhjet aktive`);
      server.close(async () => {
        await prisma.$disconnect();
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 20000).unref();
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  };

  void startServer();
}
