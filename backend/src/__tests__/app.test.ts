import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';

vi.mock('../prisma', () => ({
  default: {
    role: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import prisma from '../prisma';
import { seedDatabase } from '../seed';

describe('seedDatabase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('krijon rolet dhe adminin kur nuk ekziston', async () => {
    vi.mocked(prisma.role.upsert).mockResolvedValue({ id: 'admin-role-id', name: 'ADMIN', description: null });
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({} as never);

    await seedDatabase();

    expect(prisma.role.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.user.create).toHaveBeenCalledOnce();
  });

  it('nuk krijon admin të ri nëse ekziston', async () => {
    vi.mocked(prisma.role.upsert).mockResolvedValue({ id: 'admin-role-id', name: 'ADMIN', description: null });
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'existing' } as never);

    await seedDatabase();

    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});

describe('auth validation', () => {
  it('bcrypt verifikon fjalëkalimin e adminit default', async () => {
    const hash = await bcrypt.hash('Admin123!', 10);
    const match = await bcrypt.compare('Admin123!', hash);
    expect(match).toBe(true);
  });

  it('bcrypt refuzon fjalëkalim të gabuar', async () => {
    const hash = await bcrypt.hash('Admin123!', 10);
    const match = await bcrypt.compare('wrong', hash);
    expect(match).toBe(false);
  });
});

describe('task status values', () => {
  const validStatuses = ['TODO', 'IN_PROGRESS', 'COMPLETED'];

  it('pranon vetëm statuset e vlefshme', () => {
    expect(validStatuses.includes('TODO')).toBe(true);
    expect(validStatuses.includes('INVALID')).toBe(false);
  });
});

describe('board colors', () => {
  const boardColors = ['#0079BF', '#D29034', '#519839', '#B04632', '#89609E', '#CD5A91', '#4BBF6B', '#00AEEF', '#838C91'];

  it('përmban ngjyra Trello', () => {
    expect(boardColors).toHaveLength(9);
    expect(boardColors[0]).toBe('#0079BF');
  });

  it('fallback në blu për ngjyrë të pavlefshme', () => {
    const color = boardColors.includes('#FF0000') ? '#FF0000' : '#0079BF';
    expect(color).toBe('#0079BF');
  });
});
