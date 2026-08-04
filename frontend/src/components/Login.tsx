import React, { useState } from 'react';
import { LogIn, UserPlus, ShieldAlert } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  }) => void;
}

type AuthMode = 'login' | 'register';

export default function Login({ onLoginSuccess }: LoginProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const body =
        mode === 'register'
          ? { email, password, firstName, lastName }
          : { email, password };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ndodhi një gabim gjatë procesit');
      }

      onLoginSuccess(data.user);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gabim lidhjeje me serverin';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError('');
    setPassword('');
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="logo-header">
          <div className="trello-logo-mark">V</div>
          <h1>Virtuo</h1>
          <p>{mode === 'register' ? 'Krijo llogarinë tënde' : 'Menaxho detyrat si në Trello'}</p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => switchMode('login')}
          >
            Kyçu
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => switchMode('register')}
          >
            Regjistrohu
          </button>
        </div>

        {error && (
          <div className="alert alert-error">
            <ShieldAlert size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'register' && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="firstName">Emri</label>
                  <input
                    type="text"
                    id="firstName"
                    className="input-field"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Filan"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="lastName">Mbiemri</label>
                  <input
                    type="text"
                    id="lastName"
                    className="input-field"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Fisteku"
                    required
                  />
                </div>
              </div>
            </>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="emri@kompania.com"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Fjalëkalimi</label>
            <input
              type="password"
              id="password"
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={mode === 'register' ? 6 : undefined}
            />
          </div>

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? (
              'Duke u procesuar...'
            ) : mode === 'register' ? (
              <>
                <UserPlus size={18} />
                <span>Krijo llogarinë</span>
              </>
            ) : (
              <>
                <LogIn size={18} />
                <span>Kyçu</span>
              </>
            )}
          </button>
        </form>

        {mode === 'login' ? (
          <div className="auth-hint">
            <span>Kredencialet e Adminit të para-konfiguruar:</span>
            <div className="admin-creds">
              <code>admin@virtuo.local</code> / <code>Admin123!</code>
              <button
                type="button"
                className="btn-link"
                onClick={() => {
                  setEmail('admin@virtuo.local');
                  setPassword('Admin123!');
                }}
              >
                Plotëso automatikisht
              </button>
            </div>
          </div>
        ) : (
          <p className="auth-hint">
            Me regjistrimin e llogarisë tënde mund të krijosh bordet e tua, të ftosh anëtarë të ekipit dhe të menaxhosh kartat si në Trello!
          </p>
        )}
      </div>
    </div>
  );
}
