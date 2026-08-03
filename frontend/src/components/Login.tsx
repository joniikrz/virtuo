import React, { useState } from 'react';
import { LogIn, UserCheck, ShieldAlert } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  }) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [isSetupMode, setIsSetupMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isSetupMode ? '/api/auth/setup' : '/api/auth/login';
      const body = isSetupMode 
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

      if (isSetupMode) {
        setSuccessMsg('Sistemi u inicializua me sukses! Tani mund të kyçeni.');
        setIsSetupMode(false);
        setPassword('');
      } else {
        onLoginSuccess(data.user);
      }
    } catch (err: any) {
      setError(err.message || 'Gabim lidhjeje me serverin');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="logo-header">
          <h1>Virtuo</h1>
          <p>{isSetupMode ? 'Konfigurimi Fillestar i Administratorit' : 'Sistemi i Menaxhimit të Detyrave'}</p>
        </div>

        {error && (
          <div style={{
            backgroundColor: 'hsl(var(--accent-danger) / 0.15)',
            border: '1px solid hsl(var(--accent-danger) / 0.3)',
            color: 'hsl(var(--accent-danger))',
            padding: '12px',
            borderRadius: 'var(--border-radius-sm)',
            marginBottom: '20px',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <ShieldAlert size={16} />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div style={{
            backgroundColor: 'hsl(var(--accent-success) / 0.15)',
            border: '1px solid hsl(var(--accent-success) / 0.3)',
            color: 'hsl(var(--accent-success))',
            padding: '12px',
            borderRadius: 'var(--border-radius-sm)',
            marginBottom: '20px',
            fontSize: '0.85rem',
            textAlign: 'center'
          }}>
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {isSetupMode && (
            <>
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
            </>
          )}

          <div className="form-group">
            <label htmlFor="email">Email Adresa</label>
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
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: '10px' }}>
            {loading ? (
              <span>Duke u procesuar...</span>
            ) : isSetupMode ? (
              <>
                <UserCheck size={18} />
                <span>Krijo Administratorin</span>
              </>
            ) : (
              <>
                <LogIn size={18} />
                <span>Kyçu në Sistem</span>
              </>
            )}
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <button
            onClick={() => {
              setIsSetupMode(!isSetupMode);
              setError('');
              setSuccessMsg('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'hsl(var(--text-secondary))',
              fontSize: '0.85rem',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            {isSetupMode ? 'Kthehu te Hyrja (Login)' : 'Inicializimi i parë? Krijo llogarinë Admin'}
          </button>
        </div>
      </div>
    </div>
  );
}