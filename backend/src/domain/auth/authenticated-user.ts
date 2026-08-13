export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  emailNotifications: boolean;
  inAppNotifications: boolean;
  hasRecoveryCode: boolean;
}

