import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { logActivity } from '../services/activity';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;
if (process.env.NODE_ENV === 'production' && !JWT_SECRET) {
  throw new Error('JWT_SECRET duhet të vendoset në production');
}
if (!JWT_SECRET) {
  console.warn('WARNING: JWT_SECRET is not set. Using a default key for development only.');
}
const JWT_SECRET_VALUE = JWT_SECRET || 'virtuo-dev-secret-do-not-use-in-production';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RECOVERY_CODE_MIN_LENGTH = 6;

function publicUser(user: any, roleName?: string) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: roleName || user.role?.name,
    emailNotifications: user.emailNotifications ?? true,
    inAppNotifications: user.inAppNotifications ?? true,
    hasRecoveryCode: Boolean(user.recoveryCodeHash),
  };
}

function validRecoveryCode(value: unknown): value is string {
  return typeof value === 'string' && value.length >= RECOVERY_CODE_MIN_LENGTH && value.length <= 64;
}

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/**
 * POST /api/auth/login
 * Hyrja në sistem (Login)
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { password } = req.body;
  const email = normalizeEmail(req.body.email);

  if (!email || !password) {
    res.status(400).json({ error: 'Ju lutem shkruani email-in dhe fjalëkalimin' });
    return;
  }

  if (!EMAIL_REGEX.test(email)) {
    res.status(400).json({ error: 'Email-i nuk është i vlefshëm' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });

    if (!user) {
      res.status(401).json({ error: 'Email-i ose fjalëkalimi është i gabuar' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ error: 'Email-i ose fjalëkalimi është i gabuar' });
      return;
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET_VALUE, { expiresIn: '7d' });
    await logActivity(user.id, 'LOGIN', 'U kyç në llogari');

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      user: publicUser(user),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Ndodhi një gabim në server gjatë hyrjes' });
  }
});

/**
 * POST /api/auth/logout
 * Dalja nga sistemi (Logout)
 */
router.post('/logout', (req: Request, res: Response): void => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
  res.json({ message: 'U larguat me sukses' });
});

/**
 * GET /api/auth/me
 * Kthen profilin e përdoruesit aktual të kyçur
 */
router.get('/me', authenticateToken, (req: AuthRequest, res: Response): void => {
  res.json({ user: req.user });
});

/**
 * GET /api/auth/users
 * Lista e të gjithë përdoruesve
 */
router.get('/users', authenticateToken, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { firstName: 'asc' },
    });

    res.json(
      users.map((u) => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role.name,
      }))
    );
  } catch (error) {
    console.error('Fetch users error:', error);
    res.status(500).json({ error: 'Ndodhi një gabim gjatë marrjes së listës së përdoruesve' });
  }
});

/**
 * POST /api/auth/register
 * Regjistrim publik për përdorues të rinj
 */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { password, firstName, lastName, recoveryCode } = req.body;
  const email = normalizeEmail(req.body.email);

  if (!email || !password || !firstName || !lastName || !recoveryCode) {
    res.status(400).json({ error: 'Të gjitha fushat janë të detyrueshme' });
    return;
  }

  if (!EMAIL_REGEX.test(email)) {
    res.status(400).json({ error: 'Email-i nuk është i vlefshëm' });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: 'Fjalëkalimi duhet të ketë të paktën 6 karaktere' });
    return;
  }

  if (!validRecoveryCode(recoveryCode)) {
    res.status(400).json({ error: 'Kodi i rikuperimit duhet të ketë 6 deri në 64 karaktere' });
    return;
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ error: 'Ekziston një përdorues me këtë email' });
      return;
    }

    const userRole = await prisma.role.findUnique({ where: { name: 'USER' } });
    if (!userRole) {
      res.status(500).json({ error: 'Roli USER nuk ekziston. Rinisni serverin.' });
      return;
    }

    const [passwordHash, recoveryCodeHash] = await Promise.all([
      bcrypt.hash(password, 10),
      bcrypt.hash(recoveryCode, 10),
    ]);
    const newUser = await prisma.user.create({
      data: {
        email,
        passwordHash,
        recoveryCodeHash,
        firstName,
        lastName,
        roleId: userRole.id,
      },
      include: { role: true },
    });

    const token = jwt.sign({ userId: newUser.id }, JWT_SECRET_VALUE, { expiresIn: '7d' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      message: 'Regjistrimi u krye me sukses',
      user: publicUser(newUser),
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Ndodhi një gabim gjatë regjistrimit' });
  }
});

