import prisma from '../prisma';

export async function logActivity(userId: string, action: string, description: string): Promise<void> {
  try {
    await prisma.activityLog.create({ data: { userId, action, description } });
  } catch (error) {
    // Aktiviteti ndihmon auditimin, por nuk duhet ta dështojë veprimin kryesor.
    console.error('Activity log error:', error);
  }
}
