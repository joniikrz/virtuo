import bcrypt from 'bcryptjs';
import prisma from './prisma';

const DEFAULT_ADMIN = {
  email: 'admin@virtuo.local',
  password: 'Admin123!',
  firstName: 'Admin',
  lastName: 'Virtuo',
};

/**
 * Krijon rolet dhe llogarinë e adminit në nisjen e serverit.
 * Kredencialet mund të mbishkruhen me variabla mjedisi.
 */
export async function seedDatabase(): Promise<void> {
  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: { name: 'ADMIN', description: 'Menaxheri / Shefi' },
  });

  await prisma.role.upsert({
    where: { name: 'USER' },
    update: {},
    create: { name: 'USER', description: 'Punonjës / Anëtar i ekipit' },
  });

  const adminEmail = process.env.ADMIN_EMAIL || DEFAULT_ADMIN.email;
  const adminPassword = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN.password;
  const adminFirstName = process.env.ADMIN_FIRST_NAME || DEFAULT_ADMIN.firstName;
  const adminLastName = process.env.ADMIN_LAST_NAME || DEFAULT_ADMIN.lastName;

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        firstName: adminFirstName,
        lastName: adminLastName,
        roleId: adminRole.id,
      },
    });
    console.log(`[Seed] Admin u krijua: ${adminEmail}`);
  }
}