/**
 * POST /api/auth/setup
 * Krijon rolet dhe përdoruesin e parë Admin nëse nuk ekziston asnjë përdorues
 */
router.post('/setup', async (req: Request, res: Response): Promise<void> => {
  const { password, firstName, lastName, recoveryCode } = req.body;
  const email = normalizeEmail(req.body.email);

  if (!email || !password || !firstName || !lastName || !recoveryCode) {
    res.status(400).json({ error: 'Të gjitha fushat janë të detyrueshme për regjistrimin e parë' });
    return;
  }

  if (!EMAIL_REGEX.test(email)) {
    res.status(400).json({ error: 'Email-i nuk është i vlefshëm' });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: 'Fjalëkalimi duhet të ketë të paktën 6 karaktere' });
    return;
  }

  if (!validRecoveryCode(recoveryCode)) {
    res.status(400).json({ error: 'Kodi i rikuperimit duhet të ketë 6 deri në 64 karaktere' });
    return;
  }

  try {
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      res.status(400).json({ error: 'Sistemi është konfiguruar tashmë. Nuk lejohet setup fillestar.' });
      return;
    }

    const adminRole = await prisma.role.upsert({
      where: { name: 'ADMIN' },
      update: {},
      create: { name: 'ADMIN', description: 'Menaxheri / Shefi i cili krijon detyra dhe Spaces' },
    });

    await prisma.role.upsert({
      where: { name: 'USER' },
      update: {},
      create: { name: 'USER', description: 'Punonjësi i thjeshtë me To-Do listën personale' },
    });

    const [passwordHash, recoveryCodeHash] = await Promise.all([
      bcrypt.hash(password, 10),
      bcrypt.hash(recoveryCode, 10),
    ]);
    const initialAdmin = await prisma.user.create({
      data: {
        email,
        passwordHash,
        recoveryCodeHash,
        firstName,
        lastName,
        roleId: adminRole.id,
      },
      include: { role: true },
    });

    const token = jwt.sign({ userId: initialAdmin.id }, JWT_SECRET_VALUE, { expiresIn: '7d' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      message: 'Sistemi u inicializua me sukses',
      user: publicUser(initialAdmin),
    });
  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).json({ error: 'Ndodhi një gabim gjatë setup-it të sistemit' });
  }
});

/**
 * POST /api/auth/register-user
 * Krijimi i një përdoruesi të ri nga Admin-i
 */
