import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const prisma = globalForPrisma.prisma || new PrismaClient({
  errorFormat: process.env.NODE_ENV === 'production' ? 'minimal' : 'pretty',
  log: process.env.NODE_ENV === 'production' ? ['warn', 'error'] : ['warn', 'error'],
  transactionOptions: {
    maxWait: Number(process.env.DB_TRANSACTION_MAX_WAIT_MS) || 5000,
    timeout: Number(process.env.DB_TRANSACTION_TIMEOUT_MS) || 15000,
  },
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
