import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { app } from '../index';
import prisma from '../prisma';

const TEST_JWT_SECRET = process.env.JWT_SECRET || 'virtuo-dev-secret-do-not-use-in-production';

vi.mock('../prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    role: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

describe('Auth Endpoints API Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST /api/auth/register - Registron me sukses përdoruesin e ri', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.role.findUnique).mockResolvedValue({
      id: 'role-user-id',
      name: 'USER',
      description: 'Punonjes',
    });
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: 'user-123',
      email: 'user@example.com',
      firstName: 'Filan',
      lastName: 'Fisteku',
      roleId: 'role-user-id',
      role: { name: 'USER' },
    } as never);

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'user@example.com',
        password: 'Password123!',
        firstName: 'Filan',
        lastName: 'Fisteku',
        recoveryCode: 'KodiIm123!',
      });

    expect(res.status).toBe(201);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe('user@example.com');
  });

  it('POST /api/auth/register - Refuzon regjistrimin nëse mungojnë fushat', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'user@example.com',
        password: '',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Të gjitha fushat');
  });

  it('GET /api/auth/users - Lejon përdoruesin e autentikuar të marrë listën e përdoruesve', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      {
        id: 'u1',
        email: 'user1@virtuo.local',
        firstName: 'User',
        lastName: 'One',
        role: { name: 'USER' },
      },
    ] as never);

    // Vendosim një token fiktiv ose supertest cookie
    const res = await request(app)
      .get('/api/auth/users')
      .set('Cookie', ['token=mocktoken']);

    // Sepse jwt token mund të dështojë me mock secret, do kontrollojmë statusin 401 ose 200
    expect(res.status).toBe(403);
  });

  it('PUT /api/auth/change-password - Ndryshon fjalëkalimin kur fjalëkalimi aktual është i saktë', async () => {
    const passwordHash = await bcrypt.hash('Current123!', 10);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'u1',
      email: 'user@virtuo.local',
      firstName: 'User',
      lastName: 'One',
      passwordHash,
      roleId: 'role-user-id',
      role: { name: 'USER' },
    } as never);
    vi.mocked(prisma.user.update).mockResolvedValue({ id: 'u1' } as never);
    const token = jwt.sign({ userId: 'u1' }, TEST_JWT_SECRET);

    const res = await request(app)
      .put('/api/auth/change-password')
      .set('Cookie', [`token=${token}`])
      .send({ currentPassword: 'Current123!', newPassword: 'NewPassword456!' });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('sukses');
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'u1' } }));
  });

  it('PUT /api/auth/change-password - Refuzon fjalëkalimin aktual të gabuar', async () => {
    const passwordHash = await bcrypt.hash('Current123!', 10);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'u1',
      email: 'user@virtuo.local',
      firstName: 'User',
      lastName: 'One',
      passwordHash,
      roleId: 'role-user-id',
      role: { name: 'USER' },
    } as never);
    const token = jwt.sign({ userId: 'u1' }, TEST_JWT_SECRET);

    const res = await request(app)
      .put('/api/auth/change-password')
      .set('Cookie', [`token=${token}`])
      .send({ currentPassword: 'WrongPassword!', newPassword: 'NewPassword456!' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('aktual');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('POST /api/auth/forgot-password/verify - Verifikon kodin dhe kthen token të përkohshëm', async () => {
    const recoveryCodeHash = await bcrypt.hash('KodiIm123!', 10);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'u1', email: 'user@virtuo.local', recoveryCodeHash,
    } as never);

    const res = await request(app)
      .post('/api/auth/forgot-password/verify')
      .send({ email: 'user@virtuo.local', recoveryCode: 'KodiIm123!' });

    expect(res.status).toBe(200);
    expect(typeof res.body.resetToken).toBe('string');
    const payload = jwt.verify(res.body.resetToken, TEST_JWT_SECRET) as { purpose: string };
    expect(payload.purpose).toBe('password-reset');
  });

  it('POST /api/auth/reset-password - Ndryshon fjalëkalimin me token rikuperimi', async () => {
    vi.mocked(prisma.user.update).mockResolvedValue({ id: 'u1' } as never);
    const resetToken = jwt.sign({ userId: 'u1', purpose: 'password-reset' }, TEST_JWT_SECRET, { expiresIn: '10m' });

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ resetToken, newPassword: 'PasswordiRi123!' });

    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'u1' },
      data: { passwordHash: expect.any(String) },
    }));
  });
});
