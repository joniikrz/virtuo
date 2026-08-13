import prisma from '../prisma';

export async function logActivity(userId: string, action: string, description: string): Promise<void> {
  try {
    await prisma.activityLog.create({ data: { userId, action, description } });
  } catch (error) {
    // Activity supports auditing but must not fail the primary action.
    console.error('Activity log error:', error);
  }
}
