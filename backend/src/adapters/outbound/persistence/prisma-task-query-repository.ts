import { Prisma, PrismaClient } from '@prisma/client';
import { TaskListRequest, TaskQueryRepositoryPort } from '../../../application/tasks/ports';

const taskListInclude = {
  space: { select: { id: true, name: true, color: true } },
  assignedTo: { select: { id: true, email: true, firstName: true, lastName: true } },
  assignees: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  tags: { include: { tag: true } },
  _count: { select: { comments: true, attachments: true } },
} as const;

function accessFilter(request: TaskListRequest): Prisma.TaskWhereInput {
  const visibility = request.assignedOnly
    ? { OR: [{ assignedToId: request.userId }, { assignees: { some: { userId: request.userId } } }] }
    : { OR: [
      { createdById: request.userId },
      { assignedToId: request.userId },
      { assignees: { some: { userId: request.userId } } },
    ] };
  return request.spaceId ? { ...visibility, spaceId: request.spaceId } : visibility;
}

export class PrismaTaskQueryRepository implements TaskQueryRepositoryPort {
  constructor(private readonly db: PrismaClient) {}

  async canViewSpace(spaceId: string, userId: string): Promise<boolean> {
    const space = await this.db.space.findUnique({ where: { id: spaceId }, select: { createdById: true } });
    if (!space) return false;
    if (space.createdById === userId) return true;
    return Boolean(await this.db.spaceMember.findUnique({ where: { spaceId_userId: { spaceId, userId } } }));
  }

  async revision(request: TaskListRequest) {
    const revision = await this.db.task.aggregate({
      where: accessFilter(request),
      _count: { id: true },
      _max: { updatedAt: true },
    });
    return { count: revision._count.id, updatedAt: revision._max.updatedAt };
  }

  async list(request: TaskListRequest) {
    return this.db.task.findMany({
      where: accessFilter(request),
      include: taskListInclude,
      orderBy: { createdAt: 'desc' },
      take: request.limit,
    });
  }
}

