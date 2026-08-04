import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';

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

/**
 * POST /api/auth/login
 * Hyrja në sistem (Login)
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

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

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role.name,
      },
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
  const { email, password, firstName, lastName } = req.body;

  if (!email || !password || !firstName || !lastName) {
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

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
      data: {
        email,
        passwordHash,
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
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role.name,
      },
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
  const { email, password, firstName, lastName } = req.body;

  if (!email || !password || !firstName || !lastName) {
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

    const passwordHash = await bcrypt.hash(password, 10);
    const initialAdmin = await prisma.user.create({
      data: {
        email,
        passwordHash,
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
      user: {
        id: initialAdmin.id,
        email: initialAdmin.email,
        firstName: initialAdmin.firstName,
        lastName: initialAdmin.lastName,
        role: initialAdmin.role.name,
      },
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
  const { email, password, firstName, lastName, roleName } = req.body;

  if (!email || !password || !firstName || !lastName || !roleName) {
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

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        roleId: role.id,
      },
    });

    res.status(201).json({
      message: 'Përdoruesi u krijua me sukses',
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: role.name,
      },
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

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'Fjalëkalimi aktual dhe i ri janë të detyrueshëm' });
    return;
  }

  if (newPassword.length < 6) {
    res.status(400).json({ error: 'Fjalëkalimi i ri duhet të ketë të paktën 6 karaktere' });
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

    res.json({ message: 'Fjalëkalimi u ndryshua me sukses' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Ndodhi një gabim gjatë ndryshimit të fjalëkalimit' });
  }
});

export default router;
