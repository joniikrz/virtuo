import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import prisma from '../prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { sendTaskAssignedEmail, sendTaskCompletedEmail } from '../services/email';
import { application } from '../composition-root';
import { AccessDeniedError } from '../application/shared/errors';
import { isTaskPriority, isTaskStatus, parseAssigneeIds, parseTaskDeadline } from '../domain/tasks/task-policy';

const router = Router({ mergeParams: true });
const uploadDirectory = path.resolve(process.env.UPLOAD_DIR || 'uploads');
const maxUploadBytes = Math.max(1024, Math.min(Number(process.env.MAX_UPLOAD_BYTES) || 10 * 1024 * 1024, 25 * 1024 * 1024));
fs.mkdirSync(uploadDirectory, { recursive: true });

const uploadMimeByExtension: Record<string, string> = {
  '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.txt': 'text/plain', '.csv': 'text/csv', '.zip': 'application/zip',
  '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

function safeFileName(value: string): string {
  return path.basename(value).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 180) || 'skedar';
}

function uploadValidationError(message: string): Error {
  const error = new Error(message);
  error.name = 'UploadValidationError';
  return error;
}

async function validStoredFile(file: Express.Multer.File): Promise<boolean> {
  const extension = path.extname(file.originalname).toLowerCase();
  const handle = await fs.promises.open(file.path, 'r');
  let data: Buffer;
  try {
    const header = Buffer.alloc(4096);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    data = header.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
  if (data.length === 0) return false;
  const starts = (...bytes: number[]) => bytes.every((byte, index) => data[index] === byte);
  if (extension === '.pdf') return data.subarray(0, 5).toString() === '%PDF-';
  if (extension === '.png') return starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  if (extension === '.jpg' || extension === '.jpeg') return starts(0xff, 0xd8, 0xff);
  if (extension === '.webp') return data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP';
  if (['.zip', '.docx', '.xlsx', '.pptx'].includes(extension)) return starts(0x50, 0x4b, 0x03, 0x04) || starts(0x50, 0x4b, 0x05, 0x06);
  if (['.doc', '.xls', '.ppt'].includes(extension)) return starts(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
  if (extension === '.txt' || extension === '.csv') return !data.subarray(0, Math.min(data.length, 4096)).includes(0);
  return false;
}

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDirectory,
    filename: (_req, file, done) => done(null, `${crypto.randomUUID()}${path.extname(file.originalname)}`),
  }),
  fileFilter: (_req, file, done) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!uploadMimeByExtension[extension]) {
      done(uploadValidationError('Ky lloj skedari nuk lejohet'));
      return;
    }
    done(null, true);
  },
  limits: { fileSize: maxUploadBytes, files: 1, fields: 5, fieldNameSize: 100, fieldSize: 1024 },
});

const taskInclude = {
  assignedTo: { select: { id: true, email: true, firstName: true, lastName: true, emailNotifications: true, inAppNotifications: true } },
  assignees: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true, emailNotifications: true, inAppNotifications: true } } } },
  createdBy: { select: { id: true, email: true, firstName: true, lastName: true, emailNotifications: true, inAppNotifications: true } },
  attachments: { select: { id: true, fileName: true, fileSize: true, mimeType: true, uploadedById: true, uploadedAt: true } },
  comments: { include: { author: { select: { id: true, firstName: true, lastName: true, role: { select: { name: true } } } } }, orderBy: { createdAt: 'asc' } },
  tags: { include: { tag: true } },
  _count: { select: { comments: true, attachments: true } },
} as const;

const taskAccessInclude = {
  assignedTo: { select: { id: true, email: true, firstName: true, lastName: true, emailNotifications: true, inAppNotifications: true } },
  assignees: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true, emailNotifications: true, inAppNotifications: true } } } },
  createdBy: { select: { id: true, email: true, firstName: true, lastName: true, emailNotifications: true, inAppNotifications: true } },
} as const;

async function spaceAccess(spaceId: string, userId: string) {
  const space = await prisma.space.findUnique({ where: { id: spaceId } });
  if (!space) return { space: null, isMember: false, isOwner: false, canView: false };
  const isOwner = space.createdById === userId;
  const isMember = isOwner || Boolean(await prisma.spaceMember.findUnique({ where: { spaceId_userId: { spaceId, userId } } }));
  return { space, isMember, isOwner, canView: isMember };
}

