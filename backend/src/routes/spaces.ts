import { Router, Response } from 'express';
import prisma from '../prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /api/spaces
 * Merr të gjitha hapësirat (Spaces) e lejuara për përdoruesin aktual
 */
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const role = req.user?.role;

  if (!userId) {
    return res.status(401).json({ error: 'I paautorizuar' });
  }

  try {
    let spaces;

    if (role === 'ADMIN') {
      // Adminët shohin të gjitha Spaces në sistem
      spaces = await prisma.space.findMany({
        include: {
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          _count: {
            select: { members: true, tasks: true },
          },
        },
        orderBy: { name: 'asc' },
      });
    } else {
      // Përdoruesit shohin:
      // 1. Krijimet e veta
      // 2. Spaces ku janë anëtarë (edhe private)
      // 3. Spaces publike (isPrivate: false)
      spaces = await prisma.space.findMany({
        where: {
          OR: [
            { createdById: userId },
            {
              members: {
                some: {
                  userId: userId,
                },
              },
            },
          ],
        },
        include: {
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          _count: {
            select: { members: true, tasks: true },
          },
        },
        orderBy: { name: 'asc' },
      });
    }

    return res.json(spaces);
  } catch (error) {
    console.error('Fetch spaces error:', error);
    return res.status(500).json({ error: 'Ndodhi një gabim gjatë marrjes së hapësirave të punës' });
  }
});

/**
 * POST /api/spaces
 * Krijimi i një Space të ri me Transaction
 */
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { name, color, memberIds } = req.body;
  const creatorId = req.user?.id;

  if (!name) {
    return res.status(400).json({ error: 'Emri i hapësirës është i detyrueshëm' });
  }

  if (!creatorId) {
    return res.status(401).json({ error: 'I paautorizuar' });
  }

  const boardColors = ['#0079BF', '#D29034', '#519839', '#B04632', '#89609E', '#CD5A91', '#4BBF6B', '#00AEEF', '#838C91'];
  const spaceColor = boardColors.includes(color) ? color : '#0079BF';
  const requestedMemberIds = Array.isArray(memberIds)
    ? [...new Set(memberIds.filter((id): id is string => typeof id === 'string' && id.length > 0))]
    : [];

  try {
    if (requestedMemberIds.length) {
      const foundUsers = await prisma.user.count({ where: { id: { in: requestedMemberIds } } });
      if (foundUsers !== requestedMemberIds.length) {
        return res.status(400).json({ error: 'NjÃ« ose mÃ« shumÃ« pÃ«rdorues tÃ« zgjedhur nuk ekzistojnÃ«' });
      }
    }
    const result = await prisma.$transaction(async (tx) => {
      const newSpace = await tx.space.create({
        data: {
          name,
          color: spaceColor,
          isPrivate: true,
          createdById: creatorId,
        },
      });

      await tx.spaceMember.createMany({
        data: [...new Set([creatorId, ...requestedMemberIds])].map((userId) => ({ spaceId: newSpace.id, userId })),
      });

      return tx.space.findUnique({
        where: { id: newSpace.id },
        include: { createdBy: { select: { id: true, firstName: true, lastName: true } }, _count: { select: { members: true, tasks: true } } },
      });
    });

    return res.status(201).json(result);
  } catch (error) {
    console.error('Create space error:', error);
    return res.status(500).json({ error: 'Ndodhi një gabim gjatë krijimit të hapësirës së punës' });
  }
});

/**
 * POST /api/spaces/:id/members
 * Fton një përdorues në një Space
 */