router.post('/register-user', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { password, firstName, lastName, roleName, recoveryCode } = req.body;
  const email = normalizeEmail(req.body.email);

  if (!email || !password || !firstName || !lastName || !roleName || !recoveryCode) {
    res.status(400).json({ error: 'Të gjitha fushat janë të detyrueshme' });
    return;
  }

  if (!EMAIL_REGEX.test(email)) {
    res.status(400).json({ error: 'Email-i nuk është i vlefshëm' });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: 'Fjalëkalimi duhet të ketë të paktën 6 karaktere' });
    return;
  }

  if (!validRecoveryCode(recoveryCode)) {
    res.status(400).json({ error: 'Kodi i rikuperimit duhet të ketë 6 deri në 64 karaktere' });
    return;
  }

  if (roleName !== 'ADMIN' && roleName !== 'USER') {
    res.status(400).json({ error: 'Roli i pavlefshëm. Lejohet vetëm ADMIN ose USER' });
    return;
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ error: 'Ekziston një përdorues me këtë email' });
      return;
    }

    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      res.status(400).json({ error: 'Roli i kërkuar nuk ekziston në sistem' });
      return;
    }

    const [passwordHash, recoveryCodeHash] = await Promise.all([
      bcrypt.hash(password, 10),
      bcrypt.hash(recoveryCode, 10),
    ]);
    const newUser = await prisma.user.create({
      data: {
        email,
        passwordHash,
        recoveryCodeHash,
        firstName,
        lastName,
        roleId: role.id,
      },
      include: { role: true },
    });

    res.status(201).json({
      message: 'Përdoruesi u krijua me sukses',
      user: publicUser(newUser, role.name),
    });
  } catch (error) {
    console.error('Register user error:', error);
    res.status(500).json({ error: 'Ndodhi një gabim gjatë krijimit të përdoruesit' });
  }
});

/**
 * PUT /api/auth/change-password
 * Ndryshimi i fjalëkalimit
 */
router.put('/change-password', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const { currentPassword, newPassword } = req.body;

  if (!userId) {
    res.status(401).json({ error: 'I paautorizuar' });
    return;
  }

  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || !currentPassword || !newPassword) {
    res.status(400).json({ error: 'Fjalëkalimi aktual dhe i ri janë të detyrueshëm' });
    return;
  }

  if (newPassword.length < 6) {
    res.status(400).json({ error: 'Fjalëkalimi i ri duhet të ketë të paktën 6 karaktere' });
    return;
  }

  if (newPassword === currentPassword) {
    res.status(400).json({ error: 'Fjalëkalimi i ri duhet të jetë ndryshe nga fjalëkalimi aktual' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'Përdoruesi nuk u gjet' });
      return;
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      res.status(400).json({ error: 'Fjalëkalimi aktual është i gabuar' });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await logActivity(userId, 'PASSWORD_CHANGED', 'Ndryshoi fjalëkalimin');

    res.json({ message: 'Fjalëkalimi u ndryshua me sukses' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Ndodhi një gabim gjatë ndryshimit të fjalëkalimit' });
  }
});

router.put('/profile', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const firstName = typeof req.body.firstName === 'string' ? req.body.firstName.trim() : '';
  const lastName = typeof req.body.lastName === 'string' ? req.body.lastName.trim() : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';

  if (!userId) {
    res.status(401).json({ error: 'I paautorizuar' });
    return;
  }
  if (!firstName || !lastName || !email) {
    res.status(400).json({ error: 'Emri, mbiemri dhe email-i janë të detyrueshëm' });
    return;
  }
  if (firstName.length > 60 || lastName.length > 60 || !EMAIL_REGEX.test(email)) {
    res.status(400).json({ error: 'Të dhënat e profilit nuk janë të vlefshme' });
    return;
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== userId) {
      res.status(409).json({ error: 'Ky email përdoret nga një llogari tjetër' });
      return;
    }
    const user = await prisma.user.update({
      where: { id: userId },
      data: { firstName, lastName, email },
      include: { role: true },
    });
    await logActivity(userId, 'PROFILE_UPDATED', 'Përditësoi të dhënat e profilit');
    res.json({ message: 'Profili u përditësua me sukses', user: publicUser(user) });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Ndodhi një gabim gjatë përditësimit të profilit' });
  }
});

router.put('/preferences', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const { emailNotifications, inAppNotifications } = req.body;

  if (!userId) {
    res.status(401).json({ error: 'I paautorizuar' });
    return;
  }
  if (typeof emailNotifications !== 'boolean' || typeof inAppNotifications !== 'boolean') {
    res.status(400).json({ error: 'Preferencat e njoftimeve nuk janë të vlefshme' });
    return;
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { emailNotifications, inAppNotifications },
      include: { role: true },
    });
    await logActivity(userId, 'NOTIFICATION_SETTINGS', 'Përditësoi preferencat e njoftimeve');
    res.json({ message: 'Preferencat u ruajtën', user: publicUser(user) });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'Ndodhi një gabim gjatë ruajtjes së preferencave' });
  }
});

