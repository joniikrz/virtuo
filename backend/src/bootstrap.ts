import 'dotenv/config';
import prisma from './prisma';
import { seedDatabase } from './seed';

async function bootstrap() {
  try {
    await prisma.$connect();
    await seedDatabase();
    console.log('[Bootstrap] Databaza u inicializua me sukses');
  } catch (error) {
    console.error('[Bootstrap] Inicializimi dështoi:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void bootstrap();
