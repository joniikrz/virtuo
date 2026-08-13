import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import prisma from '../prisma';
import { authenticateToken, optionalAuthenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { logActivity } from '../services/activity';
import {
  BCRYPT_ROUNDS,
  clearSessionCookie,
  cleanName,
  passwordError,
  RECOVERY_CODE_MAX_LENGTH,
  RECOVERY_CODE_MIN_LENGTH,
  setSessionCookie,
  signPasswordResetToken,
  signSessionToken,
  validName,
  verifyToken,
} from '../security';

const router = Router();
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Keeps response timing similar when an email does not exist without storing a real secret.
const DUMMY_BCRYPT_HASH = '$2a$12$cjgdfWrwg6sC61y2maoHR.If12dicf/GR9TMif4SAiYPLuonTud1y';
const uploadDirectory = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));

function publicUser(user: any, roleName?: string) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: roleName || user.role?.name,
    emailNotifications: user.emailNotifications ?? true,
    inAppNotifications: user.inAppNotifications ?? true,
    hasRecoveryCode: Boolean(user.recoveryCodeHash),
  };
}

function validRecoveryCode(value: unknown): value is string {
  return typeof value === 'string' && value.length >= RECOVERY_CODE_MIN_LENGTH && value.length <= RECOVERY_CODE_MAX_LENGTH;
}

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase().slice(0, 255) : '';
}

async function removeUserFiles(filePaths: string[]): Promise<void> {
  await Promise.all(filePaths.map(async (filePath) => {
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(`${uploadDirectory}${path.sep}`)) return;
    await fs.promises.unlink(resolvedPath).catch(() => undefined);
  }));
}

/**
 * POST /api/auth/login
 * Sign in.
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { password } = req.body;
  const email = normalizeEmail(req.body.email);

  if (!email || typeof password !== 'string' || !password || password.length > 128) {
    res.status(400).json({ error: 'Please enter your email and password' });
    return;
  }

  if (!EMAIL_REGEX.test(email)) {
    res.status(400).json({ error: 'The email address is invalid' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });

    const isMatch = await bcrypt.compare(password, user?.passwordHash || DUMMY_BCRYPT_HASH);
    if (!user || !isMatch) {
      res.status(401).json({ error: 'The email or password is incorrect' });
      return;
    }

    const token = signSessionToken(user.id, user.sessionVersion);
    await logActivity(user.id, 'LOGIN', 'Signed in');
    setSessionCookie(res, token);

    res.json({
      user: publicUser(user),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'A server error occurred while signing in' });
  }
});

/**
 * POST /api/auth/logout
 * Dalja nga sistemi (Logout)
 */
router.post('/logout', (req: Request, res: Response): void => {
  clearSessionCookie(res);
  res.json({ message: 'U larguat me sukses' });
});

/**
 * GET /api/auth/me
 * Return the current signed-in user profile.
 */
router.get('/me', optionalAuthenticateToken, (req: AuthRequest, res: Response): void => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ user: req.user || null });
});

/**
 * GET /api/auth/users
 * List all users.
 */
router.get('/users', authenticateToken, requireAdmin, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { firstName: 'asc' },
    });

    res.json(
      users.map((u) => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role.name,
      }))
    );
  } catch (error) {
    console.error('Fetch users error:', error);
    res.status(500).json({ error: 'An error occurred while retrieving users' });
  }
});

