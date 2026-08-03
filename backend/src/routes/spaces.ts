import { Router, Response } from 'express';
import prisma from '../prisma';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';

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
      // Adminët (Shefat) shohin të gjitha Spaces në sistem
      spaces = await prisma.space.findMany({
        include: {
          createdBy: {
            select: {
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
      // Punonjësit (USER) shohin VETËM hapësirat që NUK janë private dhe ku ata janë anëtarë
      spaces = await prisma.space.findMany({
        where: {
          isPrivate: false,
          members: {
            some: {
              userId: userId,
            },
          },
        },
        include: {
          createdBy: {
            select: {
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
 * Krijimi i një Space të ri - Vetëm për Admin/Shefa
 */
router.post('/', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const { name, description, isPrivate } = req.body;
  const creatorId = req.user?.id;

  if (!name) {
    return res.status(400).json({ error: 'Emri i hapësirës është i detyrueshëm' });
  }

  if (!creatorId) {
    return res.status(401).json({ error: 'I paautorizuar' });
  }

  try {
    const space = await prisma.space.create({
      data: {
        name,
        description,
        isPrivate: isPrivate === true || isPrivate === 'true',
        createdById: creatorId,
      },
    });

    // Shto krijuesin (Admin-in) automatikisht si anëtar të parë të këtij Space
    await prisma.spaceMember.create({
      data: {
        spaceId: space.id,
        userId: creatorId,
      },
    });

    return res.status(201).json(space);
  } catch (error) {
    console.error('Create space error:', error);
    return res.status(500).json({ error: 'Ndodhi një gabim gjatë krijimit të hapësirës së punës' });
  }
});

/**
 * POST /api/spaces/:id/members
 * Fton një përdorues në një Space - Vetëm për Admin/Shefa
 */
router.post('/:id/members', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  const spaceId = req.params.id;
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'ID e përdoruesit është e detyrueshme' });
  }

  try {
    // Kontrollo nëse ekziston Space
    const space = await prisma.space.findUnique({
      where: { id: spaceId },
    });

    if (!space) {
      return res.status(404).json({ error: 'Hapësira e punës nuk u gjet' });
    }

    // Kontrollo përdoruesin që do të ftohet
    const userToInvite = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!userToInvite) {
      return res.status(404).json({ error: 'Përdoruesi që dëshironi të ftoni nuk u gjet' });
    }

    // Nëse Space është privat (Executive Space), mos lejo punonjësit e thjeshtë (USER) të ftohen
    if (space.isPrivate && userToInvite.role.name === 'USER') {
      return res.status(400).json({
        error: 'Nuk mund të shtoni një punonjës të thjeshtë në një Hapësirë Ekzekutive Private',
      });
    }

    // Kontrollo nëse është tashmë anëtar
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
 * Merr të gjithë anëtarët e një Space të caktuar
 */
router.get('/:id/members', authenticateToken, async (req: AuthRequest, res: Response) => {
  const spaceId = req.params.id;
  const userId = req.user?.id;
  const role = req.user?.role;

  if (!userId) {
    return res.status(401).json({ error: 'I paautorizuar' });
  }

  try {
    // Kontrollo nëse hapësira ekziston dhe nëse përdoruesi ka qasje ta shohë
    const space = await prisma.space.findUnique({
      where: { id: spaceId },
    });

    if (!space) {
      return res.status(404).json({ error: 'Hapësira e punës nuk u gjet' });
    }

    // Nëse përdoruesi nuk është admin dhe është hapësirë private, blloko qasjen
    if (role !== 'ADMIN' && space.isPrivate) {
      return res.status(403).json({ error: 'Nuk keni qasje në këtë hapësirë private' });
    }

    // Për punonjësit jo-admin, kontrolloni nëse janë anëtarë të këtij Space
    if (role !== 'ADMIN') {
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

    return res.json(members.map((m) => ({
      id: m.user.id,
      email: m.user.email,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      role: m.user.role.name,
      joinedAt: m.joinedAt,
    })));
  } catch (error) {
    console.error('Fetch space members error:', error);
    return res.status(500).json({ error: 'Ndodhi një gabim gjatë marrjes së anëtarëve' });
  }
});

export default router;
