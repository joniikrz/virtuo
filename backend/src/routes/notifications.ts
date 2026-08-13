import { Router, Response } from 'express';
import prisma from '../prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /api/notifications
 * Merr njoftimet e përdoruesit
 */
router.get('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: 'I paautorizuar' });
    return;
  }

  try {
    const [latestNotification, unreadCount, totalCount] = await prisma.$transaction([
      prisma.notification.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, createdAt: true },
      }),
      prisma.notification.count({ where: { userId, isRead: false } }),
      prisma.notification.count({ where: { userId } }),
    ]);
    const etag = `W/"notifications-${latestNotification?.id || 'none'}-${unreadCount}-${totalCount}"`;
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'private, no-cache');
    if (req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error('Fetch notifications error:', error);
    res.status(500).json({ error: 'An error occurred while retrieving notifications' });
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Shënon një njoftim si të lexuar
 */
router.patch('/:id/read', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  const notificationId = req.params.id;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: 'I paautorizuar' });
    return;
  }

  try {
    const updated = await prisma.notification.updateMany({
      where: { id: notificationId, userId, isRead: false },
      data: { isRead: true },
    });

    if (updated.count === 0) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }
    res.json({ id: notificationId, isRead: true });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'An error occurred' });
  }
});

/**
 * PATCH /api/notifications/read-all
 * Shënon të gjitha njoftimet si të lexuara
 */
router.patch('/read-all', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: 'I paautorizuar' });
    return;
  }

  try {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ error: 'An error occurred' });
  }
});

/**
 * DELETE /api/notifications/:id
 * Heq një njoftim të vjetër vetëm për përdoruesin aktual.
 */
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'I paautorizuar' });
    return;
  }

  try {
    const deleted = await prisma.notification.deleteMany({
      where: { id: req.params.id, userId },
    });
    if (deleted.count === 0) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }
    res.json({ message: 'Notification removed' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'The notification could not be removed' });
  }
});

export default router;
