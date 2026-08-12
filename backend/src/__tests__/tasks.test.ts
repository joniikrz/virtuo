import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../index';
import prisma from '../prisma';
import { signSessionToken } from '../security';
import { sendTaskAssignedEmail } from '../services/email';

vi.mock('../prisma', () => ({
  default: {
    $transaction: vi.fn(async (operations: unknown[]) => Promise.all(operations)),
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
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    comment: {
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    task: {
      aggregate: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    notification: {
      create: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
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
    mockToken = signSessionToken('test-user-id', 0);

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'test-user-id',
      email: 'user@virtuo.local',
      firstName: 'Test',
      lastName: 'User',
      roleId: 'user-role-id',
      sessionVersion: 0,
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
    vi.mocked(prisma.task.aggregate).mockResolvedValue({
      _count: { id: 0 },
      _max: { updatedAt: null },
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

  it('POST /api/spaces/:spaceId/tasks - Nuk e vonon përgjigjen duke pritur SMTP-në', async () => {
    vi.mocked(prisma.space.findUnique).mockResolvedValue({
      id: 'space-1',
      name: 'Sprint Board',
      createdById: 'test-user-id',
    } as never);
    vi.mocked(prisma.spaceMember.count).mockResolvedValue(1);
    vi.mocked(prisma.task.create).mockResolvedValue({
      id: 'task-email-1',
      title: 'Task me email',
      description: '',
      status: 'TODO',
      priority: 'NORMAL',
      deadline: new Date('2026-12-31T12:00:00.000Z'),
      spaceId: 'space-1',
      createdById: 'test-user-id',
      createdBy: {
        id: 'test-user-id', email: 'creator@example.com', firstName: 'Test', lastName: 'User',
      },
      assignedTo: {
        id: 'assigned-user-id', email: 'assigned@example.com', firstName: 'Assigned', lastName: 'User',
        emailNotifications: true, inAppNotifications: true,
      },
      assignees: [{
        userId: 'assigned-user-id',
        user: {
          id: 'assigned-user-id', email: 'assigned@example.com', firstName: 'Assigned', lastName: 'User',
          emailNotifications: true, inAppNotifications: true,
        },
      }],
    } as never);
    vi.mocked(sendTaskAssignedEmail).mockImplementation(() => new Promise((resolve) => {
      setTimeout(() => resolve(false), 750);
    }));

    const startedAt = Date.now();
    const res = await request(app)
      .post('/api/spaces/space-1/tasks')
      .set('Cookie', [`token=${mockToken}`])
      .send({
        title: 'Task me email',
        deadline: '2026-12-31T12:00:00.000Z',
        assignedToIds: ['assigned-user-id'],
      });

    expect(res.status).toBe(201);
    expect(Date.now() - startedAt).toBeLessThan(500);
    expect(sendTaskAssignedEmail).toHaveBeenCalledWith(
      'assigned@example.com',
      'Assigned User',
      'Task me email',
      'Test User',
      expect.any(Date),
      'task-email-1',
    );
  });

  it('POST /api/spaces/:spaceId/tasks - Përpunon email-in për secilin assignee', async () => {
    const assignedUsers = ['a', 'b', 'c'].map((suffix) => ({
      id: `user-${suffix}`,
      email: `${suffix}@example.com`,
      firstName: `User ${suffix.toUpperCase()}`,
      lastName: 'Test',
      emailNotifications: true,
      inAppNotifications: true,
    }));
    vi.mocked(prisma.space.findUnique).mockResolvedValue({ id: 'space-1', createdById: 'test-user-id' } as never);
    vi.mocked(prisma.spaceMember.count).mockResolvedValue(3);
    vi.mocked(prisma.task.create).mockResolvedValue({
      id: 'task-many', title: 'Task për ekipin', description: '', status: 'TODO', priority: 'NORMAL',
      deadline: new Date('2026-12-31T12:00:00.000Z'), spaceId: 'space-1', createdById: 'test-user-id',
      createdBy: { id: 'test-user-id', email: 'creator@example.com', firstName: 'Test', lastName: 'User' },
      assignedTo: assignedUsers[0],
      assignees: assignedUsers.map((user) => ({ userId: user.id, user })),
    } as never);
    vi.mocked(sendTaskAssignedEmail).mockResolvedValue(true);
    const token = signSessionToken('test-user-id', 0);

    const res = await request(app)
      .post('/api/spaces/space-1/tasks')
      .set('Cookie', [`token=${token}`])
      .send({
        title: 'Task për ekipin', deadline: '2026-12-31T12:00:00.000Z',
        assignedToIds: assignedUsers.map((user) => user.id),
      });

    expect(res.status).toBe(201);
    await vi.waitFor(() => expect(sendTaskAssignedEmail).toHaveBeenCalledTimes(3));
    expect(vi.mocked(sendTaskAssignedEmail).mock.calls.map((call) => call[0])).toEqual([
      'a@example.com', 'b@example.com', 'c@example.com',
    ]);
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
    vi.mocked(prisma.task.aggregate).mockResolvedValue({
      _count: { id: 2 },
      _max: { updatedAt: new Date('2026-01-01T00:00:00.000Z') },
    } as never);

    const res = await request(app)
      .get('/api/spaces/space-1/tasks')
      .set('Cookie', [`token=${mockToken}`]);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('GET /api/tasks?scope=assigned - Bashkon vetëm detyrat e caktuara përdoruesit nga të gjitha hapësirat', async () => {
    vi.mocked(prisma.task.aggregate).mockResolvedValue({
      _count: { id: 1 },
      _max: { updatedAt: new Date('2026-08-12T10:00:00.000Z') },
    } as never);
    vi.mocked(prisma.task.findMany).mockResolvedValue([{
      id: 'task-mine', title: 'Detyra ime', status: 'TODO', spaceId: 'space-2',
      space: { id: 'space-2', name: 'Marketing', color: '#7048e8' },
    }] as never);

    const res = await request(app)
      .get('/api/tasks?scope=assigned')
      .set('Cookie', [`token=${mockToken}`]);

    expect(res.status).toBe(200);
    expect(res.body[0].space.name).toBe('Marketing');
    expect(prisma.task.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { OR: [{ assignedToId: 'test-user-id' }, { assignees: { some: { userId: 'test-user-id' } } }] },
    }));
  });

  it('GET /api/spaces/:spaceId/tasks - Kthen 304 kur revision-i nuk ka ndryshuar', async () => {
    vi.mocked(prisma.space.findUnique).mockResolvedValue({
      id: 'space-1',
      name: 'Sprint Board',
      isPrivate: true,
    } as never);
    vi.mocked(prisma.spaceMember.findUnique).mockResolvedValue({
      id: 'sm-1',
      spaceId: 'space-1',
      userId: 'test-user-id',
    } as never);
    vi.mocked(prisma.task.aggregate).mockResolvedValue({
      _count: { id: 2 },
      _max: { updatedAt: new Date('2026-01-01T00:00:00.000Z') },
    } as never);

    const res = await request(app)
      .get('/api/spaces/space-1/tasks')
      .set('Cookie', [`token=${mockToken}`])
      .set('If-None-Match', 'W/"tasks-2-1767225600000"');

    expect(res.status).toBe(304);
    expect(prisma.task.findMany).not.toHaveBeenCalled();
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
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({ where: { taskId: 'task-1' } });
    expect(prisma.notification.deleteMany).toHaveBeenCalledBefore(vi.mocked(prisma.task.delete));
  });

  it('POST /api/tasks/:id/comments - Njofton pjesëmarrësit e tjerë të detyrës', async () => {
    vi.mocked(prisma.task.findUnique).mockResolvedValue({
      id: 'task-1',
      title: 'Detyrë me ekip',
      spaceId: 'space-1',
      createdById: 'test-user-id',
      createdBy: { id: 'test-user-id', firstName: 'Test', lastName: 'User', inAppNotifications: true },
      assignedToId: 'assigned-user-id',
      assignedTo: { id: 'assigned-user-id', firstName: 'Assigned', lastName: 'User', inAppNotifications: true },
      assignees: [{ userId: 'assigned-user-id', user: { id: 'assigned-user-id', firstName: 'Assigned', lastName: 'User', inAppNotifications: true } }],
    } as never);
    vi.mocked(prisma.space.findUnique).mockResolvedValue({ id: 'space-1', createdById: 'test-user-id' } as never);
    vi.mocked(prisma.comment.create).mockResolvedValue({
      id: 'comment-1',
      content: 'Po punoj në të.',
      authorId: 'test-user-id',
      author: { id: 'test-user-id', firstName: 'Test', lastName: 'User', role: { name: 'USER' } },
    } as never);

    const res = await request(app)
      .post('/api/tasks/task-1/comments')
      .set('Cookie', [`token=${mockToken}`])
      .send({ content: 'Po punoj në të.' });

    expect(res.status).toBe(201);
    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({
        userId: 'assigned-user-id',
        taskId: 'task-1',
        type: 'COMMENT_ADDED',
        resourceType: 'COMMENT',
        resourceId: 'comment-1',
      })],
    });
  });

  it('DELETE /api/tasks/:id/comments/:commentId - Fshin komentin dhe njoftimin e lidhur', async () => {
    vi.mocked(prisma.task.findUnique).mockResolvedValue({
      id: 'task-1',
      title: 'Detyrë me koment',
      spaceId: 'space-1',
      createdById: 'test-user-id',
      createdBy: { id: 'test-user-id', firstName: 'Test', lastName: 'User' },
      assignedTo: null,
      assignees: [],
    } as never);
    vi.mocked(prisma.space.findUnique).mockResolvedValue({ id: 'space-1', createdById: 'test-user-id' } as never);
    vi.mocked(prisma.comment.findFirst).mockResolvedValue({ id: 'comment-1', taskId: 'task-1', authorId: 'test-user-id' } as never);
    vi.mocked(prisma.comment.delete).mockResolvedValue({} as never);

    const res = await request(app)
      .delete('/api/tasks/task-1/comments/comment-1')
      .set('Cookie', [`token=${mockToken}`]);

    expect(res.status).toBe(200);
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({ where: { resourceType: 'COMMENT', resourceId: 'comment-1' } });
    expect(prisma.comment.delete).toHaveBeenCalledWith({ where: { id: 'comment-1' } });
  });

  it('DELETE /api/tasks/:id/attachments/:attachmentId - Fshin attachment-in dhe njoftimin e lidhur', async () => {
    vi.mocked(prisma.task.findUnique).mockResolvedValue({
      id: 'task-1',
      title: 'Detyrë me skedar',
      spaceId: 'space-1',
      createdById: 'test-user-id',
      createdBy: { id: 'test-user-id', firstName: 'Test', lastName: 'User' },
      assignedTo: null,
      assignees: [],
    } as never);
    vi.mocked(prisma.space.findUnique).mockResolvedValue({ id: 'space-1', createdById: 'test-user-id' } as never);
    vi.mocked(prisma.attachment.findFirst).mockResolvedValue({
      id: 'attachment-1', taskId: 'task-1', uploadedById: 'test-user-id', filePath: 'uploads/missing-test-file.txt',
    } as never);
    vi.mocked(prisma.attachment.delete).mockResolvedValue({} as never);

    const res = await request(app)
      .delete('/api/tasks/task-1/attachments/attachment-1')
      .set('Cookie', [`token=${mockToken}`]);

    expect(res.status).toBe(200);
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({ where: { resourceType: 'ATTACHMENT', resourceId: 'attachment-1' } });
    expect(prisma.attachment.delete).toHaveBeenCalledWith({ where: { id: 'attachment-1' } });
  });
});
