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
    },
    space: {
      findUnique: vi.fn(),
    },
    spaceMember: {
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    attachment: {
      findMany: vi.fn(),
    },
    task: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('../services/email', () => ({
  sendTaskAssignedEmail: vi.fn(),
  sendTaskCompletedEmail: vi.fn(),
}));

describe('Tasks API Tests', () => {
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

  it('POST /api/spaces/:spaceId/tasks - Lejon anëtarët e bordit të krijojnë karta/detyra të reja', async () => {
    vi.mocked(prisma.space.findUnique).mockResolvedValue({
      id: 'space-1',
      name: 'Sprint Board',
      createdById: 'test-user-id',
    } as never);

    vi.mocked(prisma.task.create).mockResolvedValue({
      id: 'task-1',
      title: 'Krijo UI në React',
      description: 'Stili Trello',
      status: 'TODO',
      deadline: new Date('2026-12-31'),
      spaceId: 'space-1',
      createdById: 'test-user-id',
    } as never);
    vi.mocked(prisma.spaceMember.count).mockResolvedValue(1);

    const res = await request(app)
      .post('/api/spaces/space-1/tasks')
      .set('Cookie', [`token=${mockToken}`])
      .send({
        title: 'Krijo UI në React',
        description: 'Stili Trello',
        deadline: '2026-12-31T12:00:00.000Z',
        assignedToIds: ['test-user-id'],
      });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Krijo UI në React');
  });

  it('GET /api/spaces/:spaceId/tasks - Kthen të gjitha kartat e bordit për anëtarët', async () => {
    vi.mocked(prisma.space.findUnique).mockResolvedValue({
      id: 'space-1',
      name: 'Sprint Board',
      isPrivate: false,
    } as never);

    vi.mocked(prisma.spaceMember.findUnique).mockResolvedValue({
      id: 'sm-1',
      spaceId: 'space-1',
      userId: 'test-user-id',
    } as never);

    vi.mocked(prisma.task.findMany).mockResolvedValue([
      {
        id: 'task-1',
        title: 'Karta 1',
        status: 'TODO',
      },
      {
        id: 'task-2',
        title: 'Karta 2',
        status: 'IN_PROGRESS',
      },
    ] as never);

    const res = await request(app)
      .get('/api/spaces/space-1/tasks')
      .set('Cookie', [`token=${mockToken}`]);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('PUT /api/tasks/:id/status - Përditëson statusin e kartës (TODO -> COMPLETED)', async () => {
    vi.mocked(prisma.task.findUnique).mockResolvedValue({
      id: 'task-1',
      title: 'Karta 1',
      status: 'TODO',
      spaceId: 'space-1',
      createdById: 'test-user-id',
      createdBy: { id: 'test-user-id', email: 'creator@virtuo.local', firstName: 'Creator', lastName: 'Name' },
      assignedTo: null,
      assignees: [],
    } as never);

    vi.mocked(prisma.task.update).mockResolvedValue({
      id: 'task-1',
      title: 'Karta 1',
      status: 'COMPLETED',
    } as never);

    const res = await request(app)
      .put('/api/tasks/task-1/status')
      .set('Cookie', [`token=${mockToken}`])
      .send({ status: 'COMPLETED' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('COMPLETED');
  });

  it('DELETE /api/tasks/:id - Lejon fshirjen e kartës nga krijuesi', async () => {
    vi.mocked(prisma.task.findUnique).mockResolvedValue({
      id: 'task-1',
      createdById: 'test-user-id',
      attachments: [],
      assignees: [],
      space: { createdById: 'test-user-id' },
    } as never);

    vi.mocked(prisma.task.delete).mockResolvedValue({} as never);
    vi.mocked(prisma.attachment.findMany).mockResolvedValue([] as never);

    const res = await request(app)
      .delete('/api/tasks/task-1')
      .set('Cookie', [`token=${mockToken}`]);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('u fshi me sukses');
  });
});
