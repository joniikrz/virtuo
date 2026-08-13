import { PrismaClient } from '@prisma/client';
import { SessionUserRepositoryPort } from '../../../application/auth/ports';

export class PrismaSessionUserRepository implements SessionUserRepositoryPort {
  constructor(private readonly db: PrismaClient) {}

  async findById(userId: string) {
    const user = await this.db.user.findUnique({ where: { id: userId }, include: { role: true } });
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role.name,
      emailNotifications: user.emailNotifications,
      inAppNotifications: user.inAppNotifications,
      hasRecoveryCode: Boolean(user.recoveryCodeHash),
      sessionVersion: user.sessionVersion,
    };
  }
}

