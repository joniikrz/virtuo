import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { signSessionToken } from '../security';

vi.mock('../prisma', () => {
  const db: any = {
    user: { findUnique: vi.fn() },
    space: { findUnique: vi.fn(), create: vi.fn() },
    spaceMember: { findUnique: vi.fn(), count: vi.fn(), createMany: vi.fn(), upsert: vi.fn() },
    spaceInvite: { findUnique: vi.fn(), count: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() },
    notification: { create: vi.fn(), deleteMany: vi.fn() },
    activityLog: { create: vi.fn() },
  };
  db.$transaction = vi.fn(async (operation: any) => (
    typeof operation === 'function' ? operation(db) : Promise.all(operation)
  ));
  return { default: db };
});

import { app } from '../index';
import prisma from '../prisma';

const owner = {
  id: 'owner-1', email: 'owner@virtuo.local', firstName: 'Arta', lastName: 'Owner',
  sessionVersion: 0, emailNotifications: true, inAppNotifications: true, recoveryCodeHash: null,
  role: { name: 'USER' },
};
const invitee = {
  id: 'user-2', email: 'user@virtuo.local', firstName: 'Blerim', lastName: 'User',
  sessionVersion: 0, emailNotifications: true, inAppNotifications: true, recoveryCodeHash: null,
  role: { name: 'USER' },
};

describe('Space invitations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('krijon hapësirën vetëm me pronarin, edhe nëse klienti dërgon memberIds', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(owner as never);
    vi.mocked(prisma.space.create).mockResolvedValue({ id: 'space-1', name: 'Privat', createdById: owner.id } as never);
    vi.mocked(prisma.spaceMember.createMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.space.findUnique).mockResolvedValue({ id: 'space-1', name: 'Privat', _count: { members: 1, tasks: 0 } } as never);

    const response = await request(app)
      .post('/api/spaces')
      .set('Cookie', [`token=${signSessionToken(owner.id, 0)}`])
      .send({ name: 'Privat', memberIds: ['user-2'] });

    expect(response.status).toBe(201);
    expect(prisma.spaceMember.createMany).toHaveBeenCalledWith({ data: [{ spaceId: 'space-1', userId: owner.id }] });
  });

  it('dërgon ftesë sipas email-it pa e shtuar përdoruesin menjëherë', async () => {
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(owner as never)
      .mockResolvedValueOnce(invitee as never);
    vi.mocked(prisma.space.findUnique).mockResolvedValue({ id: 'space-1', name: 'Ekipi', createdById: owner.id } as never);
    vi.mocked(prisma.spaceMember.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.spaceInvite.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.spaceMember.count).mockResolvedValue(1);
    vi.mocked(prisma.spaceInvite.count).mockResolvedValue(0);
    vi.mocked(prisma.spaceInvite.upsert).mockResolvedValue({ id: 'invite-1', status: 'PENDING' } as never);
    vi.mocked(prisma.notification.deleteMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.notification.create).mockResolvedValue({ id: 'notification-1' } as never);

    const response = await request(app)
      .post('/api/spaces/space-1/invitations')
      .set('Cookie', [`token=${signSessionToken(owner.id, 0)}`])
      .send({ email: ' USER@virtuo.local ' });

    expect(response.status).toBe(201);
    expect(response.body.invite.status).toBe('PENDING');
    expect(prisma.spaceMember.upsert).not.toHaveBeenCalled();
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: invitee.id, type: 'SPACE_INVITE', spaceInviteId: 'invite-1' }),
    });
  });

  it('kthen mesazh të qartë kur email-i nuk ekziston', async () => {
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(owner as never)
      .mockResolvedValueOnce(null);
    vi.mocked(prisma.space.findUnique).mockResolvedValue({ id: 'space-1', name: 'Ekipi', createdById: owner.id } as never);

    const response = await request(app)
      .post('/api/spaces/space-1/invitations')
      .set('Cookie', [`token=${signSessionToken(owner.id, 0)}`])
      .send({ email: 'missing@virtuo.local' });

    expect(response.status).toBe(404);
    expect(response.body.error).toContain('No registered user exists');
  });

  it('e shton përdoruesin në hapësirë vetëm pasi ai e pranon ftesën', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(invitee as never);
    vi.mocked(prisma.spaceInvite.findUnique).mockResolvedValue({
      id: 'invite-1', spaceId: 'space-1', invitedUserId: invitee.id, invitedById: owner.id,
      status: 'PENDING', space: { id: 'space-1', name: 'Ekipi' },
    } as never);
    vi.mocked(prisma.spaceMember.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.spaceMember.count).mockResolvedValue(1);
    vi.mocked(prisma.spaceInvite.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.spaceMember.upsert).mockResolvedValue({ id: 'member-2' } as never);
    vi.mocked(prisma.notification.deleteMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.notification.create).mockResolvedValue({ id: 'notification-owner' } as never);

    const response = await request(app)
      .post('/api/spaces/invitations/invite-1/accept')
      .set('Cookie', [`token=${signSessionToken(invitee.id, 0)}`]);

    expect(response.status).toBe(200);
    expect(response.body.spaceId).toBe('space-1');
    expect(prisma.spaceMember.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { spaceId_userId: { spaceId: 'space-1', userId: invitee.id } },
    }));
  });
});
