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
  createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
  attachments: { select: { id: true, fileName: true, fileSize: true, mimeType: true, uploadedAt: true } },
  tags: { include: { tag: true } },
  _count: { select: { comments: true } },
} as const;

function validDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function spaceAccess(spaceId: string, userId: string, role: string) {
  const space = await prisma.space.findUnique({ where: { id: spaceId } });
  if (!space) return { space: null, isMember: false, isOwner: false, canView: false };
  const isOwner = space.createdById === userId;
  const isMember = isOwner || Boolean(await prisma.spaceMember.findUnique({ where: { spaceId_userId: { spaceId, userId } } }));
  return { space, isMember, isOwner, canView: role === 'ADMIN' || isMember || !space.isPrivate };
}

async function taskAccess(taskId: string, userId: string, role: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, include: taskInclude });
  if (!task) return { task: null, canView: false, canManage: false, canChangeStatus: false };
  const access = await spaceAccess(task.spaceId, userId, role);
  const isCreator = task.createdById === userId;
  const isAssignee = task.assignedToId === userId;
  const canManage = role === 'ADMIN' || access.isOwner || isCreator;
  return { task, canView: access.canView, canManage, canChangeStatus: canManage || isAssignee };
}

async function createAssignmentNotification(task: any) {
  if (!task.assignedTo || task.assignedTo.id === task.createdBy.id) return;
  await prisma.notification.create({
    data: { userId: task.assignedTo.id, taskId: task.id, type: 'TASK_ASSIGNED', title: 'Detyrë e re', message: `Ju është caktuar detyra: ${task.title}` },
  });
  await sendTaskAssignedEmail(task.assignedTo.email, `${task.assignedTo.firstName} ${task.assignedTo.lastName}`, task.title, `${task.createdBy.firstName} ${task.createdBy.lastName}`, task.deadline);
}

