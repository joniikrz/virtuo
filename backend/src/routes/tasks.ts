import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import prisma from '../prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { sendTaskAssignedEmail, sendTaskCompletedEmail } from '../services/email';

const router = Router({ mergeParams: true });
const uploadDirectory = path.resolve(process.env.UPLOAD_DIR || 'uploads');
const validStatuses = new Set(['TODO', 'IN_PROGRESS', 'COMPLETED']);
const validPriorities = new Set(['LOW', 'NORMAL', 'HIGH', 'URGENT']);
fs.mkdirSync(uploadDirectory, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDirectory,
    filename: (_req, file, done) => done(null, `${crypto.randomUUID()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

const taskInclude = {
  assignedTo: { select: { id: true, email: true, firstName: true, lastName: true } },
  assignees: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } } },
  createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
  attachments: { select: { id: true, fileName: true, fileSize: true, mimeType: true, uploadedAt: true } },
  comments: { include: { author: { select: { id: true, firstName: true, lastName: true, role: { select: { name: true } } } } }, orderBy: { createdAt: 'asc' } },
  tags: { include: { tag: true } },
  _count: { select: { comments: true } },
} as const;

function validDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseAssignedUserIds(multipleValue: unknown, legacyValue: unknown): string[] {
  const candidates: unknown[] = Array.isArray(multipleValue) ? multipleValue : [legacyValue];
  return [...new Set(candidates.filter((id): id is string => typeof id === 'string' && id.length > 0))];
}

async function spaceAccess(spaceId: string, userId: string) {
  const space = await prisma.space.findUnique({ where: { id: spaceId } });
  if (!space) return { space: null, isMember: false, isOwner: false, canView: false };
  const isOwner = space.createdById === userId;
  const isMember = isOwner || Boolean(await prisma.spaceMember.findUnique({ where: { spaceId_userId: { spaceId, userId } } }));
  return { space, isMember, isOwner, canView: isMember };
}

async function taskAccess(taskId: string, userId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, include: taskInclude });
  if (!task) return { task: null, canView: false, canManage: false, canChangeStatus: false };
  const access = await spaceAccess(task.spaceId, userId);
  const isCreator = task.createdById === userId;
  const isAssignee = task.assignedToId === userId || task.assignees.some((assignment) => assignment.userId === userId);
  const canManage = isCreator;
  const canView = access.canView && (isCreator || isAssignee);
  return { task, canView, canManage, canChangeStatus: canManage || isAssignee };
}

async function createAssignmentNotifications(task: any, onlyUserIds?: Set<string>) {
  const assignedUsers = task.assignees?.length
    ? task.assignees.map((assignment: any) => assignment.user)
    : task.assignedTo ? [task.assignedTo] : [];
  await Promise.all(assignedUsers
    .filter((user: any) => user.id !== task.createdBy.id && (!onlyUserIds || onlyUserIds.has(user.id)))
    .map(async (user: any) => {
      await prisma.notification.create({
        data: { userId: user.id, taskId: task.id, type: 'TASK_ASSIGNED', title: 'Detyrë e re', message: `Ju është caktuar detyra: ${task.title}` },
      });
      await sendTaskAssignedEmail(user.email, `${user.firstName} ${user.lastName}`, task.title, `${task.createdBy.firstName} ${task.createdBy.lastName}`, task.deadline);
    }));
}

async function createCompletionNotification(task: any, completedBy: string) {
  if (task.createdBy.id === completedBy) return;
  await prisma.notification.create({
    data: { userId: task.createdBy.id, taskId: task.id, type: 'TASK_COMPLETED', title: 'Detyrë e përfunduar', message: `Detyra u përfundua: ${task.title}` },
  });
  const completedByNames = task.assignees?.length
    ? task.assignees.map((assignment: any) => `${assignment.user.firstName} ${assignment.user.lastName}`).join(', ')
    : task.assignedTo ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}` : 'Një anëtar';
  await sendTaskCompletedEmail(task.createdBy.email, `${task.createdBy.firstName} ${task.createdBy.lastName}`, task.title, completedByNames);
}

async function removeTaskFiles(filePaths: string[]) {
  await Promise.all(filePaths.map(async (filePath) => {
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(`${uploadDirectory}${path.sep}`)) return;
    await fs.promises.unlink(resolvedPath).catch(() => undefined);
  }));
}