router.post('/:id/members', authenticateToken, async (req: AuthRequest, res: Response) => {
  const spaceId = req.params.id;
  const { userId } = req.body;
  const currentUserId = req.user?.id;
  const role = req.user?.role;

  if (!userId) {
    return res.status(400).json({ error: 'ID e përdoruesit është e detyrueshme' });
  }

  try {
    const space = await prisma.space.findUnique({ where: { id: spaceId } });

    if (!space) {
      return res.status(404).json({ error: 'Hapësira e punës nuk u gjet' });
    }

    if (role !== 'ADMIN' && space.createdById !== currentUserId) {
      return res.status(403).json({ error: 'Vetëm krijuesi i hapësirës mund të menaxhojë anëtarët' });
    }

    const userToInvite = await prisma.user.findUnique({ where: { id: userId } });

    if (!userToInvite) {
      return res.status(404).json({ error: 'Përdoruesi që dëshironi të ftoni nuk u gjet' });
    }

    const existingMember = await prisma.spaceMember.findUnique({
      where: {
        spaceId_userId: {
          spaceId,
          userId,
        },
      },
    });

    if (existingMember) {
      return res.status(400).json({ error: 'Përdoruesi është tashmë anëtar i kësaj hapësire' });
    }

    const member = await prisma.spaceMember.create({
      data: {
        spaceId,
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return res.status(201).json({ message: 'Anëtari u shtua me sukses', member });
  } catch (error) {
    console.error('Add member error:', error);
    return res.status(500).json({ error: 'Ndodhi një gabim gjatë ftesës së anëtarit' });
  }
});

/**
 * GET /api/spaces/:id/members
 * Merr të gjithë anëtarët e një Space
 */
router.get('/:id/members', authenticateToken, async (req: AuthRequest, res: Response) => {
  const spaceId = req.params.id;
  const userId = req.user?.id;
  const role = req.user?.role;

  if (!userId) {
    return res.status(401).json({ error: 'I paautorizuar' });
  }

  try {
    const space = await prisma.space.findUnique({ where: { id: spaceId } });

    if (!space) {
      return res.status(404).json({ error: 'Hapësira e punës nuk u gjet' });
    }

    if (role !== 'ADMIN' && space.createdById !== userId) {
      const isMember = await prisma.spaceMember.findUnique({
        where: {
          spaceId_userId: {
            spaceId,
            userId,
          },
        },
      });

      if (!isMember) {
        return res.status(403).json({ error: 'Nuk jeni anëtar i kësaj hapësire' });
      }
    }

    const members = await prisma.spaceMember.findMany({
      where: { spaceId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { user: { firstName: 'asc' } },
    });

    return res.json(
      members.map((m) => ({
        id: m.user.id,
        email: m.user.email,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
        role: m.user.role.name,
        joinedAt: m.joinedAt,
      }))
    );
  } catch (error) {
    console.error('Fetch space members error:', error);
    return res.status(500).json({ error: 'Ndodhi një gabim gjatë marrjes së anëtarëve' });
  }
});

/** Heq një anëtar. Krijuesi i hapësirës mbetet gjithmonë anëtar. */
router.delete('/:id/members/:userId', authenticateToken, async (req: AuthRequest, res: Response) => {
  const currentUserId = req.user?.id;
  const role = req.user?.role;
  const { id: spaceId, userId } = req.params;
  if (!currentUserId) return res.status(401).json({ error: 'I paautorizuar' });
  try {
    const space = await prisma.space.findUnique({ where: { id: spaceId } });
    if (!space) return res.status(404).json({ error: 'Hapësira e punës nuk u gjet' });
    if (role !== 'ADMIN' && space.createdById !== currentUserId) return res.status(403).json({ error: 'Nuk keni leje të hiqni anëtarë' });
    if (userId === space.createdById) return res.status(400).json({ error: 'Krijuesi i hapësirës nuk mund të hiqet' });
    await prisma.spaceMember.delete({ where: { spaceId_userId: { spaceId, userId } } });
    return res.json({ message: 'Anëtari u hoq nga hapësira' });
  } catch (error) {
    console.error('Remove member error:', error);
    return res.status(404).json({ error: 'Anëtari nuk u gjet në këtë hapësirë' });
  }
});

/**
 * PUT /api/spaces/:id
 * Përditëson një space - Krijuesi ose Admini
 */
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const spaceId = req.params.id;
  const { name, color } = req.body;
  const userId = req.user?.id;
  const role = req.user?.role;

  try {
    const space = await prisma.space.findUnique({ where: { id: spaceId } });
    if (!space) {
      return res.status(404).json({ error: 'Hapësira e punës nuk u gjet' });
    }

    if (role !== 'ADMIN' && space.createdById !== userId) {
      return res.status(403).json({ error: 'Nuk keni të drejtë të modifikoni këtë hapësirë' });
    }

    const updated = await prisma.space.update({
      where: { id: spaceId },
      data: {
        ...(name && { name }),
        isPrivate: true,
        ...(color && { color }),
      },
    });

    return res.json(updated);
  } catch (error) {
    console.error('Update space error:', error);
    return res.status(500).json({ error: 'Ndodhi një gabim gjatë përditësimit të hapësirës' });
  }
});

/**
 * DELETE /api/spaces/:id
 * Fshin një space - vetëm krijuesi
 */
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const spaceId = req.params.id;
  const userId = req.user?.id;

  try {
    const space = await prisma.space.findUnique({ where: { id: spaceId } });
    if (!space) {
      return res.status(404).json({ error: 'Hapësira e punës nuk u gjet' });
    }

    if (space.createdById !== userId) {
      return res.status(403).json({ error: 'Nuk keni të drejtë të fshini këtë hapësirë' });
    }

    await prisma.space.delete({ where: { id: spaceId } });
    return res.json({ message: 'Hapësira u fshi me sukses' });
  } catch (error) {
    console.error('Delete space error:', error);
    return res.status(500).json({ error: 'Ndodhi një gabim gjatë fshirjes së hapësirës' });
  }
});

export default router;