async function createCompletionNotification(task: any, completedBy: string) {
  if (task.createdBy.id === completedBy) return;
  await prisma.notification.create({
    data: { userId: task.createdBy.id, taskId: task.id, type: 'TASK_COMPLETED', title: 'Detyrë e përfunduar', message: `Detyra u përfundua: ${task.title}` },
  });
  await sendTaskCompletedEmail(task.createdBy.email, `${task.createdBy.firstName} ${task.createdBy.lastName}`, task.title, task.assignedTo ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}` : 'Një anëtar');
}

router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const role = req.user?.role || 'USER';
  const spaceId = req.params.spaceId || (req.query.spaceId as string | undefined);
  if (!userId) return res.status(401).json({ error: 'I paautorizuar' });
  try {
    if (spaceId) {
      const access = await spaceAccess(spaceId, userId, role);
      if (!access.canView) return res.status(403).json({ error: 'Nuk keni leje për këtë hapësirë' });
      return res.json(await prisma.task.findMany({ where: { spaceId, OR: [{ visibleToAll: true }, { createdById: userId }, { assignedToId: userId }] }, include: taskInclude, orderBy: { createdAt: 'desc' } }));
    }
    return res.json(await prisma.task.findMany({ where: { assignedToId: userId }, include: taskInclude, orderBy: { createdAt: 'desc' } }));
  } catch (error) { console.error('Fetch tasks error:', error); return res.status(500).json({ error: 'Gabim gjatë marrjes së detyrave' }); }
});

router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const role = req.user?.role || 'USER';
  const spaceId = req.params.spaceId || req.body.spaceId;
  const { title, description, status = 'TODO', priority = 'NORMAL', deadline, assignedToId, visibleToAll = true } = req.body;
  if (!userId) return res.status(401).json({ error: 'I paautorizuar' });
  if (typeof title !== 'string' || !title.trim() || typeof spaceId !== 'string') return res.status(400).json({ error: 'Titulli dhe hapësira janë të detyrueshme' });
  const parsedDeadline = validDate(deadline);
  if (!parsedDeadline) return res.status(400).json({ error: 'Afati i fundit nuk është i vlefshëm' });
  if (!validStatuses.has(status) || !validPriorities.has(priority)) return res.status(400).json({ error: 'Statusi ose prioriteti nuk është i vlefshëm' });
  try {
    const access = await spaceAccess(spaceId, userId, role);
    if (!(role === 'ADMIN' || access.isOwner)) return res.status(403).json({ error: 'Vetëm administratori ose krijuesi i hapësirës mund të krijojë detyra' });
    if (assignedToId && !(await prisma.spaceMember.findUnique({ where: { spaceId_userId: { spaceId, userId: assignedToId } } }))) return res.status(400).json({ error: 'Përdoruesi i caktuar duhet të jetë anëtar i hapësirës' });
    const task = await prisma.task.create({ data: { title: title.trim(), description, status, priority, deadline: parsedDeadline, spaceId, createdById: userId, assignedToId: assignedToId || null, visibleToAll: Boolean(visibleToAll) }, include: taskInclude });
    await createAssignmentNotification(task);
    return res.status(201).json(task);
  } catch (error) { console.error('Create task error:', error); return res.status(500).json({ error: 'Gabim gjatë krijimit të detyrës' }); }
});

router.put('/:id/status', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'I paautorizuar' });
  if (!validStatuses.has(req.body.status)) return res.status(400).json({ error: 'Status i pavlefshëm' });
  try {
    const access = await taskAccess(req.params.id, userId, req.user?.role || 'USER');
    if (!access.task) return res.status(404).json({ error: 'Detyra nuk u gjet' });
    if (!access.canChangeStatus) return res.status(403).json({ error: 'Nuk keni leje të ndryshoni statusin' });
    const updated = await prisma.task.update({ where: { id: access.task.id }, data: { status: req.body.status }, include: taskInclude });
    if (access.task.status !== 'COMPLETED' && updated.status === 'COMPLETED') await createCompletionNotification(access.task, userId);
    return res.json(updated);
  } catch (error) { console.error('Update status error:', error); return res.status(500).json({ error: 'Gabim gjatë përditësimit të statusit' }); }
});

router.post('/:id/attachments', authenticateToken, upload.single('file'), async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId || !req.file) return res.status(400).json({ error: 'Skedari është i detyrueshëm' });
  try {
    const access = await taskAccess(req.params.id, userId, req.user?.role || 'USER');
    if (!access.task) return res.status(404).json({ error: 'Detyra nuk u gjet' });
    if (!access.canChangeStatus) return res.status(403).json({ error: 'Nuk keni leje të ngarkoni skedarë' });
    return res.status(201).json(await prisma.attachment.create({ data: { taskId: access.task.id, fileName: req.file.originalname, filePath: req.file.path, fileSize: req.file.size, mimeType: req.file.mimetype, uploadedById: userId }, select: { id: true, fileName: true, fileSize: true, mimeType: true, uploadedAt: true } }));
  } catch (error) { console.error('Upload attachment error:', error); return res.status(500).json({ error: 'Gabim gjatë ngarkimit të skedarit' }); }
});

router.get('/:id/attachments/:attachmentId', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'I paautorizuar' });
  const access = await taskAccess(req.params.id, userId, req.user?.role || 'USER');
  if (!access.task || !access.canView) return res.status(404).json({ error: 'Skedari nuk u gjet' });
  const attachment = await prisma.attachment.findFirst({ where: { id: req.params.attachmentId, taskId: access.task.id } });
  if (!attachment) return res.status(404).json({ error: 'Skedari nuk u gjet' });
  return res.download(attachment.filePath, attachment.fileName);
});

router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'I paautorizuar' });
  const { title, description, status, priority, deadline, assignedToId, visibleToAll } = req.body;
  if (status !== undefined && !validStatuses.has(status) || priority !== undefined && !validPriorities.has(priority)) return res.status(400).json({ error: 'Statusi ose prioriteti nuk është i vlefshëm' });
  const parsedDeadline = deadline === undefined ? undefined : validDate(deadline);
  if (deadline !== undefined && !parsedDeadline) return res.status(400).json({ error: 'Afati i fundit nuk është i vlefshëm' });
  try {
    const access = await taskAccess(req.params.id, userId, req.user?.role || 'USER');
    if (!access.task) return res.status(404).json({ error: 'Detyra nuk u gjet' });
    if (!access.canManage) return res.status(403).json({ error: 'Nuk keni leje të përditësoni detyrën' });
    if (assignedToId && !(await prisma.spaceMember.findUnique({ where: { spaceId_userId: { spaceId: access.task.spaceId, userId: assignedToId } } }))) return res.status(400).json({ error: 'Përdoruesi i caktuar duhet të jetë anëtar i hapësirës' });
    const updated = await prisma.task.update({ where: { id: access.task.id }, data: { ...(typeof title === 'string' && { title: title.trim() }), ...(description !== undefined && { description }), ...(status !== undefined && { status }), ...(priority !== undefined && { priority }), ...(parsedDeadline && { deadline: parsedDeadline }), ...(assignedToId !== undefined && { assignedToId: assignedToId || null }), ...(visibleToAll !== undefined && { visibleToAll: Boolean(visibleToAll) }) }, include: taskInclude });
    if (assignedToId && assignedToId !== access.task.assignedToId) await createAssignmentNotification(updated);
    if (access.task.status !== 'COMPLETED' && updated.status === 'COMPLETED') await createCompletionNotification(access.task, userId);
    return res.json(updated);
  } catch (error) { console.error('Update task error:', error); return res.status(500).json({ error: 'Gabim gjatë përditësimit të detyrës' }); }
});

router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'I paautorizuar' });
  try {
    const access = await taskAccess(req.params.id, userId, req.user?.role || 'USER');
    if (!access.task) return res.status(404).json({ error: 'Detyra nuk u gjet' });
    if (!access.canManage) return res.status(403).json({ error: 'Nuk keni leje të fshini detyrën' });
    await prisma.task.delete({ where: { id: access.task.id } });
    return res.json({ message: 'Detyra u fshi me sukses' });
  } catch (error) { console.error('Delete task error:', error); return res.status(500).json({ error: 'Gabim gjatë fshirjes së detyrës' }); }
});

export default router;
