import { Router, Response } from 'express';
import prisma from '../prisma';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /api/tags
 * Merr të gjitha tags
 */
router.get('/tags', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tags = await prisma.tag.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(tags);
  } catch (error) {
    console.error('Fetch tags error:', error);
    res.status(500).json({ error: 'Ndodhi një gabim gjatë marrjes së tags' });
  }
});

/**
 * POST /api/tags
 * Krijon një tag të ri (Vetëm Admin)
 */
router.post('/tags', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, color } = req.body;

  if (!name) {
    res.status(400).json({ error: 'Emri i tag është i detyrueshëm' });
    return;
  }

  try {
    const existing = await prisma.tag.findUnique({ where: { name } });
    if (existing) {
      res.status(400).json({ error: 'Ky tag ekziston tashmë' });
      return;
    }

    const tag = await prisma.tag.create({
      data: { name, color: color || '#6366f1' },
    });

    res.status(201).json(tag);
  } catch (error) {
    console.error('Create tag error:', error);
    res.status(500).json({ error: 'Ndodhi një gabim gjatë krijimit të tag' });
  }
});

/**
 * POST /api/tasks/:taskId/tags
 * Shton një tag në një detyrë (Vetëm Admin)
 */
router.post('/tasks/:taskId/tags', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { taskId } = req.params;
  const { tagId } = req.body;

  if (!tagId) {
    res.status(400).json({ error: 'ID e tag është e detyrueshme' });
    return;
  }

  try {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      res.status(404).json({ error: 'Detyra nuk u gjet' });
      return;
    }

    const tag = await prisma.tag.findUnique({ where: { id: tagId } });
    if (!tag) {
      res.status(404).json({ error: 'Tag nuk u gjet' });
      return;
    }

    const taskTag = await prisma.taskTag.create({
      data: { taskId, tagId },
    });

    res.status(201).json(taskTag);
  } catch (error) {
    console.error('Add tag to task error:', error);
    res.status(500).json({ error: 'Ndodhi një gabim' });
  }
});

/**
 * DELETE /api/tasks/:taskId/tags/:tagId
 * Heq një tag nga një detyrë (Vetëm Admin)
 */
router.delete('/tasks/:taskId/tags/:tagId', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { taskId, tagId } = req.params;

  try {
    await prisma.taskTag.delete({
      where: {
        taskId_tagId: { taskId, tagId },
      },
    });

    res.json({ message: 'Tag u hoq me sukses' });
  } catch (error) {
    console.error('Remove tag from task error:', error);
    res.status(500).json({ error: 'Ndodhi një gabim' });
  }
});

export default router;
