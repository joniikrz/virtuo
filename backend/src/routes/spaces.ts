import { Router, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import prisma from '../prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
const uploadDirectory = path.resolve(process.env.UPLOAD_DIR || 'uploads');
const spaceColors = new Set(['#0079BF', '#D29034', '#519839', '#B04632', '#89609E', '#CD5A91', '#4BBF6B', '#00AEEF', '#838C91']);
const maxSpaceMembers = 250;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase().slice(0, 254) : '';
}

async function removeStoredFiles(filePaths: string[]) {
  await Promise.all(filePaths.map(async (filePath) => {
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(`${uploadDirectory}${path.sep}`)) return;
    await fs.unlink(resolvedPath).catch(() => undefined);
  }));
}

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
      // Edhe administratori duhet të jetë krijues ose anëtar i hapësirës private.
      spaces = await prisma.space.findMany({
        where: {
          OR: [
            { createdById: userId },
            { members: { some: { userId } } },
          ],
        },
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
    return res.status(500).json({ error: 'An error occurred while retrieving workspaces' });
  }
});

/**
 * POST /api/spaces
 * Krijimi i një Space të ri me Transaction
 */
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const { color } = req.body;
  const creatorId = req.user?.id;

  if (!name || name.length > 100) {
    return res.status(400).json({ error: 'The workspace name must contain between 1 and 100 characters' });
  }

  if (!creatorId) {
    return res.status(401).json({ error: 'I paautorizuar' });
  }

  const spaceColor = typeof color === 'string' && spaceColors.has(color) ? color : '#0079BF';

  try {
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
        data: [{ spaceId: newSpace.id, userId: creatorId }],
      });

      return tx.space.findUnique({
        where: { id: newSpace.id },
        include: { createdBy: { select: { id: true, firstName: true, lastName: true } }, _count: { select: { members: true, tasks: true } } },
      });
    });

    return res.status(201).json(result);
  } catch (error) {
    console.error('Create space error:', error);
    return res.status(500).json({ error: 'An error occurred while creating the workspace' });
  }
});

/**
 * POST /api/spaces/:id/invitations
 * Pronari dërgon një ftesë te një përdorues i regjistruar, sipas email-it.
 */
router.post('/:id/invitations', authenticateToken, async (req: AuthRequest, res: Response) => {
  const spaceId = req.params.id;
  const email = normalizeEmail(req.body.email);
  const currentUserId = req.user?.id;
  if (!currentUserId) return res.status(401).json({ error: 'I paautorizuar' });
  if (!EMAIL_REGEX.test(email)) return res.status(400).json({ error: 'Enter a valid email address' });

  try {
    const space = await prisma.space.findUnique({ where: { id: spaceId } });
    if (!space) return res.status(404).json({ error: 'Workspace not found' });
    if (space.createdById !== currentUserId) {
      return res.status(403).json({ error: 'Only the workspace owner can invite members' });
    }

    const userToInvite = await prisma.user.findUnique({ where: { email } });
    if (!userToInvite) return res.status(404).json({ error: 'No registered user exists with this email address' });
    if (userToInvite.id === currentUserId) return res.status(400).json({ error: 'You are already the owner of this workspace' });

    const [existingMember, existingInvite, memberCount, pendingInviteCount] = await Promise.all([
      prisma.spaceMember.findUnique({ where: { spaceId_userId: { spaceId, userId: userToInvite.id } } }),
      prisma.spaceInvite.findUnique({ where: { spaceId_invitedUserId: { spaceId, invitedUserId: userToInvite.id } } }),
      prisma.spaceMember.count({ where: { spaceId } }),
      prisma.spaceInvite.count({ where: { spaceId, status: 'PENDING' } }),
    ]);
    if (existingMember) return res.status(409).json({ error: 'This user is already a workspace member' });
    if (existingInvite?.status === 'PENDING') return res.status(409).json({ error: 'This user already has a pending invitation' });
    if (memberCount + pendingInviteCount >= maxSpaceMembers) {
      return res.status(409).json({ error: `A workspace can have at most ${maxSpaceMembers} members` });
    }

    const invite = await prisma.$transaction(async (tx) => {
      const savedInvite = await tx.spaceInvite.upsert({
        where: { spaceId_invitedUserId: { spaceId, invitedUserId: userToInvite.id } },
        create: { spaceId, invitedUserId: userToInvite.id, invitedById: currentUserId },
        update: { status: 'PENDING', invitedById: currentUserId, respondedAt: null, createdAt: new Date() },
      });
      await tx.notification.deleteMany({ where: { spaceInviteId: savedInvite.id } });
      await tx.notification.create({
        data: {
          userId: userToInvite.id,
          type: 'SPACE_INVITE',
          title: 'Workspace invitation',
          message: `${req.user?.firstName || 'A user'} ${req.user?.lastName || ''} invited you to the workspace: ${space.name}`.replace(/\s+/g, ' ').trim(),
          resourceType: 'SPACE_INVITE',
          resourceId: savedInvite.id,
          spaceInviteId: savedInvite.id,
        },
      });
      return savedInvite;
    });

    return res.status(201).json({
      message: `Invitation sent to ${userToInvite.email}`,
      invite: { id: invite.id, email: userToInvite.email, status: invite.status },
    });
  } catch (error) {
    console.error('Invite member error:', error);
    return res.status(500).json({ error: 'An error occurred while sending the invitation' });
  }
});