router.get('/activity', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'I paautorizuar' });
    return;
  }

  try {
    const activities = await prisma.activityLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ activities });
  } catch (error) {
    console.error('Activity history error:', error);
    res.status(500).json({ error: 'Ndodhi një gabim gjatë leximit të aktivitetit' });
  }
});

router.put('/recovery-code', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const { currentPassword, recoveryCode } = req.body;

  if (!userId) {
    res.status(401).json({ error: 'I paautorizuar' });
    return;
  }
  if (typeof currentPassword !== 'string' || !validRecoveryCode(recoveryCode)) {
    res.status(400).json({ error: 'Shkruani fjalëkalimin aktual dhe një kod rikuperimi me 6 deri në 64 karaktere' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      res.status(400).json({ error: 'Fjalëkalimi aktual është i gabuar' });
      return;
    }
    const recoveryCodeHash = await bcrypt.hash(recoveryCode, 10);
    await prisma.user.update({ where: { id: userId }, data: { recoveryCodeHash } });
    await logActivity(userId, 'RECOVERY_CODE_UPDATED', 'Ndryshoi kodin e rikuperimit');
    res.json({ message: 'Kodi i rikuperimit u ruajt me sukses', hasRecoveryCode: true });
  } catch (error) {
    console.error('Recovery code update error:', error);
    res.status(500).json({ error: 'Ndodhi një gabim gjatë ruajtjes së kodit' });
  }
});

router.post('/forgot-password/verify', async (req: Request, res: Response): Promise<void> => {
  const email = normalizeEmail(req.body.email);
  const recoveryCode = req.body.recoveryCode;
  if (!EMAIL_REGEX.test(email) || !validRecoveryCode(recoveryCode)) {
    res.status(400).json({ error: 'Email-i ose kodi i rikuperimit nuk është i saktë' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    const matches = user?.recoveryCodeHash
      ? await bcrypt.compare(recoveryCode, user.recoveryCodeHash)
      : false;
    if (!user || !matches) {
      res.status(400).json({ error: 'Email-i ose kodi i rikuperimit nuk është i saktë' });
      return;
    }
    const resetToken = jwt.sign(
      { userId: user.id, purpose: 'password-reset' },
      JWT_SECRET_VALUE,
      { expiresIn: '10m' }
    );
    res.json({ resetToken });
  } catch (error) {
    console.error('Forgot password verification error:', error);
    res.status(500).json({ error: 'Ndodhi një gabim gjatë verifikimit' });
  }
});

router.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
  const { resetToken, newPassword } = req.body;
  if (typeof resetToken !== 'string' || typeof newPassword !== 'string' || newPassword.length < 6) {
    res.status(400).json({ error: 'Token-i dhe fjalëkalimi i ri me së paku 6 karaktere janë të detyrueshëm' });
    return;
  }

  try {
    const payload = jwt.verify(resetToken, JWT_SECRET_VALUE) as { userId?: string; purpose?: string };
    if (!payload.userId || payload.purpose !== 'password-reset') {
      res.status(400).json({ error: 'Kërkesa për rikuperim nuk është e vlefshme' });
      return;
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: payload.userId }, data: { passwordHash } });
    await logActivity(payload.userId, 'PASSWORD_RESET', 'Rivendosi fjalëkalimin me kodin e rikuperimit');
    res.json({ message: 'Fjalëkalimi u rivendos. Tani mund të kyçeni.' });
  } catch (error) {
    res.status(400).json({ error: 'Kërkesa për rikuperim ka skaduar ose nuk është e vlefshme' });
  }
});

export default router;