router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const spaceId = req.params.spaceId || (req.query.spaceId as string | undefined);
  if (!userId) return res.status(401).json({ error: 'I paautorizuar' });
  try {
    if (spaceId) {
      const access = await spaceAccess(spaceId, userId);
      if (!access.canView) return res.status(403).json({ error: 'Nuk keni leje për këtë hapësirë' });
      const taskFilter = { spaceId, OR: [{ createdById: userId }, { assignedToId: userId }, { assignees: { some: { userId } } }] };
      return res.json(await prisma.task.findMany({ where: taskFilter, include: taskInclude, orderBy: { createdAt: 'desc' } }));
    }
    return res.json(await prisma.task.findMany({ where: { OR: [{ createdById: userId }, { assignedToId: userId }, { assignees: { some: { userId } } }] }, include: taskInclude, orderBy: { createdAt: 'desc' } }));
  } catch (error) { console.error('Fetch tasks error:', error); return res.status(500).json({ error: 'Gabim gjatë marrjes së detyrave' }); }
});

router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const spaceId = req.params.spaceId || req.body.spaceId;
  const { title, description, status = 'TODO', priority = 'NORMAL', deadline } = req.body;
  const assignedToIds = parseAssignedUserIds(req.body.assignedToIds, req.body.assignedToId);
  if (!userId) return res.status(401).json({ error: 'I paautorizuar' });
  if (typeof title !== 'string' || !title.trim() || typeof spaceId !== 'string' || assignedToIds.length === 0) return res.status(400).json({ error: 'Titulli, hapësira dhe së paku një person i caktuar janë të detyrueshëm' });
  const parsedDeadline = validDate(deadline);
  if (!parsedDeadline) return res.status(400).json({ error: 'Afati i fundit nuk është i vlefshëm' });
  if (!validStatuses.has(status) || !validPriorities.has(priority)) return res.status(400).json({ error: 'Statusi ose prioriteti nuk është i vlefshëm' });
  try {
    const access = await spaceAccess(spaceId, userId);
    if (!access.isMember) return res.status(403).json({ error: 'Duhet të jeni anëtar i hapësirës për të krijuar detyra' });
    const memberCount = await prisma.spaceMember.count({ where: { spaceId, userId: { in: assignedToIds } } });
    if (memberCount !== assignedToIds.length) return res.status(400).json({ error: 'Të gjithë personat e caktuar duhet të jenë anëtarë të hapësirës' });
    const task = await prisma.task.create({
      data: {
        title: title.trim(), description, status, priority, deadline: parsedDeadline, spaceId, createdById: userId,
        assignedToId: assignedToIds[0],
        assignees: { create: assignedToIds.map((assignedUserId) => ({ userId: assignedUserId })) },
      },
      include: taskInclude,
    });
    await createAssignmentNotifications(task);
    return res.status(201).json(task);
  } catch (error) { console.error('Create task error:', error); return res.status(500).json({ error: 'Gabim gjatë krijimit të detyrës' }); }
});

router.put('/:id/status', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'I paautorizuar' });
  if (!validStatuses.has(req.body.status)) return res.status(400).json({ error: 'Status i pavlefshëm' });
  try {
    const access = await taskAccess(req.params.id, userId);
    if (!access.task) return res.status(404).json({ error: 'Detyra nuk u gjet' });
    if (!access.canView) return res.status(403).json({ error: 'Nuk keni leje të ndryshoni statusin' });
    const updated = await prisma.task.update({ where: { id: access.task.id }, data: { status: req.body.status }, include: taskInclude });
    if (access.task.status !== 'COMPLETED' && updated.status === 'COMPLETED') await createCompletionNotification(access.task, userId);
    return res.json(updated);
  } catch (error) { console.error('Update status error:', error); return res.status(500).json({ error: 'Gabim gjatë përditësimit të statusit' }); }
});

router.post('/:id/attachments', authenticateToken, upload.single('file'), async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId || !req.file) return res.status(400).json({ error: 'Skedari është i detyrueshëm' });
  try {
    const access = await taskAccess(req.params.id, userId);
    if (!access.task) return res.status(404).json({ error: 'Detyra nuk u gjet' });
    if (!access.canView) return res.status(403).json({ error: 'Nuk keni leje të ngarkoni skedarë' });
    return res.status(201).json(await prisma.attachment.create({ data: { taskId: access.task.id, fileName: req.file.originalname, filePath: req.file.path, fileSize: req.file.size, mimeType: req.file.mimetype, uploadedById: userId }, select: { id: true, fileName: true, fileSize: true, mimeType: true, uploadedAt: true } }));
  } catch (error) { console.error('Upload attachment error:', error); return res.status(500).json({ error: 'Gabim gjatë ngarkimit të skedarit' }); }
});

router.get('/:id/attachments/:attachmentId', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'I paautorizuar' });
  const access = await taskAccess(req.params.id, userId);
  if (!access.task || !access.canView) return res.status(404).json({ error: 'Skedari nuk u gjet' });
  const attachment = await prisma.attachment.findFirst({ where: { id: req.params.attachmentId, taskId: access.task.id } });
  if (!attachment) return res.status(404).json({ error: 'Skedari nuk u gjet' });
  return res.download(attachment.filePath, attachment.fileName);
});

