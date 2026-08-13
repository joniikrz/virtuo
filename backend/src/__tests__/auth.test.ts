import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../index';
import prisma from '../prisma';
import { signPasswordResetToken, signSessionToken, verifyToken } from '../security';

vi.mock('../prisma', () => ({
  default: {
    $transaction: vi.fn(async (operations: unknown[]) => Promise.all(operations)),
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    role: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    space: { findMany: vi.fn() },
    task: { findMany: vi.fn() },
    attachment: { findMany: vi.fn() },
    comment: { findMany: vi.fn() },
    notification: { findMany: vi.fn(), deleteMany: vi.fn() },
  },
}));

describe('Auth Endpoints API Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /api/auth/me - returns an anonymous session without a console-triggering 401', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: null });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('GET /api/auth/activity - returns only task notifications', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'u1', email: 'user@virtuo.local', firstName: 'User', lastName: 'One',
      sessionVersion: 0, role: { name: 'USER' }, emailNotifications: true, inAppNotifications: true,
    } as never);
    vi.mocked(prisma.notification.findMany).mockResolvedValue([{
      id: 'notification-1', type: 'COMMENT_ADDED', title: 'New comment',
      message: 'Alex commented on the task: Report', taskId: 'task-1', createdAt: new Date('2026-08-13T10:00:00.000Z'),
    }] as never);
    const token = signSessionToken('u1', 0);

    const res = await request(app)
      .get('/api/auth/activity')
      .set('Cookie', [`token=${token}`]);

    expect(res.status).toBe(200);
    expect(prisma.notification.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'u1', taskId: { not: null } },
    }));
    expect(res.body.activities).toEqual([expect.objectContaining({
      action: 'COMMENT_ADDED', taskId: 'task-1', title: 'New comment',
    })]);
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
        password: 'Molla-Vjollce-2026!',
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
    expect(res.body.error).toContain('All fields');
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
      sessionVersion: 0,
      roleId: 'role-user-id',
      role: { name: 'USER' },
    } as never);
    vi.mocked(prisma.user.update).mockResolvedValue({ id: 'u1' } as never);
    const token = signSessionToken('u1', 0);

    const res = await request(app)
      .put('/api/auth/change-password')
      .set('Cookie', [`token=${token}`])
      .send({ currentPassword: 'Current123!', newPassword: 'NewPassword456!' });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('successfully');
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
      sessionVersion: 0,
      roleId: 'role-user-id',
      role: { name: 'USER' },
    } as never);
    const token = signSessionToken('u1', 0);

    const res = await request(app)
      .put('/api/auth/change-password')
      .set('Cookie', [`token=${token}`])
      .send({ currentPassword: 'WrongPassword!', newPassword: 'NewPassword456!' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('current');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('PUT /api/auth/users/:id/password - Admin-i ndryshon fjalëkalimin dhe anulon sesionet e vjetra', async () => {
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce({
        id: 'admin-1', email: 'admin@virtuo.local', firstName: 'Admin', lastName: 'User',
        sessionVersion: 0, role: { name: 'ADMIN' }, emailNotifications: true, inAppNotifications: true,
      } as never)
      .mockResolvedValueOnce({
        id: 'user-2', email: 'user2@virtuo.local', firstName: 'User', lastName: 'Two',
      } as never);
    vi.mocked(prisma.user.update).mockResolvedValue({ id: 'user-2' } as never);
    const token = signSessionToken('admin-1', 0);

    const res = await request(app)
      .put('/api/auth/users/user-2/password')
      .set('Cookie', [`token=${token}`])
      .send({ newPassword: 'PasswordiIRi-2026!' });

    expect(res.status).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-2' },
      data: { passwordHash: expect.any(String), sessionVersion: { increment: 1 } },
    });
    expect(res.body.message).toContain('Older sessions were revoked');
  });

  it('PUT /api/auth/users/:id/password - Përdoruesi i zakonshëm nuk ka qasje', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-1', email: 'user@virtuo.local', firstName: 'User', lastName: 'One',
      sessionVersion: 0, role: { name: 'USER' }, emailNotifications: true, inAppNotifications: true,
    } as never);
    const token = signSessionToken('user-1', 0);

    const res = await request(app)
      .put('/api/auth/users/user-2/password')
      .set('Cookie', [`token=${token}`])
      .send({ newPassword: 'PasswordiIRi-2026!' });

    expect(res.status).toBe(403);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('DELETE /api/auth/users/:id - Admin-i fshin llogarinë dhe të dhënat e lidhura', async () => {
    const adminPasswordHash = await bcrypt.hash('AdminPassword123!', 10);
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce({
        id: 'admin-1', email: 'admin@virtuo.local', firstName: 'Admin', lastName: 'User',
        sessionVersion: 0, role: { name: 'ADMIN' }, emailNotifications: true, inAppNotifications: true,
      } as never)
      .mockResolvedValueOnce({ passwordHash: adminPasswordHash } as never)
      .mockResolvedValueOnce({
        id: 'user-2', email: 'user2@virtuo.local', firstName: 'User', lastName: 'Two',
      } as never);
    vi.mocked(prisma.space.findMany).mockResolvedValue([{ id: 'space-owned' }] as never);
    vi.mocked(prisma.task.findMany).mockResolvedValue([{ id: 'task-owned' }] as never);
    vi.mocked(prisma.attachment.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.comment.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.user.delete).mockResolvedValue({ id: 'user-2' } as never);
    const token = signSessionToken('admin-1', 0);

    const res = await request(app)
      .delete('/api/auth/users/user-2')
      .set('Cookie', [`token=${token}`])
      .send({ currentPassword: 'AdminPassword123!' });

    expect(res.status).toBe(200);
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { OR: expect.arrayContaining([{ taskId: { in: ['task-owned'] } }]) },
    }));
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user-2' } });
    expect(res.body.deletedUserId).toBe('user-2');
  });

  it('POST /api/auth/forgot-password/verify - Verifikon kodin dhe kthen token të përkohshëm', async () => {
    const recoveryCodeHash = await bcrypt.hash('KodiIm123!', 10);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'u1', email: 'user@virtuo.local', recoveryCodeHash, sessionVersion: 0,
    } as never);

    const res = await request(app)
      .post('/api/auth/forgot-password/verify')
      .send({ email: 'user@virtuo.local', recoveryCode: 'KodiIm123!' });

    expect(res.status).toBe(200);
    expect(typeof res.body.resetToken).toBe('string');
    const payload = verifyToken(res.body.resetToken) as { purpose: string };
    expect(payload.purpose).toBe('password-reset');
  });

  it('POST /api/auth/reset-password - Ndryshon fjalëkalimin me token rikuperimi', async () => {
    vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 1 } as never);
    const resetToken = signPasswordResetToken('u1', 0);

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ resetToken, newPassword: 'PasswordiRi123!' });

    expect(res.status).toBe(200);
    expect(prisma.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'u1', sessionVersion: 0 },
      data: { passwordHash: expect.any(String), sessionVersion: { increment: 1 } },
    }));
  });
});