/**
 * POST /api/auth/register
 * Public registration for new users.
 */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { password, recoveryCode } = req.body;
  const firstName = cleanName(req.body.firstName);
  const lastName = cleanName(req.body.lastName);
  const email = normalizeEmail(req.body.email);

  if (!email || !password || !firstName || !lastName || !recoveryCode) {
    res.status(400).json({ error: 'All fields are required' });
    return;
  }

  if (!EMAIL_REGEX.test(email)) {
    res.status(400).json({ error: 'The email address is invalid' });
    return;
  }

  if (!validName(firstName) || !validName(lastName)) {
    res.status(400).json({ error: 'First and last name must contain between 1 and 60 characters' });
    return;
  }

  const invalidPassword = passwordError(password);
  if (invalidPassword) {
    res.status(400).json({ error: invalidPassword });
    return;
  }

  if (!validRecoveryCode(recoveryCode)) {
    res.status(400).json({ error: `The recovery code must contain between ${RECOVERY_CODE_MIN_LENGTH} and ${RECOVERY_CODE_MAX_LENGTH} characters` });
    return;
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ error: 'An account with this email already exists' });
      return;
    }

    const userRole = await prisma.role.findUnique({ where: { name: 'USER' } });
    if (!userRole) {
      res.status(500).json({ error: 'The USER role does not exist. Restart the server.' });
      return;
    }

    const [passwordHash, recoveryCodeHash] = await Promise.all([
      bcrypt.hash(password, BCRYPT_ROUNDS),
      bcrypt.hash(recoveryCode, BCRYPT_ROUNDS),
    ]);
    const newUser = await prisma.user.create({
      data: {
        email,
        passwordHash,
        recoveryCodeHash,
        firstName,
        lastName,
        roleId: userRole.id,
      },
      include: { role: true },
    });

    const token = signSessionToken(newUser.id, newUser.sessionVersion);
    setSessionCookie(res, token);

    res.status(201).json({
      message: 'Regjistrimi u krye me sukses',
      user: publicUser(newUser),
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'An error occurred during registration' });
  }
});

/**
 * POST /api/auth/setup
 * Create roles and the first administrator when no users exist.
 */
router.post('/setup', async (req: Request, res: Response): Promise<void> => {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_INITIAL_SETUP !== 'true') {
    res.status(404).json({ error: 'Endpoint not found' });
    return;
  }

  const { password, recoveryCode } = req.body;
  const firstName = cleanName(req.body.firstName);
  const lastName = cleanName(req.body.lastName);
  const email = normalizeEmail(req.body.email);

  if (!email || !password || !firstName || !lastName || !recoveryCode) {
    res.status(400).json({ error: 'All fields are required for initial registration' });
    return;
  }

  if (!EMAIL_REGEX.test(email)) {
    res.status(400).json({ error: 'The email address is invalid' });
    return;
  }

  if (!validName(firstName) || !validName(lastName)) {
    res.status(400).json({ error: 'First and last name must contain between 1 and 60 characters' });
    return;
  }

  const invalidPassword = passwordError(password);
  if (invalidPassword) {
    res.status(400).json({ error: invalidPassword });
    return;
  }

  if (!validRecoveryCode(recoveryCode)) {
    res.status(400).json({ error: `The recovery code must contain between ${RECOVERY_CODE_MIN_LENGTH} and ${RECOVERY_CODE_MAX_LENGTH} characters` });
    return;
  }

  try {
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      res.status(400).json({ error: 'The system is already configured. Initial setup is no longer available.' });
      return;
    }

    const adminRole = await prisma.role.upsert({
      where: { name: 'ADMIN' },
      update: {},
      create: { name: 'ADMIN', description: 'Menaxheri / Shefi i cili krijon detyra dhe Spaces' },
    });

    await prisma.role.upsert({
      where: { name: 'USER' },
      update: {},
      create: { name: 'USER', description: 'Standard team member with a personal task list' },
    });

    const [passwordHash, recoveryCodeHash] = await Promise.all([
      bcrypt.hash(password, BCRYPT_ROUNDS),
      bcrypt.hash(recoveryCode, BCRYPT_ROUNDS),
    ]);
    const initialAdmin = await prisma.user.create({
      data: {
        email,
        passwordHash,
        recoveryCodeHash,
        firstName,
        lastName,
        roleId: adminRole.id,
      },
      include: { role: true },
    });

    const token = signSessionToken(initialAdmin.id, initialAdmin.sessionVersion);
    setSessionCookie(res, token);

    res.status(201).json({
      message: 'Sistemi u inicializua me sukses',
      user: publicUser(initialAdmin),
    });
  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).json({ error: 'An error occurred during system setup' });
  }
});

/**
 * POST /api/auth/register-user
 * Create a user as an administrator.
 */