router.post('/:id/comments', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';
  if (!userId) return res.status(401).json({ error: 'I paautorizuar' });
  if (!content) return res.status(400).json({ error: 'Komenti nuk mund të jetë bosh' });
  if (content.length > 2000) return res.status(400).json({ error: 'Komenti mund të ketë maksimumi 2000 karaktere' });
  try {
    const access = await taskAccess(req.params.id, userId);
    if (!access.task) return res.status(404).json({ error: 'Detyra nuk u gjet' });
    if (!access.canView) return res.status(403).json({ error: 'Nuk keni leje të komentoni këtë detyrë' });
    const comment = await prisma.comment.create({
      data: { taskId: access.task.id, authorId: userId, content },
      include: { author: { select: { id: true, firstName: true, lastName: true, role: { select: { name: true } } } } },
    });
    return res.status(201).json({ ...comment, author: { ...comment.author, role: comment.author.role.name } });
  } catch (error) {
    console.error('Create comment error:', error);
    return res.status(500).json({ error: 'Gabim gjatë krijimit të komentit' });
  }
});

router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'I paautorizuar' });
  const { title, description, status, priority, deadline } = req.body;
  const hasAssignmentUpdate = Array.isArray(req.body.assignedToIds) || req.body.assignedToId !== undefined;
  const assignedToIds = parseAssignedUserIds(req.body.assignedToIds, req.body.assignedToId);
  if (status !== undefined && !validStatuses.has(status) || priority !== undefined && !validPriorities.has(priority)) return res.status(400).json({ error: 'Statusi ose prioriteti nuk është i vlefshëm' });
  if (hasAssignmentUpdate && assignedToIds.length === 0) return res.status(400).json({ error: 'Së paku një person i caktuar është i detyrueshëm' });
  const parsedDeadline = deadline === undefined ? undefined : validDate(deadline);
  if (deadline !== undefined && !parsedDeadline) return res.status(400).json({ error: 'Afati i fundit nuk është i vlefshëm' });
  try {
    const access = await taskAccess(req.params.id, userId);
    if (!access.task) return res.status(404).json({ error: 'Detyra nuk u gjet' });
    if (!access.canManage) return res.status(403).json({ error: 'Nuk keni leje të përditësoni detyrën' });
    if (hasAssignmentUpdate) {
      const memberCount = await prisma.spaceMember.count({ where: { spaceId: access.task.spaceId, userId: { in: assignedToIds } } });
      if (memberCount !== assignedToIds.length) return res.status(400).json({ error: 'Të gjithë personat e caktuar duhet të jenë anëtarë të hapësirës' });
    }
    const previousAssigneeIds = new Set([
      ...access.task.assignees.map((assignment) => assignment.userId),
      ...(access.task.assignedToId ? [access.task.assignedToId] : []),
    ]);
    const updated = await prisma.task.update({
      where: { id: access.task.id },
      data: {
        ...(typeof title === 'string' && { title: title.trim() }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status }),
        ...(priority !== undefined && { priority }),
        ...(parsedDeadline && { deadline: parsedDeadline }),
        ...(hasAssignmentUpdate && {
          assignedToId: assignedToIds[0],
          assignees: { deleteMany: {}, create: assignedToIds.map((assignedUserId) => ({ userId: assignedUserId })) },
        }),
      },
      include: taskInclude,
    });
    if (hasAssignmentUpdate) {
      const newAssigneeIds = new Set(assignedToIds.filter((id) => !previousAssigneeIds.has(id)));
      await createAssignmentNotifications(updated, newAssigneeIds);
    }
    if (access.task.status !== 'COMPLETED' && updated.status === 'COMPLETED') await createCompletionNotification(access.task, userId);
    return res.json(updated);
  } catch (error) { console.error('Update task error:', error); return res.status(500).json({ error: 'Gabim gjatë përditësimit të detyrës' }); }
});

router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'I paautorizuar' });
  try {
    const access = await taskAccess(req.params.id, userId);
    if (!access.task) return res.status(404).json({ error: 'Detyra nuk u gjet' });
    if (access.task.createdById !== userId) return res.status(403).json({ error: 'Vetëm krijuesi i detyrës mund ta fshijë' });
    const attachments = await prisma.attachment.findMany({ where: { taskId: access.task.id }, select: { filePath: true } });
    await prisma.task.delete({ where: { id: access.task.id } });
    await removeTaskFiles(attachments.map((attachment) => attachment.filePath));
    return res.json({ message: 'Detyra u fshi me sukses' });
  } catch (error) { console.error('Delete task error:', error); return res.status(500).json({ error: 'Gabim gjatë fshirjes së detyrës' }); }
});

export default router;