async function taskAccess(taskId: string, userId: string, includeDetails = false) {
  const task: any = includeDetails
    ? await prisma.task.findUnique({ where: { id: taskId }, include: taskInclude })
    : await prisma.task.findUnique({ where: { id: taskId }, include: taskAccessInclude });
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
  const recipients = assignedUsers.filter((user: any) => user.id !== task.createdBy.id && (!onlyUserIds || onlyUserIds.has(user.id)));
  const inAppRecipients = recipients.filter((user: any) => user.inAppNotifications);
  if (inAppRecipients.length) {
    await prisma.notification.createMany({
      data: inAppRecipients.map((user: any) => ({
        userId: user.id,
        taskId: task.id,
        type: 'TASK_ASSIGNED',
        title: 'Detyrë e re',
        message: `Ju është caktuar detyra: ${task.title}`,
      })),
    });
  }
  // Gmail kufizon lidhjet paralele. Pool-i dhe radha sekuenciale sigurojnë që çdo marrës
  // të përpunohet pa e mbajtur hapur kërkesën e krijimit të taskut.
  const emailRecipients = recipients.filter((user: any) => user.emailNotifications);
  void (async () => {
    for (const user of emailRecipients) {
      const sent = await sendTaskAssignedEmail(
        user.email,
        `${user.firstName} ${user.lastName}`,
        task.title,
        `${task.createdBy.firstName} ${task.createdBy.lastName}`,
        task.deadline,
        task.id,
      );
      if (!sent) console.error(`Task assignment email was not delivered to user ${user.id}`);
    }
  })().catch((error) => console.error('Background task assignment email queue error:', error));
}