router.post('/register-user', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { password, roleName, recoveryCode } = req.body;
  const firstName = cleanName(req.body.firstName);
  const lastName = cleanName(req.body.lastName);
  const email = normalizeEmail(req.body.email);

  if (!email || !password || !firstName || !lastName || !roleName || !recoveryCode) {
    res.status(400).json({ error: 'All fields are required' });
    return;
  }

  if (!EMAIL_REGEX.test(email)) {
    res.status(400).json({ error: 'The email address is invalid' });
    return;
  }

  if (!validName(firstName) || !validName(lastName)) {
    res.status(400).json({ error: 'First and last name must contain between 1 and 60 characters' });
    return;
  }

  const invalidPassword = passwordError(password);
  if (invalidPassword) {
    res.status(400).json({ error: invalidPassword });
    return;
  }

  if (!validRecoveryCode(recoveryCode)) {
    res.status(400).json({ error: `The recovery code must contain between ${RECOVERY_CODE_MIN_LENGTH} and ${RECOVERY_CODE_MAX_LENGTH} characters` });
    return;
  }

  if (roleName !== 'ADMIN' && roleName !== 'USER') {
    res.status(400).json({ error: 'Invalid role. Only ADMIN or USER is allowed' });
    return;
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ error: 'An account with this email already exists' });
      return;
    }

    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      res.status(400).json({ error: 'The requested role does not exist' });
      return;
    }

    const [passwordHash, recoveryCodeHash] = await Promise.all([
      bcrypt.hash(password, BCRYPT_ROUNDS),
      bcrypt.hash(recoveryCode, BCRYPT_ROUNDS),
    ]);
    const newUser = await prisma.user.create({
      data: {
        email,
        passwordHash,
        recoveryCodeHash,
        firstName,
        lastName,
        roleId: role.id,
      },
      include: { role: true },
    });

    res.status(201).json({
      message: 'User created successfully',
      user: publicUser(newUser, role.name),
    });
  } catch (error) {
    console.error('Register user error:', error);
    res.status(500).json({ error: 'An error occurred while creating the user' });
  }
});

/**
 * PUT /api/auth/change-password
 * Change password.
 */
router.put('/change-password', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const { currentPassword, newPassword } = req.body;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || !currentPassword || !newPassword) {
    res.status(400).json({ error: 'The current and new passwords are required' });
    return;
  }

  const invalidPassword = passwordError(newPassword);
  if (invalidPassword) {
    res.status(400).json({ error: invalidPassword });
    return;
  }

  if (newPassword === currentPassword) {
    res.status(400).json({ error: 'The new password must be different from the current password' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      res.status(400).json({ error: 'The current password is incorrect' });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    const nextSessionVersion = (user.sessionVersion ?? 0) + 1;
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash, sessionVersion: nextSessionVersion },
    });

    setSessionCookie(res, signSessionToken(userId, nextSessionVersion));

    await logActivity(userId, 'PASSWORD_CHANGED', 'Changed password');

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'An error occurred while changing the password' });
  }
});

/**
 * PUT /api/auth/users/:id/password
 * Allow an administrator to reset a user's password and revoke older sessions.
 */
