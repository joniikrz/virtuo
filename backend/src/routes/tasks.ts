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
    // Kontrollo nëse hapësira ekziston
    const space = await prisma.space.findUnique({
      where: { id: spaceId },
    });

    if (!space) {
      res.status(404).json({ error: 'Hapësira e punës nuk u gjet' });
      return;
    }

    // Kontrollo qasjen e përdoruesit në këtë Space
    if (role !== 'ADMIN') {
      if (space.isPrivate) {
        res.status(403).json({ error: 'Nuk keni qasje në këtë hapësirë private' });
        return;
      }

      const isMember = await prisma.spaceMember.findUnique({
        where: {
          spaceId_userId: {
            spaceId,
            userId,
          },
        },
      });

      if (!isMember) {
        res.status(403).json({ error: 'Nuk jeni anëtar i kësaj hapësire' });
        return;
      }
    }

    let tasks;

    const includeOptions = {
      assignedTo: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      createdBy: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      attachments: {
        select: {
          id: true,
          fileName: true,
          fileSize: true,
          mimeType: true,
          uploadedAt: true,
        },
      },
    };

    if (role === 'ADMIN') {
      // Admini sheh të gjitha detyrat brenda këtij Space
      tasks = await prisma.task.findMany({
        where: { spaceId },
        include: includeOptions,
        orderBy: { createdAt: 'desc' },
      });
    } else {
      // Punonjësi (USER) sheh VETËM detyrat e caktuara atij direkt brenda këtij Space
      tasks = await prisma.task.findMany({
        where: {
          spaceId,
          assignedToId: userId,
        },
        include: includeOptions,
        orderBy: { createdAt: 'desc' },
      });
    }

    res.json(tasks);
  } catch (error) {
    console.error('Fetch tasks error:', error);
    res.status(500).json({ error: 'Ndodhi një gabim gjatë marrjes së detyrave' });
  }
});

/**
 * POST /api/spaces/:spaceId/tasks
 * Krijon një detyrë të re - Vetëm për Admin/Shefa
 */
router.post('/spaces/:spaceId/tasks', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { spaceId } = req.params;
  const { title, description, deadline, assignedToId } = req.body;
  const creatorId = req.user?.id;

  if (!title || !deadline) {
    res.status(400).json({ error: 'Titulli dhe Afati i fundit (Deadline) janë të detyrueshme' });
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

    let assignedUser = null;
    if (assignedToId) {
      assignedUser = await prisma.user.findUnique({
        where: { id: assignedToId },
      });

      if (!assignedUser) {
        res.status(400).json({ error: 'Punonjësi i caktuar nuk ekziston' });
        return;
      }

      // Kontrollo që punonjësi të jetë anëtar i kësaj hapësire
      const isMember = await prisma.spaceMember.findUnique({
        where: {
          spaceId_userId: {
            spaceId,
            userId: assignedToId,
          },
        },
      });

      // Nëse hapësira është publike dhe ai nuk është anëtar, e shtojmë automatikisht
      if (!isMember) {
        if (space.isPrivate) {
          res.status(400).json({ error: 'Punonjësi i caktuar nuk është anëtar i kësaj hapësire private' });
          return;
        }
        await prisma.spaceMember.create({
          data: {
            spaceId,
            userId: assignedToId,
          },
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
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Dërgimi i email-it të njoftimit nëse detyra i caktohet dikujt
    if (assignedUser && assignedUser.email) {
      const creatorName = `${req.user?.firstName} ${req.user?.lastName}`;
      const employeeName = `${assignedUser.firstName} ${assignedUser.lastName}`;
      
      // Ekzekutohet në background për të mos bllokuar përgjigjen e API
      sendTaskAssignedEmail(
        assignedUser.email,
        employeeName,
        task.title,
        creatorName,
        task.deadline
      );
    }

    res.status(201).json(task);
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Ndodhi një gabim gjatë krijimit të detyrës' });
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
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!task) {
      res.status(404).json({ error: 'Detyra nuk u gjet' });
      return;
    }

    // Kontrollo privilegjet: Vetëm admini ose personi i caktuar mund të ndryshojë statusin
    if (role !== 'ADMIN' && task.assignedToId !== userId) {
      res.status(403).json({ error: 'Nuk keni privilegj të ndryshoni statusin e kësaj detyre' });
      return;
    }

    const previousStatus = task.status;

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: { status },
    });

    // Nëse statusi shënohet si COMPLETED dhe ishte ndryshe më parë, njoftohet menaxheri
    if (status === 'COMPLETED' && previousStatus !== 'COMPLETED' && task.createdBy && task.createdBy.email) {
      const managerEmail = task.createdBy.email;
      const managerName = `${task.createdBy.firstName} ${task.createdBy.lastName}`;
      const employeeName = task.assignedTo 
        ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}`
        : 'I pacaktuar';

      sendTaskCompletedEmail(managerEmail, managerName, task.title, employeeName);
    }

    res.json(updatedTask);
  } catch (error) {
    console.error('Update task status error:', error);
    res.status(500).json({ error: 'Ndodhi një gabim gjatë përditësimit të statusit' });
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
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      fs.unlinkSync(file.path);
      res.status(404).json({ error: 'Detyra nuk u gjet' });
      return;
    }

    // Kontrollo nëse përdoruesi ka qasje në këtë detyrë
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
 * Shkarkim i sigurt i skedarit shtojcë (vetëm nëse ka qasje te detyra)
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
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      res.status(404).json({ error: 'Detyra nuk u gjet' });
      return;
    }

    // Kontrollo qasjen
    if (role !== 'ADMIN' && task.assignedToId !== userId) {
      res.status(403).json({ error: 'Nuk keni qasje për të parë ose shkarkuar skedarët e kësaj detyre' });
      return;
    }

    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment || attachment.taskId !== taskId) {
      res.status(404).json({ error: 'Shtojca nuk u gjet' });
      return;
    }

    if (!fs.existsSync(attachment.filePath)) {
      res.status(404).json({ error: 'Skedari nuk ekziston më në serverin fizik' });
      return;
    }

    // Shërbe skedarin për shkarkim
    res.download(attachment.filePath, attachment.fileName);
  } catch (error) {
    console.error('Download attachment error:', error);
    res.status(500).json({ error: 'Ndodhi një gabim gjatë shkarkimit të skedarit' });
  }
});

export default router;