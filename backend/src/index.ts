import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

// Karikimi i variablave të mjedisit (.env)
dotenv.config();

import authRouter from './routes/auth';
import spacesRouter from './routes/spaces';
import tasksRouter from './routes/tasks';
import notificationsRouter from './routes/notifications';
import tagsRouter from './routes/tags';
import { seedDatabase } from './seed';

const app = express();
const PORT = process.env.PORT || 5000;

// Konfigurimi i CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173', // Adresa e frontend-it me Vite
  credentials: true, // Lejon kalimin e cookies
}));

app.use(express.json());
app.use(cookieParser());

// Montimi i rrugëve (Routes)
app.use('/api/auth', authRouter);
app.use('/api/spaces', spacesRouter);
app.use('/api', tasksRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api', tagsRouter);

// Një rrugë bazë për të kontrolluar statusin e serverit
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

// Eksporto app për teste
export { app };

// Nisja e serverit
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, async () => {
    try {
      await seedDatabase();
    } catch (error) {
      console.error('[Seed] Gabim gjatë inicializimit:', error);
    }
    console.log(`Serveri po punon në portën http://localhost:${PORT}`);
  });
}
