import prisma from './prisma';
import { AuthenticateSession } from './application/auth/authenticate-session';
import { ListTasks } from './application/tasks/list-tasks';
import { PrismaSessionUserRepository } from './adapters/outbound/persistence/prisma-session-user-repository';
import { PrismaTaskQueryRepository } from './adapters/outbound/persistence/prisma-task-query-repository';
import { verifyToken } from './security';

const taskListLimit = Math.max(50, Math.min(Number(process.env.TASK_LIST_LIMIT) || 500, 2000));

// Ky është vendi i vetëm ku application core lidhet me adapters konkretë.
export const application = {
  authenticateSession: new AuthenticateSession(
    new PrismaSessionUserRepository(prisma),
    { verify: (token) => {
      const payload = verifyToken(token);
      return {
        userId: typeof payload.userId === 'string' ? payload.userId : undefined,
        sessionVersion: typeof payload.sessionVersion === 'number' ? payload.sessionVersion : undefined,
      };
    } },
  ),
  listTasks: new ListTasks(new PrismaTaskQueryRepository(prisma), taskListLimit),
};