async function createCompletionNotification(task: any, completedBy: string) {
  if (task.createdBy.id === completedBy) return;
  if (task.createdBy.inAppNotifications) {
    await prisma.notification.create({
      data: { userId: task.createdBy.id, taskId: task.id, type: 'TASK_COMPLETED', title: 'Detyrë e përfunduar', message: `Detyra u përfundua: ${task.title}` },
    });
  }
  const completedByNames = task.assignees?.length
    ? task.assignees.map((assignment: any) => `${assignment.user.firstName} ${assignment.user.lastName}`).join(', ')
    : task.assignedTo ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}` : 'Një anëtar';
  if (task.createdBy.emailNotifications) {
    void sendTaskCompletedEmail(
      task.createdBy.email,
      `${task.createdBy.firstName} ${task.createdBy.lastName}`,
      task.title,
      completedByNames,
      task.id,
    ).catch((error) => console.error('Background task completion email error:', error));
  }
}

async function createTaskActivityNotifications(
  task: any,
  actorId: string,
  actorName: string,
  activity: 'COMMENT' | 'ATTACHMENT',
  resourceId: string,
) {
  const participants = [
    task.createdBy,
    ...(task.assignees?.length
      ? task.assignees.map((assignment: any) => assignment.user)
      : task.assignedTo ? [task.assignedTo] : []),
  ];
  const recipients = [...new Map(participants
    .filter((participant: any) => participant?.id && participant.id !== actorId && participant.inAppNotifications !== false)
    .map((participant: any) => [participant.id, participant])).values()] as any[];
  const isComment = activity === 'COMMENT';

  try {
    if (recipients.length) await prisma.notification.createMany({
      data: recipients.map((recipient) => ({
        userId: recipient.id,
        taskId: task.id,
        type: isComment ? 'COMMENT_ADDED' : 'ATTACHMENT_ADDED',
        title: isComment ? 'Koment i ri' : 'Skedar i ri',
        message: isComment
          ? `${actorName} komentoi në detyrën: ${task.title}`
          : `${actorName} bashkëngjiti një skedar në detyrën: ${task.title}`,
        resourceType: activity,
        resourceId,
      })),
    });
  } catch (error) {
    // Komenti/skedari mbetet funksional edhe nëse shërbimi i njoftimeve ka problem të përkohshëm.
    console.error('Task activity notification error:', error);
  }
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
    const result = await application.listTasks.execute({
      userId,
      spaceId,
      assignedOnly: req.query.scope === 'assigned',
      ifNoneMatch: req.headers['if-none-match'],
    });
    res.setHeader('ETag', result.etag);
    res.setHeader('Cache-Control', 'private, no-cache');
    if (result.notModified) return res.status(304).end();
    res.setHeader('X-Result-Limit', String(result.resultLimit));
    return res.json(result.tasks);
  } catch (error) {
    if (error instanceof AccessDeniedError) return res.status(403).json({ error: error.message });
    console.error('Fetch tasks error:', error);
    return res.status(500).json({ error: 'Gabim gjatë marrjes së detyrave' });
  }
});

router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'I paautorizuar' });
  try {
    const access = await taskAccess(req.params.id, userId, true);
    if (!access.task || !access.canView) return res.status(404).json({ error: 'Detyra nuk u gjet' });
    res.setHeader('Cache-Control', 'private, no-cache');
    return res.json(access.task);
  } catch (error) {
    console.error('Fetch task detail error:', error);
    return res.status(500).json({ error: 'Gabim gjatë marrjes së detyrës' });
  }
});

router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const spaceId = req.params.spaceId || req.body.spaceId;
  const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
  const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
  const { status = 'TODO', priority = 'NORMAL', deadline } = req.body;
  const assignedToIds = parseAssigneeIds(req.body.assignedToIds, req.body.assignedToId);
  if (!userId) return res.status(401).json({ error: 'I paautorizuar' });
  if (!title || typeof spaceId !== 'string' || assignedToIds.length === 0) return res.status(400).json({ error: 'Titulli, hapësira dhe së paku një person i caktuar janë të detyrueshëm' });
  if (title.length > 160 || description.length > 10_000) return res.status(400).json({ error: 'Titulli ose përshkrimi është shumë i gjatë' });
  if (assignedToIds.length > 100) return res.status(400).json({ error: 'Një detyrë mund t’u caktohet maksimumi 100 anëtarëve' });
  const parsedDeadline = parseTaskDeadline(deadline);
  if (!parsedDeadline) return res.status(400).json({ error: 'Afati i fundit nuk është i vlefshëm' });
  if (!isTaskStatus(status) || !isTaskPriority(priority)) return res.status(400).json({ error: 'Statusi ose prioriteti nuk është i vlefshëm' });
  try {
    const access = await spaceAccess(spaceId, userId);
    if (!access.isMember) return res.status(403).json({ error: 'Duhet të jeni anëtar i hapësirës për të krijuar detyra' });
    const memberCount = await prisma.spaceMember.count({ where: { spaceId, userId: { in: assignedToIds } } });
    if (memberCount !== assignedToIds.length) return res.status(400).json({ error: 'Të gjithë personat e caktuar duhet të jenë anëtarë të hapësirës' });
    const task = await prisma.task.create({
      data: {
        title, description, status, priority, deadline: parsedDeadline, spaceId, createdById: userId,
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
  if (!isTaskStatus(req.body.status)) return res.status(400).json({ error: 'Status i pavlefshëm' });
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
    if (!(await validStoredFile(req.file))) {
      await fs.promises.unlink(req.file.path).catch(() => undefined);
      return res.status(400).json({ error: 'Përmbajtja e skedarit nuk përputhet me formatin e lejuar' });
    }
    const access = await taskAccess(req.params.id, userId);
    if (!access.task || !access.canView) {
      await fs.promises.unlink(req.file.path).catch(() => undefined);
      if (!access.task) return res.status(404).json({ error: 'Detyra nuk u gjet' });
      return res.status(403).json({ error: 'Nuk keni leje të ngarkoni skedarë' });
    }
    const extension = path.extname(req.file.originalname).toLowerCase();
    const attachment = await prisma.attachment.create({
      data: { taskId: access.task.id, fileName: safeFileName(req.file.originalname), filePath: req.file.path, fileSize: req.file.size, mimeType: uploadMimeByExtension[extension], uploadedById: userId },
      select: { id: true, fileName: true, fileSize: true, mimeType: true, uploadedById: true, uploadedAt: true },
    });
    await prisma.task.update({ where: { id: access.task.id }, data: { updatedAt: new Date() } });
    const actor = access.task.createdById === userId
      ? access.task.createdBy
      : access.task.assignees.find((assignment) => assignment.userId === userId)?.user || access.task.assignedTo;
    await createTaskActivityNotifications(access.task, userId, `${actor?.firstName || ''} ${actor?.lastName || ''}`.trim() || 'Një anëtar', 'ATTACHMENT', attachment.id);
    return res.status(201).json(attachment);
  } catch (error) {
    await fs.promises.unlink(req.file.path).catch(() => undefined);
    console.error('Upload attachment error:', error);
    return res.status(500).json({ error: 'Gabim gjatë ngarkimit të skedarit' });
  }
});

router.get('/:id/attachments/:attachmentId', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'I paautorizuar' });
  const access = await taskAccess(req.params.id, userId);
  if (!access.task || !access.canView) return res.status(404).json({ error: 'Skedari nuk u gjet' });
  const attachment = await prisma.attachment.findFirst({ where: { id: req.params.attachmentId, taskId: access.task.id } });
  if (!attachment) return res.status(404).json({ error: 'Skedari nuk u gjet' });
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.download(attachment.filePath, attachment.fileName);
});

router.delete('/:id/attachments/:attachmentId', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'I paautorizuar' });
  try {
    const access = await taskAccess(req.params.id, userId);
    if (!access.task || !access.canView) return res.status(404).json({ error: 'Skedari nuk u gjet' });
    const attachment = await prisma.attachment.findFirst({ where: { id: req.params.attachmentId, taskId: access.task.id } });
    if (!attachment) return res.status(404).json({ error: 'Skedari nuk u gjet' });
    if (attachment.uploadedById !== userId && access.task.createdById !== userId) {
      return res.status(403).json({ error: 'Vetëm ngarkuesi ose krijuesi i detyrës mund ta fshijë skedarin' });
    }
    await prisma.$transaction([
      prisma.notification.deleteMany({ where: { resourceType: 'ATTACHMENT', resourceId: attachment.id } }),
      prisma.attachment.delete({ where: { id: attachment.id } }),
      prisma.task.update({ where: { id: access.task.id }, data: { updatedAt: new Date() } }),
    ]);
    await removeTaskFiles([attachment.filePath]);
    return res.json({ message: 'Skedari u fshi me sukses' });
  } catch (error) {
    console.error('Delete attachment error:', error);
    return res.status(500).json({ error: 'Gabim gjatë fshirjes së skedarit' });
  }
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
    await prisma.task.update({ where: { id: access.task.id }, data: { updatedAt: new Date() } });
    await createTaskActivityNotifications(
      access.task,
      userId,
      `${comment.author.firstName} ${comment.author.lastName}`,
      'COMMENT',
      comment.id,
    );
    return res.status(201).json({ ...comment, author: { ...comment.author, role: comment.author.role.name } });
  } catch (error) {
    console.error('Create comment error:', error);
    return res.status(500).json({ error: 'Gabim gjatë krijimit të komentit' });
  }
});

router.delete('/:id/comments/:commentId', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'I paautorizuar' });
  try {
    const access = await taskAccess(req.params.id, userId);
    if (!access.task || !access.canView) return res.status(404).json({ error: 'Komenti nuk u gjet' });
    const comment = await prisma.comment.findFirst({ where: { id: req.params.commentId, taskId: access.task.id } });
    if (!comment) return res.status(404).json({ error: 'Komenti nuk u gjet' });
    if (comment.authorId !== userId && access.task.createdById !== userId) {
      return res.status(403).json({ error: 'Vetëm autori ose krijuesi i detyrës mund ta fshijë komentin' });
    }
    await prisma.$transaction([
      prisma.notification.deleteMany({ where: { resourceType: 'COMMENT', resourceId: comment.id } }),
      prisma.comment.delete({ where: { id: comment.id } }),
      prisma.task.update({ where: { id: access.task.id }, data: { updatedAt: new Date() } }),
    ]);
    return res.json({ message: 'Komenti u fshi me sukses' });
  } catch (error) {
    console.error('Delete comment error:', error);
    return res.status(500).json({ error: 'Gabim gjatë fshirjes së komentit' });
  }
});

router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'I paautorizuar' });
  const { title, description, status, priority, deadline } = req.body;
  const hasAssignmentUpdate = Array.isArray(req.body.assignedToIds) || req.body.assignedToId !== undefined;
  const assignedToIds = parseAssigneeIds(req.body.assignedToIds, req.body.assignedToId);
  const normalizedTitle = typeof title === 'string' ? title.trim() : undefined;
  const normalizedDescription = typeof description === 'string' ? description.trim() : undefined;
  if (status !== undefined && !isTaskStatus(status) || priority !== undefined && !isTaskPriority(priority)) return res.status(400).json({ error: 'Statusi ose prioriteti nuk është i vlefshëm' });
  if (hasAssignmentUpdate && assignedToIds.length === 0) return res.status(400).json({ error: 'Së paku një person i caktuar është i detyrueshëm' });
  if (hasAssignmentUpdate && assignedToIds.length > 100) return res.status(400).json({ error: 'Një detyrë mund t’u caktohet maksimumi 100 anëtarëve' });
  if (title !== undefined && (!normalizedTitle || normalizedTitle.length > 160)) return res.status(400).json({ error: 'Titulli duhet të ketë 1 deri në 160 karaktere' });
  if (description !== undefined && (normalizedDescription === undefined || normalizedDescription.length > 10_000)) return res.status(400).json({ error: 'Përshkrimi mund të ketë maksimumi 10000 karaktere' });
  const parsedDeadline = deadline === undefined ? undefined : parseTaskDeadline(deadline);
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
        ...(normalizedTitle !== undefined && { title: normalizedTitle }),
        ...(normalizedDescription !== undefined && { description: normalizedDescription }),
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
    await prisma.$transaction([
      prisma.notification.deleteMany({ where: { taskId: access.task.id } }),
      prisma.task.delete({ where: { id: access.task.id } }),
    ]);
    await removeTaskFiles(attachments.map((attachment) => attachment.filePath));
    return res.json({ message: 'Detyra u fshi me sukses' });
  } catch (error) { console.error('Delete task error:', error); return res.status(500).json({ error: 'Gabim gjatë fshirjes së detyrës' }); }
});

export default router;
