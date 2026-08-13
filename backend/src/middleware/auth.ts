import { Request, Response, NextFunction } from 'express';
import { AuthenticatedUser } from '../domain/auth/authenticated-user';
import { application } from '../composition-root';


export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
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
    const result = await application.authenticateSession.execute(token);
    if (result.ok === false) {
      if (result.reason === 'USER_NOT_FOUND') {
        res.status(401).json({ error: 'Përdoruesi nuk u gjet ose është fshirë' });
        return;
      }
      if (result.reason === 'SESSION_EXPIRED') {
        res.status(401).json({ error: 'Sesioni ka skaduar. Ju lutem kyçuni përsëri.' });
        return;
      }
      res.status(403).json({ error: 'Token i pavlefshëm ose i skaduar' });
      return;
    }

    req.user = result.user;

    next();
  } catch {
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
