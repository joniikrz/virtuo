import { AuthenticatedUser } from '../../domain/auth/authenticated-user';
import { SessionTokenVerifierPort, SessionUserRepositoryPort } from './ports';

export type AuthenticationFailure = 'INVALID_TOKEN' | 'USER_NOT_FOUND' | 'SESSION_EXPIRED';

export type AuthenticationResult =
  | { ok: true; user: AuthenticatedUser }
  | { ok: false; reason: AuthenticationFailure };

export class AuthenticateSession {
  constructor(
    private readonly users: SessionUserRepositoryPort,
    private readonly tokens: SessionTokenVerifierPort,
  ) {}

  async execute(token: string): Promise<AuthenticationResult> {
    let claims;
    try {
      claims = this.tokens.verify(token);
    } catch {
      return { ok: false, reason: 'INVALID_TOKEN' };
    }
    if (!claims.userId) return { ok: false, reason: 'INVALID_TOKEN' };

    const user = await this.users.findById(claims.userId);
    if (!user) return { ok: false, reason: 'USER_NOT_FOUND' };
    if ((claims.sessionVersion ?? 0) !== user.sessionVersion) {
      return { ok: false, reason: 'SESSION_EXPIRED' };
    }

    const { sessionVersion: _sessionVersion, ...authenticatedUser } = user;
    return { ok: true, user: authenticatedUser };
  }
}

