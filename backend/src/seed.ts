import bcrypt from 'bcryptjs';
import prisma from './prisma';
import { BCRYPT_ROUNDS, passwordError } from './security';

const DEFAULT_ADMIN = {
  email: 'admin@virtuo.local',
  password: 'Admin123!',
  firstName: 'Admin',
  lastName: 'Virtuo',
};

/**
 * Create roles and the administrator account during startup.
 * Credentials can be overridden with environment variables.
 */
export async function seedDatabase(): Promise<void> {
  if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_PASSWORD) {
    throw new Error('ADMIN_PASSWORD must be set in production');
  }
  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: { name: 'ADMIN', description: 'Menaxheri / Shefi' },
  });

  await prisma.role.upsert({
    where: { name: 'USER' },
    update: {},
    create: { name: 'USER', description: 'Employee / Team member' },
  });

  const adminEmail = process.env.ADMIN_EMAIL || DEFAULT_ADMIN.email;
  const adminPassword = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN.password;
  const adminFirstName = process.env.ADMIN_FIRST_NAME || DEFAULT_ADMIN.firstName;
  const adminLastName = process.env.ADMIN_LAST_NAME || DEFAULT_ADMIN.lastName;

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    if (process.env.NODE_ENV === 'production') {
      const invalidPassword = passwordError(adminPassword);
      if (invalidPassword) throw new Error(`ADMIN_PASSWORD: ${invalidPassword}`);
    }
    const passwordHash = await bcrypt.hash(adminPassword, BCRYPT_ROUNDS);
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        firstName: adminFirstName,
        lastName: adminLastName,
        roleId: adminRole.id,
      },
    });
    console.log(`[Seed] Administrator created: ${adminEmail}`);
  }
}
