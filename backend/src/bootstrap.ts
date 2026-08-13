import 'dotenv/config';
import prisma from './prisma';
import { seedDatabase } from './seed';

async function bootstrap() {
  try {
    await prisma.$connect();
    const removedOrphanNotifications = await prisma.$executeRaw`
      DELETE FROM "notifications" AS notification
      WHERE notification."task_id" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "tasks" AS task
          WHERE task."id" = notification."task_id"
        )
    `;
    if (removedOrphanNotifications > 0) {
      console.log(`[Bootstrap] Removed ${removedOrphanNotifications} orphan task notifications`);
    }
    await seedDatabase();
    console.log('[Bootstrap] Databaza u inicializua me sukses');
  } catch (error) {
    console.error('[Bootstrap] Initialization failed:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void bootstrap();
