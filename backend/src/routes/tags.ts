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
    res.status(500).json({ error: 'An error occurred while retrieving tags' });
  }
});

/**
 * POST /api/tags
 * Krijon një tag të ri (Vetëm Admin)
 */
router.post('/tags', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const color = typeof req.body.color === 'string' ? req.body.color.trim() : '#6366f1';

  if (!name || name.length > 50) {
    res.status(400).json({ error: 'The tag name must contain between 1 and 50 characters' });
    return;
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    res.status(400).json({ error: 'The tag colour is invalid' });
    return;
  }

  try {
    const existing = await prisma.tag.findUnique({ where: { name } });
    if (existing) {
      res.status(400).json({ error: 'This tag already exists' });
      return;
    }

    const tag = await prisma.tag.create({
      data: { name, color },
    });

    res.status(201).json(tag);
  } catch (error) {
    console.error('Create tag error:', error);
    res.status(500).json({ error: 'An error occurred while creating the tag' });
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
    res.status(400).json({ error: 'A tag ID is required' });
    return;
  }

  try {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const tag = await prisma.tag.findUnique({ where: { id: tagId } });
    if (!tag) {
      res.status(404).json({ error: 'Tag not found' });
      return;
    }

    const taskTag = await prisma.taskTag.create({
      data: { taskId, tagId },
    });

    res.status(201).json(taskTag);
  } catch (error) {
    console.error('Add tag to task error:', error);
    res.status(500).json({ error: 'An error occurred' });
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

    res.json({ message: 'Tag removed successfully' });
  } catch (error) {
    console.error('Remove tag from task error:', error);
    res.status(500).json({ error: 'An error occurred' });
  }
});

export default router;