router.post('/invitations/:inviteId/accept', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'I paautorizuar' });

  try {
    const invite = await prisma.spaceInvite.findUnique({ where: { id: req.params.inviteId }, include: { space: true } });
    if (!invite || invite.invitedUserId !== userId || invite.status !== 'PENDING') {
      return res.status(404).json({ error: 'The invitation was not found or is no longer active' });
    }

    await prisma.$transaction(async (tx) => {
      const existingMember = await tx.spaceMember.findUnique({ where: { spaceId_userId: { spaceId: invite.spaceId, userId } } });
      if (!existingMember) {
        const memberCount = await tx.spaceMember.count({ where: { spaceId: invite.spaceId } });
        if (memberCount >= maxSpaceMembers) throw new Error('SPACE_FULL');
      }
      const claimed = await tx.spaceInvite.updateMany({
        where: { id: invite.id, invitedUserId: userId, status: 'PENDING' },
        data: { status: 'ACCEPTED', respondedAt: new Date() },
      });
      if (claimed.count !== 1) throw new Error('INVITE_NOT_PENDING');
      await tx.spaceMember.upsert({
        where: { spaceId_userId: { spaceId: invite.spaceId, userId } },
        create: { spaceId: invite.spaceId, userId },
        update: {},
      });
      await tx.notification.deleteMany({ where: { spaceInviteId: invite.id } });
      await tx.notification.create({
        data: {
          userId: invite.invitedById,
          type: 'SPACE_INVITE_ACCEPTED',
          title: 'Invitation accepted',
          message: `${req.user?.firstName || 'The user'} ${req.user?.lastName || ''} accepted the invitation to: ${invite.space.name}`.replace(/\s+/g, ' ').trim(),
          resourceType: 'SPACE',
          resourceId: invite.spaceId,
        },
      });
    });

    return res.json({ message: `You joined the workspace ${invite.space.name}`, spaceId: invite.spaceId });
  } catch (error) {
    if (error instanceof Error && error.message === 'SPACE_FULL') return res.status(409).json({ error: 'The workspace has reached its member limit' });
    if (error instanceof Error && error.message === 'INVITE_NOT_PENDING') return res.status(409).json({ error: 'This invitation has already been processed' });
    console.error('Accept space invite error:', error);
    return res.status(500).json({ error: 'The invitation could not be accepted' });
  }
});

router.post('/invitations/:inviteId/reject', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'I paautorizuar' });

  try {
    const invite = await prisma.spaceInvite.findUnique({ where: { id: req.params.inviteId }, include: { space: true } });
    if (!invite || invite.invitedUserId !== userId || invite.status !== 'PENDING') {
      return res.status(404).json({ error: 'The invitation was not found or is no longer active' });
    }
    const rejected = await prisma.$transaction(async (tx) => {
      const updated = await tx.spaceInvite.updateMany({
        where: { id: invite.id, invitedUserId: userId, status: 'PENDING' },
        data: { status: 'REJECTED', respondedAt: new Date() },
      });
      if (updated.count !== 1) return false;
      await tx.notification.deleteMany({ where: { spaceInviteId: invite.id } });
      await tx.notification.create({
        data: {
          userId: invite.invitedById,
          type: 'SPACE_INVITE_REJECTED',
          title: 'Invitation declined',
          message: `${req.user?.firstName || 'The user'} ${req.user?.lastName || ''} declined the invitation to: ${invite.space.name}`.replace(/\s+/g, ' ').trim(),
          resourceType: 'SPACE',
          resourceId: invite.spaceId,
        },
      });
      return true;
    });
    if (!rejected) return res.status(409).json({ error: 'This invitation has already been processed' });
    return res.json({ message: 'Invitation declined' });
  } catch (error) {
    console.error('Reject space invite error:', error);
    return res.status(500).json({ error: 'The invitation could not be declined' });
  }
});

