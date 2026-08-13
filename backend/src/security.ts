import { Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;
export const RECOVERY_CODE_MIN_LENGTH = 10;
export const RECOVERY_CODE_MAX_LENGTH = 64;
export const JWT_ISSUER = 'virtuo-api';
export const JWT_AUDIENCE = 'virtuo-web';

const production = process.env.NODE_ENV === 'production';
const configuredSecret = process.env.JWT_SECRET;

if (production && (!configuredSecret || configuredSecret.length < 32)) {
  throw new Error('JWT_SECRET must contain at least 32 characters in production');
}

export const JWT_SECRET = configuredSecret || 'virtuo-dev-secret-do-not-use-in-production';
export const BCRYPT_ROUNDS = Math.max(10, Math.min(Number(process.env.BCRYPT_ROUNDS) || 12, 14));

const commonPasswords = new Set([
  'password123!', 'admin123!', 'qwerty123!', '123456789012', 'virtuo123456',
]);

export function passwordError(value: unknown): string | null {
  if (typeof value !== 'string') return 'The password is invalid';
  if (value.length < PASSWORD_MIN_LENGTH) return `The password must contain at least ${PASSWORD_MIN_LENGTH} characters`;
  if (value.length > PASSWORD_MAX_LENGTH) return `The password can contain at most ${PASSWORD_MAX_LENGTH} characters`;
  if (commonPasswords.has(value.toLowerCase())) return 'Choose a stronger, less common password';
  return null;
}

export function signSessionToken(userId: string, sessionVersion: number): string {
  return jwt.sign(
    { userId, sessionVersion },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '12h', issuer: JWT_ISSUER, audience: JWT_AUDIENCE },
  );
}

export function signPasswordResetToken(userId: string, sessionVersion: number): string {
  return jwt.sign(
    { userId, sessionVersion, purpose: 'password-reset' },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '10m', issuer: JWT_ISSUER, audience: JWT_AUDIENCE },
  );
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET, {
    algorithms: ['HS256'],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  }) as JwtPayload;
}

const secureCookie = process.env.COOKIE_SECURE
  ? process.env.COOKIE_SECURE === 'true'
  : production;

const cookieOptions = {
  httpOnly: true,
  secure: secureCookie,
  sameSite: 'strict' as const,
  path: '/',
};

export function setSessionCookie(res: Response, token: string): void {
  res.cookie('token', token, {
    ...cookieOptions,
    maxAge: 12 * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie('token', cookieOptions);
}

export function cleanName(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

export function validName(value: string): boolean {
  return value.length >= 1 && value.length <= 60 && !/[\u0000-\u001f\u007f]/.test(value);
}
