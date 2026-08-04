import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import prisma from '../prisma';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { sendTaskAssignedEmail, sendTaskCompletedEmail } from '../services/email';

const router = Router();

// Konfigurimi i dosjes së ngarkimeve lokale
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Konfigurimi i Multer për ruajtjen e skedarëve
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Kufizimi 10MB për skedar
});

/**
 * GET /api/spaces/:spaceId/tasks
 * Merr detyrat e një Space të caktuar me rregulla të rrepta privatësie
 */
router.get('/spaces/:spaceId/tasks', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  const { spaceId } = req.params;
  const userId = req.user?.id;
  const role = req.user?.role;

  if (!userId) {
    res.status(401).json({ error: 'I paautorizuar' });
    return;
  }

  try {
    const space = await prisma.space.findUnique({
      where: { id: spaceId },
    });

    if (!space) {
      res.status(404).json({ error: 'Hapësira e punës nuk u gjet' });
      return;
    }

    if (role !== 'ADMIN') {
      if (space.isPrivate) {
        res.status(403).json({ error: 'Nuk keni qasje në këtë hapësirë private' });
        return;
      }

      const isMember = await prisma.spaceMember.findUnique({
        where: { spaceId_userId: { spaceId, userId } },
      });

      if (!isMember) {
        res.status(403).json({ error: 'Nuk jeni anëtar i kësaj hapësire' });
        return;
      }
    }

    let whereClause: any = { spaceId };
    
    if (req.query.status) whereClause.status = req.query.status as string;
    if (req.query.priority) whereClause.priority = req.query.priority as string;
    if (req.query.assigneeId) whereClause.assignedToId = req.query.assigneeId as string;
    if (req.query.tagId) {
      whereClause.tags = { some: { tagId: req.query.tagId as string } };
    }
    if (req.query.search) {
      whereClause.OR = [
        { title: { contains: req.query.search as string, mode: 'insensitive' } },
        { description: { contains: req.query.search as string, mode: 'insensitive' } },
      ];
    }

    if (role !== 'ADMIN') {
      whereClause.AND = [
        ...(whereClause.AND || []),
        {
          OR: [
            { visibleToAll: true },
            { assignedToId: userId },
            { visibility: { some: { userId } } }
          ]
        }
      ];
    }

    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        assignedTo: { select: { id: true, email: true, firstName: true, lastName: true } },
        createdBy: { select: { firstName: true, lastName: true } },
        attachments: { select: { id: true, fileName: true, fileSize: true, mimeType: true, uploadedAt: true } },
        tags: { include: { tag: true } },
        _count: { select: { comments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(tasks);
  } catch (error) {
    console.error('Fetch tasks error:', error);
    res.status(500).json({ error: 'Ndodhi një gabim gjatë marrjes së detyrave' });
  }
});

/**
 * POST /api/spaces/:spaceId/tasks
 * Krijon një detyrë të re - Për anëtarët e kësaj hapësire
 */
router.post('/spaces/:spaceId/tasks', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  const { spaceId } = req.params;
  const { title, description, deadline, assignedToId, priority, visibleToAll, visibleToUserIds } = req.body;
  const creatorId = req.user?.id;
  const role = req.user?.role;

  if (!title || !deadline) {
    res.status(400).json({ error: 'Titulli dhe Afati i fundit (Deadline) janë të detyrueshme' });
    return;
  }

  if (title.length > 200) {
    res.status(400).json({ error: 'Titulli nuk mund të jetë më i gjatë se 200 karaktere' });
    return;
  }

  if (description && description.length > 5000) {
    res.status(400).json({ error: 'Përshkrimi nuk mund të jetë më i gjatë se 5000 karaktere' });
    return;
  }

  if (!creatorId) {
    res.status(401).json({ error: 'I paautorizuar' });
    return;
  }

  try {
    const space = await prisma.space.findUnique({
      where: { id: spaceId },
    });

    if (!space) {
      res.status(404).json({ error: 'Hapësira e punës nuk u gjet' });
      return;
    }

    // Kontrollo nëse përdoruesi ka qasje në këtë Space
    if (role !== 'ADMIN' && space.createdById !== creatorId) {
      const isMember = await prisma.spaceMember.findUnique({
        where: {
          spaceId_userId: {
            spaceId,
            userId: creatorId,
          },
        },
      });

      if (!isMember) {
        res.status(403).json({ error: 'Nuk keni leje të krijoni detyra në këtë hapësirë' });
        return;
      }
    }

    let assignedUser = null;
    if (assignedToId) {
      assignedUser = await prisma.user.findUnique({
        where: { id: assignedToId },
      });

      if (!assignedUser) {
        res.status(400).json({ error: 'Punonjësi i caktuar nuk ekziston' });
        return;
      }

      const isMember = await prisma.spaceMember.findUnique({
        where: { spaceId_userId: { spaceId, userId: assignedToId } },
      });

      // Nëse ai nuk është anëtar, e shtojmë automatikisht te spaceMembers
      if (!isMember) {
        await prisma.spaceMember.create({
          data: { spaceId, userId: assignedToId },
        });
      }
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        deadline: new Date(deadline),
        spaceId,
        assignedToId: assignedToId || null,
        createdById: creatorId,
        status: 'TODO',
        priority: priority || 'NORMAL',
        visibleToAll: visibleToAll !== undefined ? visibleToAll : true,
        visibility: visibleToAll === false && Array.isArray(visibleToUserIds) ? {
          create: visibleToUserIds.map((uId: string) => ({ userId: uId }))
        } : undefined
      },
      include: {
        assignedTo: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    if (assignedToId && assignedUser && assignedUser.email) {
      const creatorName = `${req.user?.firstName} ${req.user?.lastName}`;
      const employeeName = `${assignedUser.firstName} ${assignedUser.lastName}`;
      
      sendTaskAssignedEmail(assignedUser.email, employeeName, task.title, creatorName, task.deadline);

      await prisma.notification.create({
        data: {
          userId: assignedToId,
          type: 'TASK_ASSIGNED',
          title: 'Detyrë e re',
          message: `Keni një detyrë të re të caktuar: ${title}`,
          taskId: task.id
        }
      });
    }

    res.status(201).json(task);
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Ndodhi një gabim gjatë krijimit të detyrës' });
  }
});

/**
 * PUT /api/tasks/:id
 * Përditëson një detyrë (Vetëm Admin)
 */
router.put('/tasks/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const taskId = req.params.id;
  const { title, description, deadline, assignedToId, priority, visibleToAll, visibleToUserIds } = req.body;

  if (title && title.length > 200) {
    res.status(400).json({ error: 'Titulli nuk mund të jetë më i gjatë se 200 karaktere' });
    return;
  }

  if (description && description.length > 5000) {
    res.status(400).json({ error: 'Përshkrimi nuk mund të jetë më i gjatë se 5000 karaktere' });
    return;
  }

  try {
    const existingTask = await prisma.task.findUnique({
      where: { id: taskId },
      include: { assignedTo: true }
    });

    if (!existingTask) {
      res.status(404).json({ error: 'Detyra nuk u gjet' });
      return;
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        title: title || existingTask.title,
        description: description !== undefined ? description : existingTask.description,
        deadline: deadline ? new Date(deadline) : existingTask.deadline,
        assignedToId: assignedToId !== undefined ? assignedToId : existingTask.assignedToId,
        priority: priority || existingTask.priority,
        visibleToAll: visibleToAll !== undefined ? visibleToAll : existingTask.visibleToAll,
      },
      include: { assignedTo: true }
    });

    // Përditëso TaskVisibility
    if (visibleToAll === false && Array.isArray(visibleToUserIds)) {
      await prisma.taskVisibility.deleteMany({ where: { taskId } });
      const visibilityData = visibleToUserIds.map((uId: string) => ({ taskId, userId: uId }));
      if (visibilityData.length > 0) {
        await prisma.taskVisibility.createMany({ data: visibilityData });
      }
    } else if (visibleToAll === true) {
      await prisma.taskVisibility.deleteMany({ where: { taskId } });
    }

    if (assignedToId && assignedToId !== existingTask.assignedToId && updatedTask.assignedTo && updatedTask.assignedTo.email) {
      const creatorName = `${req.user?.firstName} ${req.user?.lastName}`;
      const employeeName = `${updatedTask.assignedTo.firstName} ${updatedTask.assignedTo.lastName}`;
      
      sendTaskAssignedEmail(updatedTask.assignedTo.email, employeeName, updatedTask.title, creatorName, updatedTask.deadline);

      await prisma.notification.create({
        data: {
          userId: assignedToId,
          type: 'TASK_ASSIGNED',
          title: 'Detyrë e re',
          message: `Keni një detyrë të re të caktuar: ${updatedTask.title}`,
          taskId: updatedTask.id
        }
      });
    }

    res.json(updatedTask);
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Ndodhi një gabim' });
  }
});

