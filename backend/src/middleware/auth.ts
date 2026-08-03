import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string; // "ADMIN" ose "USER"
    firstName: string;
    lastName: string;
  };
}

const JWT_SECRET = process.env.JWT_SECRET || 'virtuo-super-secret-key-12345';

/**
 * Middleware për autentikimin e përdoruesit përmes JWT.
 * Kontrollon fillimisht Cookie-n e sigurt HTTP-Only, pastaj header-in Authorization.
 */
export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction): Promise<any> {
  let token = req.cookies?.token;

  if (!token && req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Mungon tokeni i autentikimit (Qasje e paautorizuar)' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

    // Gjej përdoruesin dhe rolin e tij në databazë
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { role: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'Përdoruesi nuk ekziston më në sistem' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role.name,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    return next(); // ✅ Ndryshuar: Shtuar 'return'
  } catch (_error) { // ✅ Ndryshuar: _error me vizë poshtë që të mos ankohet TS6133
    return res.status(403).json({ error: 'Token i pavlefshëm ose i skaduar' });
  }
}

/**
 * Middleware që lejon qasjen vetëm për rolin ADMIN (Shefat/Menaxherët).
 */
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): any {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Nuk keni privilegje të mjaftueshme për këtë veprim (Kërkohet rolin Admin)' });
  }
  return next(); // ✅ Ndryshuar: Shtuar 'return'
}