router.put('/users/:id/password', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const adminId = req.user?.id;
  const targetUserId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
  const { newPassword } = req.body;

  if (!adminId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (!targetUserId || typeof newPassword !== 'string') {
    res.status(400).json({ error: 'The user and new password are required' });
    return;
  }
  if (targetUserId === adminId) {
    res.status(400).json({ error: 'Use the Security section for your own account' });
    return;
  }

  const invalidPassword = passwordError(newPassword);
  if (invalidPassword) {
    res.status(400).json({ error: invalidPassword });
    return;
  }

  try {
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    if (!targetUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await prisma.user.update({
      where: { id: targetUser.id },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });

    await Promise.all([
      logActivity(adminId, 'ADMIN_PASSWORD_RESET', `Changed the password for ${targetUser.email}`),
      logActivity(targetUser.id, 'PASSWORD_RESET_BY_ADMIN', 'Password changed by an administrator'),
    ]);

    res.json({
      message: `The password for ${targetUser.firstName} ${targetUser.lastName} was changed. Older sessions were revoked.`,
    });
  } catch (error) {
    console.error('Admin password reset error:', error);
    res.status(500).json({ error: 'An error occurred while changing the password' });
  }
});

/**
 * DELETE /api/auth/users/:id
 * Delete an account and its related data after verifying the administrator password.
 */
router.delete('/users/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const adminId = req.user?.id;
  const targetUserId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
  const currentPassword = req.body?.currentPassword;

  if (!adminId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (!targetUserId || typeof currentPassword !== 'string' || !currentPassword) {
    res.status(400).json({ error: 'The user and current administrator password are required' });
    return;
  }
  if (targetUserId === adminId) {
    res.status(400).json({ error: 'You cannot delete the account you are currently using' });
    return;
  }

  try {
    const [admin, targetUser] = await Promise.all([
      prisma.user.findUnique({ where: { id: adminId }, select: { passwordHash: true } }),
      prisma.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, email: true, firstName: true, lastName: true },
      }),
    ]);
    if (!admin || !(await bcrypt.compare(currentPassword, admin.passwordHash))) {
      res.status(400).json({ error: 'The current administrator password is incorrect' });
      return;
    }
    if (!targetUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const ownedSpaces = await prisma.space.findMany({
      where: { createdById: targetUser.id },
      select: { id: true },
    });
    const ownedSpaceIds = ownedSpaces.map((space) => space.id);
    const affectedTasks = await prisma.task.findMany({
      where: { OR: [{ createdById: targetUser.id }, { spaceId: { in: ownedSpaceIds } }] },
      select: { id: true },
    });
    const affectedTaskIds = affectedTasks.map((task) => task.id);
    const [attachments, comments] = await Promise.all([
      prisma.attachment.findMany({
        where: { OR: [{ uploadedById: targetUser.id }, { taskId: { in: affectedTaskIds } }] },
        select: { id: true, filePath: true },
      }),
      prisma.comment.findMany({
        where: { authorId: targetUser.id },
        select: { id: true },
      }),
    ]);

    await prisma.$transaction([
      prisma.notification.deleteMany({
        where: {
          OR: [
            { taskId: { in: affectedTaskIds } },
            { resourceType: 'ATTACHMENT', resourceId: { in: attachments.map((item) => item.id) } },
            { resourceType: 'COMMENT', resourceId: { in: comments.map((item) => item.id) } },
          ],
        },
      }),
      prisma.user.delete({ where: { id: targetUser.id } }),
    ]);
    await removeUserFiles(attachments.map((attachment) => attachment.filePath));
    await logActivity(adminId, 'ADMIN_USER_DELETED', `Deleted the account ${targetUser.email}`);

    res.json({
      message: `The account for ${targetUser.firstName} ${targetUser.lastName} and its related data were deleted.`,
      deletedUserId: targetUser.id,
    });
  } catch (error) {
    console.error('Admin delete user error:', error);
    res.status(500).json({ error: 'An error occurred while deleting the account' });
  }
});

router.put('/profile', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const firstName = cleanName(req.body.firstName);
  const lastName = cleanName(req.body.lastName);
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const currentPassword = req.body.currentPassword;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (!firstName || !lastName || !email || typeof currentPassword !== 'string') {
    res.status(400).json({ error: 'First name, last name, email, and current password are required' });
    return;
  }
  if (!validName(firstName) || !validName(lastName) || email.length > 254 || !EMAIL_REGEX.test(email)) {
    res.status(400).json({ error: 'The profile details are invalid' });
    return;
  }

  try {
    const [currentUser, existing] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.user.findUnique({ where: { email } }),
    ]);
    if (!currentUser || !(await bcrypt.compare(currentPassword, currentUser.passwordHash))) {
      res.status(400).json({ error: 'The current password is incorrect' });
      return;
    }
    if (existing && existing.id !== userId) {
      res.status(409).json({ error: 'This email is used by another account' });
      return;
    }
    const user = await prisma.user.update({
      where: { id: userId },
      data: { firstName, lastName, email },
      include: { role: true },
    });
    await logActivity(userId, 'PROFILE_UPDATED', 'Updated profile details');
    res.json({ message: 'Profile updated successfully', user: publicUser(user) });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'An error occurred while updating the profile' });
  }
});

