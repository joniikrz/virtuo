import fs from 'fs';
import path from 'path';
import { describe, expect, it, vi } from 'vitest';
import { AuthenticateSession } from '../application/auth/authenticate-session';
import { ListTasks } from '../application/tasks/list-tasks';
import { AccessDeniedError } from '../application/shared/errors';

function typescriptFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? typescriptFiles(absolute) : entry.name.endsWith('.ts') ? [absolute] : [];
  });
}

describe('Hexagonal architecture boundaries', () => {
  it('domain dhe application nuk varen nga framework-et ose infrastruktura', () => {
    const sourceRoot = path.resolve(__dirname, '..');
    const coreFiles = [
      ...typescriptFiles(path.join(sourceRoot, 'domain')),
      ...typescriptFiles(path.join(sourceRoot, 'application')),
    ];
    const forbidden = /from ['"](?:express|@prisma\/client|nodemailer|multer|fs|path|crypto)['"]/;
    const violations = coreFiles.filter((file) => forbidden.test(fs.readFileSync(file, 'utf8')));
    expect(violations).toEqual([]);
  });

  it('ListTasks përdor portin dhe respekton ETag pa thirrur listën përsëri', async () => {
    const repository = {
      canViewSpace: vi.fn().mockResolvedValue(true),
      revision: vi.fn().mockResolvedValue({ count: 2, updatedAt: new Date('2026-08-13T10:00:00Z') }),
      list: vi.fn().mockResolvedValue([{ id: 'task-1' }]),
    };
    const useCase = new ListTasks(repository, 500);
    const first = await useCase.execute({ userId: 'user-1', assignedOnly: true });
    const cached = await useCase.execute({ userId: 'user-1', assignedOnly: true, ifNoneMatch: first.etag });

    expect(first.tasks).toEqual([{ id: 'task-1' }]);
    expect(cached.notModified).toBe(true);
    expect(repository.list).toHaveBeenCalledTimes(1);
  });

  it('ListTasks refuzon hapësirën para query-t të task-eve', async () => {
    const repository = {
      canViewSpace: vi.fn().mockResolvedValue(false),
      revision: vi.fn(),
      list: vi.fn(),
    };
    const useCase = new ListTasks(repository, 500);
    await expect(useCase.execute({ userId: 'user-1', spaceId: 'private', assignedOnly: false }))
      .rejects.toBeInstanceOf(AccessDeniedError);
    expect(repository.revision).not.toHaveBeenCalled();
  });

  it('AuthenticateSession nuk ekspozon sessionVersion te adapter-i HTTP', async () => {
    const users = { findById: vi.fn().mockResolvedValue({
      id: 'user-1', email: 'user@example.com', firstName: 'A', lastName: 'B', role: 'USER',
      emailNotifications: true, inAppNotifications: true, hasRecoveryCode: false, sessionVersion: 3,
    }) };
    const tokens = { verify: vi.fn().mockReturnValue({ userId: 'user-1', sessionVersion: 3 }) };
    const result = await new AuthenticateSession(users, tokens).execute('token');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.user).not.toHaveProperty('sessionVersion');
  });
});

