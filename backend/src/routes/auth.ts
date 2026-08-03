import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'virtuo-super-secret-key-12345';

/**
 * POST /api/auth/login
 * Hyrja në sistem (Login)
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Ju lutem shkruani email-in dhe fjalëkalimin' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'Email-i ose fjalëkalimi është i gabuar' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Email-i ose fjalëkalimi është i gabuar' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    // Vendosja e cookie-t HTTP-Only
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // true në production (HTTPS)
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ditë
    });

    return res.json({
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
    return res.status(500).json({ error: 'Ndodhi një gabim në server gjatë hyrjes' });
  }
});

/**
 * POST /api/auth/logout
 * Dalja nga sistemi (Logout)
 */
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  return res.json({ message: 'U larguat me sukses' });
});

/**
 * GET /api/auth/me
 * Kthen profilin e përdoruesit aktual të kyçur
 */
router.get('/me', authenticateToken, (req: AuthRequest, res: Response) => {
  return res.json({ user: req.user });
});

/**
 * GET /api/auth/users
 * Lista e të gjithë përdoruesve (për t'i caktuar detyrat) - Vetëm për Admin/Shefa
 */
router.get('/users', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
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
    return res.json(users);
  } catch (error) {
    console.error('Fetch users error:', error);
    return res.status(500).json({ error: 'Ndodhi një gabim gjatë marrjes së listës së përdoruesve' });
  }
});

/**
 * POST /api/auth/setup
 * Krijon rolet dhe përdoruesin e parë Admin nëse nuk ekziston asnjë përdorues (Inicializimi i parë)
 */
router.post('/setup', async (req, res) => {
  const { email, password, firstName, lastName } = req.body;

  if (!email || !password || !firstName || !lastName) {
    return res.status(400).json({ error: 'Të gjitha fushat janë të detyrueshme për regjistrimin e parë' });
  }

  try {
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      return res.status(400).json({ error: 'Sistemi është konfiguruar tashmë. Nuk lejohet setup fillestar.' });
    }

    // Krijimi i roleve
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

    const token = jwt.sign({ userId: initialAdmin.id }, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(201).json({
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
    return res.status(500).json({ error: 'Ndodhi një gabim gjatë setup-it të sistemit' });
  }
});

/**
 * POST /api/auth/register-user
 * Krijimi i një përdoruesi të ri (Punonjës ose Admin) - Vetëm nga Admin-i
 */
router.post('/register-user', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { email, password, firstName, lastName, roleName } = req.body;

  if (!email || !password || !firstName || !lastName || !roleName) {
    return res.status(400).json({ error: 'Të gjitha fushat janë të detyrueshme' });
  }

  if (roleName !== 'ADMIN' && roleName !== 'USER') {
    return res.status(400).json({ error: 'Roli i pavlefshëm. Lejohet vetëm ADMIN ose USER' });
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Ekziston një përdorues me këtë email' });
    }

    const role = await prisma.role.findUnique({
      where: { name: roleName },
    });

    if (!role) {
      return res.status(400).json({ error: 'Roli i kërkuar nuk ekziston në sistem' });
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

    return res.status(201).json({
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
    return res.status(500).json({ error: 'Ndodhi një gabim gjatë krijimit të përdoruesit' });
  }
});

export default router;
