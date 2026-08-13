import { AuthenticatedUser } from '../../domain/auth/authenticated-user';

export interface SessionClaims {
  userId?: string;
  sessionVersion?: number;
}

export interface SessionTokenVerifierPort {
  verify(token: string): SessionClaims;
}

export interface SessionUserRecord extends AuthenticatedUser {
  sessionVersion: number;
}

export interface SessionUserRepositoryPort {
  findById(userId: string): Promise<SessionUserRecord | null>;
}

