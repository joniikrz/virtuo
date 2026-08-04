import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'virtuo-dev-secret-do-not-use-in-production';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  };
}

/**
 * Middleware për verifikimin e Token-it JWT
 */
export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Lexo tokenin nga Cookie ose nga Header-i Authorization
  let token = req.cookies?.token;

  if (!token && req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) {
    res.status(401).json({ error: 'Nuk jeni i autorizuar. Ju lutem kyçuni.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { role: true },
    });

    if (!user) {
      res.status(401).json({ error: 'Përdoruesi nuk u gjet ose është fshirë' });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role.name,
    };

    next();
  } catch (error) {
    res.status(403).json({ error: 'Token i pavlefshëm ose i skaduar' });
    return;
  }
};

/**
 * Middleware që kufizon qasjen vetëm për rolin ADMIN
 */
export const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user || req.user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Nuk keni leje administrative për këtë veprim' });
    return;
  }
  next();
};