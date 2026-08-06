import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { signSessionToken } from '../security';

vi.mock('../prisma', () => ({
  default: {
    $transaction: vi.fn(async (operations: unknown[]) => Promise.all(operations)),
    user: { findUnique: vi.fn() },
    notification: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { app } from '../index';
import prisma from '../prisma';

describe('Notifications API caching and updates', () => {
  let token: string;

  beforeEach(() => {
    vi.clearAllMocks();
    token = signSessionToken('user-1', 0);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-1',
      email: 'user@virtuo.local',
      firstName: 'Test',
      lastName: 'User',
      emailNotifications: true,
      inAppNotifications: true,
      recoveryCodeHash: null,
      sessionVersion: 0,
      role: { name: 'USER' },
    } as never);
    vi.mocked(prisma.notification.findFirst).mockResolvedValue({
      id: 'notification-3',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    } as never);
    vi.mocked(prisma.notification.count)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3);
    vi.mocked(prisma.notification.findMany).mockResolvedValue([
      { id: 'notification-3', userId: 'user-1', isRead: false },
    ] as never);
  });

  it('kthen ETag dhe listën e njoftimeve', async () => {
    const response = await request(app)
      .get('/api/notifications')
      .set('Cookie', [`token=${token}`]);

    expect(response.status).toBe(200);
    expect(response.headers.etag).toBe('W/"notifications-notification-3-2-3"');
    expect(response.body.unreadCount).toBe(2);
    expect(response.body.notifications).toHaveLength(1);
  });

  it('kthen 304 kur njoftimet nuk kanë ndryshuar', async () => {
    const response = await request(app)
      .get('/api/notifications')
      .set('Cookie', [`token=${token}`])
      .set('If-None-Match', 'W/"notifications-notification-3-2-3"');

    expect(response.status).toBe(304);
    expect(prisma.notification.findMany).not.toHaveBeenCalled();
  });

  it('shënon njoftimin me një query të kufizuar sipas user-it', async () => {
    vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 1 });

    const response = await request(app)
      .patch('/api/notifications/notification-3/read')
      .set('Cookie', [`token=${token}`]);

    expect(response.status).toBe(200);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: 'notification-3', userId: 'user-1', isRead: false },
      data: { isRead: true },
    });
  });

  it('fshin vetëm njoftimin e përdoruesit aktual', async () => {
    vi.mocked(prisma.notification.deleteMany).mockResolvedValue({ count: 1 });

    const response = await request(app)
      .delete('/api/notifications/notification-3')
      .set('Cookie', [`token=${token}`]);

    expect(response.status).toBe(200);
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
      where: { id: 'notification-3', userId: 'user-1' },
    });
  });
});