/**
 * GET /api/spaces/:id/members
 * Merr të gjithë anëtarët e një Space
 */
router.get('/:id/members', authenticateToken, async (req: AuthRequest, res: Response) => {
  const spaceId = req.params.id;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'I paautorizuar' });
  }

  try {
    const space = await prisma.space.findUnique({ where: { id: spaceId } });

    if (!space) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    if (space.createdById !== userId) {
      const isMember = await prisma.spaceMember.findUnique({
        where: {
          spaceId_userId: {
            spaceId,
            userId,
          },
        },
      });

      if (!isMember) {
        return res.status(403).json({ error: 'You are not a member of this workspace' });
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
    return res.status(500).json({ error: 'An error occurred while retrieving members' });
  }
});

/** Heq një anëtar. Krijuesi i hapësirës mbetet gjithmonë anëtar. */
router.delete('/:id/members/:userId', authenticateToken, async (req: AuthRequest, res: Response) => {
  const currentUserId = req.user?.id;
  const { id: spaceId, userId } = req.params;
  if (!currentUserId) return res.status(401).json({ error: 'I paautorizuar' });
  try {
    const space = await prisma.space.findUnique({ where: { id: spaceId } });
    if (!space) return res.status(404).json({ error: 'Workspace not found' });
    if (space.createdById !== currentUserId) return res.status(403).json({ error: 'You do not have permission to remove members' });
    if (userId === space.createdById) return res.status(400).json({ error: 'The workspace owner cannot be removed' });
    await prisma.spaceMember.delete({ where: { spaceId_userId: { spaceId, userId } } });
    return res.json({ message: 'Member removed from the workspace' });
  } catch (error) {
    console.error('Remove member error:', error);
    return res.status(404).json({ error: 'Member not found in this workspace' });
  }
});

/**
 * PUT /api/spaces/:id
 * Përditëson një space - Krijuesi ose Admini
 */
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const spaceId = req.params.id;
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : undefined;
  const { color } = req.body;
  const userId = req.user?.id;
  if (name !== undefined && (!name || name.length > 100)) {
    return res.status(400).json({ error: 'The workspace name must contain between 1 and 100 characters' });
  }
  if (color !== undefined && (typeof color !== 'string' || !spaceColors.has(color))) {
    return res.status(400).json({ error: 'The workspace colour is invalid' });
  }
  try {
    const space = await prisma.space.findUnique({ where: { id: spaceId } });
    if (!space) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    if (space.createdById !== userId) {
      return res.status(403).json({ error: 'You do not have permission to edit this workspace' });
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
    return res.status(500).json({ error: 'An error occurred while updating the workspace' });
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
      return res.status(404).json({ error: 'Workspace not found' });
    }

    if (space.createdById !== userId) {
      return res.status(403).json({ error: 'You do not have permission to delete this workspace' });
    }

    const attachments = await prisma.attachment.findMany({
      where: { task: { spaceId } },
      select: { filePath: true },
    });
    const taskIds = await prisma.task.findMany({ where: { spaceId }, select: { id: true } });
    const deleteSpace = prisma.space.delete({ where: { id: spaceId } });
    if (taskIds.length > 0) {
      await prisma.$transaction([
        prisma.notification.deleteMany({ where: { taskId: { in: taskIds.map((task) => task.id) } } }),
        deleteSpace,
      ]);
    } else {
      await deleteSpace;
    }
    await removeStoredFiles(attachments.map((attachment) => attachment.filePath));
    return res.json({ message: 'Workspace deleted successfully' });
  } catch (error) {
    console.error('Delete space error:', error);
    return res.status(500).json({ error: 'An error occurred while deleting the workspace' });
  }
});

export default router;
