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
import { rateLimit } from './middleware/rateLimit';
import { verifyEmailTransport } from './services/email';

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const requestTimeoutMs = Number(process.env.REQUEST_TIMEOUT_MS) || 30000;

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.set('query parser', 'simple');

const configuredOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set(configuredOrigins);

app.use((req, res, next) => {
  const requestId = typeof req.headers['x-request-id'] === 'string'
    && /^[A-Za-z0-9._-]{1,100}$/.test(req.headers['x-request-id'])
    ? req.headers['x-request-id']
    : crypto.randomUUID();
  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// Konfigurimi i CORS
app.use(cors({
  origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)),
  credentials: true, // Lejon kalimin e cookies
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'If-None-Match', 'X-Request-Id'],
  maxAge: 600,
}));

app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }));
app.use(cookieParser());

app.use('/api', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  const fetchSite = req.headers['sec-fetch-site'];
  const forwardedProto = typeof req.headers['x-forwarded-proto'] === 'string' ? req.headers['x-forwarded-proto'].split(',')[0] : req.protocol;
  const forwardedHost = typeof req.headers['x-forwarded-host'] === 'string' ? req.headers['x-forwarded-host'].split(',')[0] : req.headers.host;
  const sameOrigin = Boolean(origin && forwardedHost && origin === `${forwardedProto}://${forwardedHost}`);
  if (fetchSite === 'cross-site' || (origin && !sameOrigin && !allowedOrigins.has(origin))) {
    return res.status(403).json({ error: 'Kërkesa ndër-faqe u bllokua' });
  }
  return next();
});

app.use('/api/auth/login', rateLimit({
  scope: 'login',
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 254) : 'pa-email';
    return `${req.ip || req.socket.remoteAddress || 'unknown'}:${email}`;
  },
}));
app.use('/api/auth/forgot-password', rateLimit({ scope: 'recovery', windowMs: 15 * 60 * 1000, max: 5 }));
app.use('/api/auth/reset-password', rateLimit({ scope: 'reset', windowMs: 15 * 60 * 1000, max: 5 }));
app.use('/api/auth/register', rateLimit({ scope: 'register', windowMs: 60 * 60 * 1000, max: 10 }));
app.use('/api/auth/setup', rateLimit({ scope: 'setup', windowMs: 60 * 60 * 1000, max: 3 }));
app.use('/api', rateLimit({ scope: 'api', windowMs: 60 * 1000, max: 600 }));

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
    return res.status(400).json({ error: 'Skedari nuk u pranua. Kontrollo madhësinë dhe provo përsëri.' });
  }
  if (err.name === 'UploadValidationError') {
    return res.status(400).json({ error: err.message });
  }
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'JSON-i i kërkesës nuk është i vlefshëm' });
  }
  const requestId = res.getHeader('X-Request-Id');
  console.error(`Unhandled error [${requestId || 'pa-id'}]:`, process.env.NODE_ENV === 'production' ? err.message : err);
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
      // Verifikimi raporton konfigurimin në log, por nuk e bllokon nisjen e aplikacionit.
      void verifyEmailTransport();
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
