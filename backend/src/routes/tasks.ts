import { Router, Response } from 'express';
import prisma from '../prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * Helper funksion për të kontrolluar nëse përdoruesi ka qasje në një Space të caktuar
 */
async function hasSpaceAccess(spaceId: string, userId: string, role: string): Promise<boolean> {
  if (role === 'ADMIN') return true;

  const space = await prisma.space.findUnique({
    where: { id: spaceId },
  });

  if (!space) return false;
  if (space.createdById === userId) return true;

  const member = await prisma.spaceMember.findUnique({
    where: {
      spaceId_userId: { spaceId, userId },
    },
  });

  return !!member || !space.isPrivate;
}

/**
 * GET /api/tasks?spaceId=xyz
 * Merr të gjitha detyrat për një Space (ose detyrat personale)
 */
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const role = req.user?.role || 'USER';
  const spaceId = req.query.spaceId as string;

  if (!userId) {
    return res.status(401).json({ error: 'I paautorizuar' });
  }

  try {
    if (spaceId) {
      const canAccess = await hasSpaceAccess(spaceId, userId, role);
      if (!canAccess) {
        return res.status(403).json({ error: 'Nuk keni leje për këtë hapësirë punëtore' });
      }

      const tasks = await prisma.task.findMany({
        where: { spaceId },
        include: {
          assignedTo: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          createdBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return res.json(tasks);
    }

    // Nëse nuk filtrohet sipas spaceId, kthen detyrat e caktuara për këtë përdorues
    const myTasks = await prisma.task.findMany({
      where: { assignedToId: userId },
      include: {
        space: { select: { id: true, name: true, color: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(myTasks);
  } catch (error) {
    console.error('Fetch tasks error:', error);
    return res.status(500).json({ error: 'Ndodhi një gabim gjatë marrjes së detyrave' });
  }
});

/**
 * POST /api/tasks
 * Krijimi i një detyre të re
 */
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { title, description, status, priority, dueDate, spaceId, assignedToId } = req.body;
  const userId = req.user?.id;
  const role = req.user?.role || 'USER';

  if (!title || !spaceId) {
    return res.status(400).json({ error: 'Titulli dhe ID e hapësirës janë të detyrueshme' });
  }

  if (!userId) {
    return res.status(401).json({ error: 'I paautorizuar' });
  }

  try {
    const canAccess = await hasSpaceAccess(spaceId, userId, role);
    if (!canAccess) {
      return res.status(403).json({ error: 'Nuk keni leje të krijoni detyra në këtë hapësirë' });
    }

    const newTask = await prisma.task.create({
      data: {
        title,
        description,
        status: status || 'TODO',
        priority: priority || 'MEDIUM',
        dueDate: dueDate ? new Date(dueDate) : null,
        spaceId,
        createdById: userId,
        assignedToId: assignedToId || null,
      },
      include: {
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    return res.status(201).json(newTask);
  } catch (error) {
    console.error('Create task error:', error);
    return res.status(500).json({ error: 'Ndodhi një gabim gjatë krijimit të detyrës' });
  }
});

/**
 * PUT /api/tasks/:id
 * Përditësimi i statusit ose të dhënave të detyrës
 */
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const taskId = req.params.id;
  const userId = req.user?.id;
  const role = req.user?.role || 'USER';
  const { title, description, status, priority, dueDate, assignedToId } = req.body;

  if (!userId) {
    return res.status(401).json({ error: 'I paautorizuar' });
  }

  try {
    const existingTask = await prisma.task.findUnique({ where: { id: taskId } });
    if (!existingTask) {
      return res.status(404).json({ error: 'Detyra nuk u gjet' });
    }

    const canAccess = await hasSpaceAccess(existingTask.spaceId, userId, role);
    if (!canAccess) {
      return res.status(403).json({ error: 'Nuk keni leje të modifikoni këtë detyrë' });
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(status && { status }),
        ...(priority && { priority }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(assignedToId !== undefined && { assignedToId: assignedToId || null }),
      },
      include: {
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    return res.json(updatedTask);
  } catch (error) {
    console.error('Update task error:', error);
    return res.status(500).json({ error: 'Ndodhi një gabim gjatë përditësimit të detyrës' });
  }
});

/**
 * DELETE /api/tasks/:id
 * Fshirja e një detyre
 */
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const taskId = req.params.id;
  const userId = req.user?.id;
  const role = req.user?.role || 'USER';

  if (!userId) {
    return res.status(401).json({ error: 'I paautorizuar' });
  }

  try {
    const existingTask = await prisma.task.findUnique({ where: { id: taskId } });
    if (!existingTask) {
      return res.status(404).json({ error: 'Detyra nuk u gjet' });
    }

    // Lejohet fshirja nga Admini, krijuesi i detyrës, apo krijuesi i Space
    if (role !== 'ADMIN' && existingTask.createdById !== userId) {
      const space = await prisma.space.findUnique({ where: { id: existingTask.spaceId } });
      if (!space || space.createdById !== userId) {
        return res.status(403).json({ error: 'Nuk keni të drejtë të fshini këtë detyrë' });
      }
    }

    await prisma.task.delete({ where: { id: taskId } });
    return res.json({ message: 'Detyra u fshi me sukses' });
  } catch (error) {
    console.error('Delete task error:', error);
    return res.status(500).json({ error: 'Ndodhi një gabim gjatë fshirjes së detyrës' });
  }
});

export default router;