/**
 * DELETE /api/tasks/:id
 * Fshin një detyrë (Vetëm Admin)
 */
router.delete('/tasks/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const taskId = req.params.id;

  try {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      res.status(404).json({ error: 'Detyra nuk u gjet' });
      return;
    }

    await prisma.task.delete({ where: { id: taskId } });

    res.json({ message: 'Detyra u fshi me sukses' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Ndodhi një gabim' });
  }
});

/**
 * PUT /api/tasks/:id/status
 * Ndryshon statusin e detyrës (TODO -> IN_PROGRESS -> COMPLETED)
 */
router.put('/tasks/:id/status', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  const taskId = req.params.id;
  const { status } = req.body;
  const userId = req.user?.id;
  const role = req.user?.role;

  if (!status || !['TODO', 'IN_PROGRESS', 'COMPLETED'].includes(status)) {
    res.status(400).json({ error: 'Statusi duhet të jetë TODO, IN_PROGRESS, ose COMPLETED' });
    return;
  }

  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!task) {
      res.status(404).json({ error: 'Detyra nuk u gjet' });
      return;
    }

    if (role !== 'ADMIN' && task.assignedToId !== userId) {
      res.status(403).json({ error: 'Nuk keni privilegj të ndryshoni statusin e kësaj detyre' });
      return;
    }

    const previousStatus = task.status;

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: { status },
    });

    if (status === 'COMPLETED' && previousStatus !== 'COMPLETED' && task.createdBy && task.createdBy.email) {
      const managerEmail = task.createdBy.email;
      const managerName = `${task.createdBy.firstName} ${task.createdBy.lastName}`;
      const employeeName = task.assignedTo ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}` : 'I pacaktuar';

      sendTaskCompletedEmail(managerEmail, managerName, task.title, employeeName);

      await prisma.notification.create({
        data: {
          userId: task.createdById,
          type: 'TASK_COMPLETED',
          title: 'Detyrë e përfunduar',
          message: `Detyra "${task.title}" u përfundua nga ${employeeName}`,
          taskId: task.id
        }
      });
    }

    res.json(updatedTask);
  } catch (error) {
    console.error('Update task status error:', error);
    res.status(500).json({ error: 'Ndodhi një gabim' });
  }
});

/**
 * POST /api/tasks/:id/comments
 * Shton një koment në një detyrë
 */
router.post('/tasks/:id/comments', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  const taskId = req.params.id;
  const { content } = req.body;
  const userId = req.user?.id;
  const role = req.user?.role;

  if (!userId) {
    res.status(401).json({ error: 'I paautorizuar' });
    return;
  }
  if (!content) {
    res.status(400).json({ error: 'Përmbajtja e komentit është e detyrueshme' });
    return;
  }

  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { visibility: true }
    });

    if (!task) {
      res.status(404).json({ error: 'Detyra nuk u gjet' });
      return;
    }

    // Kontrollo qasjen
    if (role !== 'ADMIN') {
      const hasAccess = task.visibleToAll || task.assignedToId === userId || task.visibility.some(v => v.userId === userId);
      if (!hasAccess) {
        res.status(403).json({ error: 'Nuk keni qasje në këtë detyrë' });
        return;
      }
    }

    const comment = await prisma.comment.create({
      data: {
        content,
        taskId,
        authorId: userId,
      },
      include: {
        author: { select: { firstName: true, lastName: true, role: { select: { name: true } } } }
      }
    });

    // Njofto palën tjetër
    const authorName = `${comment.author.firstName} ${comment.author.lastName}`;
    if (role === 'ADMIN' && task.assignedToId && task.assignedToId !== userId) {
      await prisma.notification.create({
        data: {
          userId: task.assignedToId,
          type: 'COMMENT_ADDED',
          title: 'Koment i ri',
          message: `${authorName} komentoi në detyrën: ${task.title}`,
          taskId: task.id
        }
      });
    } else if (role === 'USER' && task.createdById && task.createdById !== userId) {
      await prisma.notification.create({
        data: {
          userId: task.createdById,
          type: 'COMMENT_ADDED',
          title: 'Koment i ri',
          message: `${authorName} komentoi në detyrën: ${task.title}`,
          taskId: task.id
        }
      });
    }

    const formattedComment = {
      ...comment,
      author: { ...comment.author, role: comment.author.role.name }
    };
    res.status(201).json(formattedComment);
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({ error: 'Ndodhi një gabim' });
  }
});

/**
 * GET /api/tasks/:id/comments
 * Merr komentet e një detyre
 */
router.get('/tasks/:id/comments', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  const taskId = req.params.id;
  const userId = req.user?.id;
  const role = req.user?.role;

  if (!userId) {
    res.status(401).json({ error: 'I paautorizuar' });
    return;
  }

  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { visibility: true }
    });

    if (!task) {
      res.status(404).json({ error: 'Detyra nuk u gjet' });
      return;
    }

    if (role !== 'ADMIN') {
      const hasAccess = task.visibleToAll || task.assignedToId === userId || task.visibility.some(v => v.userId === userId);
      if (!hasAccess) {
        res.status(403).json({ error: 'Nuk keni qasje në këtë detyrë' });
        return;
      }
    }

    const comments = await prisma.comment.findMany({
      where: { taskId },
      include: {
        author: { select: { firstName: true, lastName: true, role: { select: { name: true } } } }
      },
      orderBy: { createdAt: 'asc' },
    });

    const formattedComments = comments.map(c => ({
      ...c,
      author: { ...c.author, role: c.author.role.name }
    }));

    res.json(formattedComments);
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Ndodhi një gabim' });
  }
});

/**
 * DELETE /api/tasks/:id
 * Fshin një detyrë - Admin, Krijuesi i detyrës ose Krijuesi i Space
 */
router.delete('/tasks/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  const taskId = req.params.id;
  const userId = req.user?.id;
  const role = req.user?.role;

  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { attachments: true, space: true },
    });

    if (!task) {
      res.status(404).json({ error: 'Detyra nuk u gjet' });
      return;
    }

    if (role !== 'ADMIN' && task.createdById !== userId && task.space.createdById !== userId) {
      res.status(403).json({ error: 'Nuk keni të drejtë të fshini këtë detyrë' });
      return;
    }

    for (const att of task.attachments) {
      if (fs.existsSync(att.filePath)) {
        fs.unlinkSync(att.filePath);
      }
    }

    await prisma.task.delete({ where: { id: taskId } });
    res.json({ message: 'Detyra u fshi me sukses' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Ndodhi një gabim gjatë fshirjes së detyrës' });
  }
});

/**
 * POST /api/tasks/:id/attachments
 * Ngarkon një skedar shtojcë brenda detyrës
 */
router.post('/tasks/:id/attachments', authenticateToken, upload.single('file'), async (req: AuthRequest, res: Response): Promise<void> => {
  const taskId = req.params.id;
  const userId = req.user?.id;
  const role = req.user?.role;
  const file = req.file;

  if (!userId) {
    res.status(401).json({ error: 'I paautorizuar' });
    return;
  }

  if (!file) {
    res.status(400).json({ error: 'Mungon skedari për ngarkim' });
    return;
  }

  try {
    const task = await prisma.task.findUnique({ where: { id: taskId } });

    if (!task) {
      fs.unlinkSync(file.path);
      res.status(404).json({ error: 'Detyra nuk u gjet' });
      return;
    }

    if (role !== 'ADMIN' && task.assignedToId !== userId) {
      fs.unlinkSync(file.path);
      res.status(403).json({ error: 'Nuk keni privilegj të ngarkoni skedarë në këtë detyrë' });
      return;
    }

    const attachment = await prisma.attachment.create({
      data: {
        taskId,
        fileName: file.originalname,
        filePath: file.path,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedById: userId,
      },
    });

    res.status(201).json(attachment);
  } catch (error) {
    console.error('Upload attachment error:', error);
    if (file) {
      try { fs.unlinkSync(file.path); } catch(e) {}
    }
    res.status(500).json({ error: 'Ndodhi një gabim gjatë ngarkimit të skedarit' });
  }
});

/**
 * GET /api/tasks/:id/attachments/:attachmentId
 * Shkarkim i sigurt i skedarit shtojcë
 */
router.get('/tasks/:id/attachments/:attachmentId', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id: taskId, attachmentId } = req.params;
  const userId = req.user?.id;
  const role = req.user?.role;

  if (!userId) {
    res.status(401).json({ error: 'I paautorizuar' });
    return;
  }

  try {
    const task = await prisma.task.findUnique({ where: { id: taskId } });

    if (!task) {
      res.status(404).json({ error: 'Detyra nuk u gjet' });
      return;
    }

    if (role !== 'ADMIN' && task.assignedToId !== userId) {
      res.status(403).json({ error: 'Nuk keni qasje për të shkarkuar skedarët e kësaj detyre' });
      return;
    }

    const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId } });

    if (!attachment || attachment.taskId !== taskId) {
      res.status(404).json({ error: 'Shtojca nuk u gjet' });
      return;
    }

    if (!fs.existsSync(attachment.filePath)) {
      res.status(404).json({ error: 'Skedari nuk ekziston' });
      return;
    }

    res.download(attachment.filePath, attachment.fileName);
  } catch (error) {
    console.error('Download attachment error:', error);
    res.status(500).json({ error: 'Ndodhi një gabim' });
  }
});

export default router;