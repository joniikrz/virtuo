import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma';
import { verifyToken } from '../security';


export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    emailNotifications: boolean;
    inAppNotifications: boolean;
    hasRecoveryCode: boolean;
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
    const decoded = verifyToken(token) as { userId?: string; sessionVersion?: number };
    if (!decoded.userId) {
      res.status(401).json({ error: 'Sesioni nuk është i vlefshëm' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { role: true },
    });

    if (!user) {
      res.status(401).json({ error: 'Përdoruesi nuk u gjet ose është fshirë' });
      return;
    }

    if ((decoded.sessionVersion ?? 0) !== user.sessionVersion) {
      res.status(401).json({ error: 'Sesioni ka skaduar. Ju lutem kyçuni përsëri.' });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role.name,
      emailNotifications: user.emailNotifications,
      inAppNotifications: user.inAppNotifications,
      hasRecoveryCode: Boolean(user.recoveryCodeHash),
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
