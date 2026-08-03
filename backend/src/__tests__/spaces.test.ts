import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../index';
import prisma from '../prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

vi.mock('../prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    space: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    spaceMember: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

describe('Spaces API Tests', () => {
  let mockToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    mockToken = jwt.sign({ userId: 'test-user-id' }, JWT_SECRET, { expiresIn: '1h' });

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'test-user-id',
      email: 'user@virtuo.local',
      firstName: 'Test',
      lastName: 'User',
      roleId: 'user-role-id',
      role: { name: 'USER' },
    } as never);
  });

  it('POST /api/spaces - Lejon çdo përdorues të regjistruar të krijojë bord të ri', async () => {
    vi.mocked(prisma.space.create).mockResolvedValue({
      id: 'space-100',
      name: 'Bordi im i ri',
      description: 'Test space',
      color: '#0079BF',
      isPrivate: false,
      createdById: 'test-user-id',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    vi.mocked(prisma.spaceMember.create).mockResolvedValue({
      id: 'sm-1',
      spaceId: 'space-100',
      userId: 'test-user-id',
      joinedAt: new Date(),
    } as never);

    const res = await request(app)
      .post('/api/spaces')
      .set('Cookie', [`token=${mockToken}`])
      .send({
        name: 'Bordi im i ri',
        description: 'Test space',
        color: '#0079BF',
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Bordi im i ri');
    expect(prisma.space.create).toHaveBeenCalledOnce();
  });

  it('POST /api/spaces/:id/members - Lejon anëtarin ose krijuesin të ftojë përdorues në bord', async () => {
    vi.mocked(prisma.space.findUnique).mockResolvedValue({
      id: 'space-100',
      name: 'Bordi im i ri',
      createdById: 'test-user-id',
    } as never);

    vi.mocked(prisma.user.findUnique).mockImplementation(async (args: unknown) => {
      const a = args as { where: { id: string } };
      if (a.where.id === 'test-user-id') {
        return { id: 'test-user-id', role: { name: 'USER' } } as never;
      }
      if (a.where.id === 'invited-user-id') {
        return { id: 'invited-user-id', email: 'invited@virtuo.local', firstName: 'Invited', lastName: 'Person', role: { name: 'USER' } } as never;
      }
      return null as never;
    });

    vi.mocked(prisma.spaceMember.findUnique).mockResolvedValue(null);

    vi.mocked(prisma.spaceMember.create).mockResolvedValue({
      id: 'sm-2',
      spaceId: 'space-100',
      userId: 'invited-user-id',
      user: {
        id: 'invited-user-id',
        email: 'invited@virtuo.local',
        firstName: 'Invited',
        lastName: 'Person',
      },
    } as never);

    const res = await request(app)
      .post('/api/spaces/space-100/members')
      .set('Cookie', [`token=${mockToken}`])
      .send({ userId: 'invited-user-id' });

    expect(res.status).toBe(201);
    expect(res.body.message).toContain('Anëtari u shtua');
  });

  it('DELETE /api/spaces/:id - Lejon krijuesin e bordit ta fshijë atë', async () => {
    vi.mocked(prisma.space.findUnique).mockResolvedValue({
      id: 'space-100',
      name: 'Bordi im i ri',
      createdById: 'test-user-id',
    } as never);

    vi.mocked(prisma.space.delete).mockResolvedValue({} as never);

    const res = await request(app)
      .delete('/api/spaces/space-100')
      .set('Cookie', [`token=${mockToken}`]);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('u fshi me sukses');
  });
});