router.put('/preferences', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const { emailNotifications, inAppNotifications } = req.body;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (typeof emailNotifications !== 'boolean' || typeof inAppNotifications !== 'boolean') {
    res.status(400).json({ error: 'Notification preferences are invalid' });
    return;
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { emailNotifications, inAppNotifications },
      include: { role: true },
    });
    await logActivity(userId, 'NOTIFICATION_SETTINGS', 'Updated notification preferences');
    res.json({ message: 'Preferences saved', user: publicUser(user) });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'An error occurred while saving preferences' });
  }
});

router.get('/activity', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const activities = await prisma.activityLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ activities });
  } catch (error) {
    console.error('Activity history error:', error);
    res.status(500).json({ error: 'An error occurred while retrieving activity history' });
  }
});

router.put('/recovery-code', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const { currentPassword, recoveryCode } = req.body;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (typeof currentPassword !== 'string' || !validRecoveryCode(recoveryCode)) {
    res.status(400).json({ error: `Enter your current password and a recovery code containing ${RECOVERY_CODE_MIN_LENGTH} to ${RECOVERY_CODE_MAX_LENGTH} characters` });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      res.status(400).json({ error: 'The current password is incorrect' });
      return;
    }
    const recoveryCodeHash = await bcrypt.hash(recoveryCode, BCRYPT_ROUNDS);
    await prisma.user.update({ where: { id: userId }, data: { recoveryCodeHash } });
    await logActivity(userId, 'RECOVERY_CODE_UPDATED', 'Changed recovery code');
    res.json({ message: 'Recovery code saved successfully', hasRecoveryCode: true });
  } catch (error) {
    console.error('Recovery code update error:', error);
    res.status(500).json({ error: 'An error occurred while saving the recovery code' });
  }
});

router.post('/forgot-password/verify', async (req: Request, res: Response): Promise<void> => {
  const email = normalizeEmail(req.body.email);
  const recoveryCode = req.body.recoveryCode;
  if (!EMAIL_REGEX.test(email) || !validRecoveryCode(recoveryCode)) {
    res.status(400).json({ error: 'The email or recovery code is incorrect' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    const matches = await bcrypt.compare(recoveryCode, user?.recoveryCodeHash || DUMMY_BCRYPT_HASH);
    if (!user || !matches) {
    res.status(400).json({ error: 'The email or recovery code is incorrect' });
      return;
    }
    const resetToken = signPasswordResetToken(user.id, user.sessionVersion);
    res.json({ resetToken });
  } catch (error) {
    console.error('Forgot password verification error:', error);
    res.status(500).json({ error: 'An error occurred during verification' });
  }
});

router.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
  const { resetToken, newPassword } = req.body;
  const invalidPassword = passwordError(newPassword);
  if (typeof resetToken !== 'string' || invalidPassword) {
    res.status(400).json({ error: invalidPassword || 'The recovery token is required' });
    return;
  }

  try {
    const payload = verifyToken(resetToken) as { userId?: string; purpose?: string; sessionVersion?: number };
    if (!payload.userId || payload.purpose !== 'password-reset' || typeof payload.sessionVersion !== 'number') {
      res.status(400).json({ error: 'The recovery request is invalid' });
      return;
    }
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    const updated = await prisma.user.updateMany({
      where: { id: payload.userId, sessionVersion: payload.sessionVersion },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });
    if (updated.count !== 1) {
      res.status(400).json({ error: 'This recovery token has already been used or has expired' });
      return;
    }
    await logActivity(payload.userId, 'PASSWORD_RESET', 'Reset password with a recovery code');
    res.json({ message: 'Password reset successfully. You can now sign in.' });
  } catch (error) {
    res.status(400).json({ error: 'The recovery request has expired or is invalid' });
  }
});

export default router;
