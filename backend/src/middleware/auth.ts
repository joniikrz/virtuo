import { Request, Response, NextFunction } from 'express';
import { AuthenticatedUser } from '../domain/auth/authenticated-user';
import { application } from '../composition-root';


export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

function requestToken(req: Request): string | undefined {
  const cookieToken = req.cookies?.token;
  if (typeof cookieToken === 'string' && cookieToken) return cookieToken;
  const authorization = req.headers.authorization;
  return authorization?.startsWith('Bearer ') ? authorization.substring(7) : undefined;
}

export const optionalAuthenticateToken = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  const token = requestToken(req);
  if (!token) return next();
  try {
    const result = await application.authenticateSession.execute(token);
    if (result.ok) req.user = result.user;
  } catch {
    // A session probe is allowed to resolve as anonymous.
  }
  next();
};

/**
 * JWT authentication middleware.
 */
export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const token = requestToken(req);

  if (!token) {
    res.status(401).json({ error: 'You are not authorized. Please sign in.' });
    return;
  }

  try {
    const result = await application.authenticateSession.execute(token);
    if (result.ok === false) {
      if (result.reason === 'USER_NOT_FOUND') {
        res.status(401).json({ error: 'The user was not found or has been deleted.' });
        return;
      }
      if (result.reason === 'SESSION_EXPIRED') {
        res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
        return;
      }
      res.status(403).json({ error: 'Invalid or expired token.' });
      return;
    }

    req.user = result.user;

    next();
  } catch {
    res.status(403).json({ error: 'Invalid or expired token.' });
    return;
  }
};

/**
 * Restrict access to administrators.
 */
export const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user || req.user.role !== 'ADMIN') {
    res.status(403).json({ error: 'You do not have administrative permission for this action.' });
    return;
  }
  next();
};
