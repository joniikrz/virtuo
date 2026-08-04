import React, { useState } from 'react';
import { Eye, EyeOff, LogIn, ShieldAlert, UserPlus } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (user: { id: string; email: string; firstName: string; lastName: string; role: string }) => void;
}

type AuthMode = 'login' | 'register';

export default function Login({ onLoginSuccess }: LoginProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError('');
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (mode === 'register' && password !== confirmPassword) {
      setError('Fjalëkalimet nuk përputhen.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(mode === 'register' ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(mode === 'register' ? { email: email.trim(), password, firstName: firstName.trim(), lastName: lastName.trim() } : { email: email.trim(), password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Nuk u krye kërkesa. Provo përsëri.');
      onLoginSuccess(data.user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gabim lidhjeje me serverin.');
    } finally {
      setLoading(false);
    }
  };

  const isRegister = mode === 'register';
  return (
    <main className="auth-wrapper">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="logo-header">
          <div className="trello-logo-mark" aria-hidden="true">V</div>
          <h1 id="auth-title">Virtuo</h1>
          <p>{isRegister ? 'Krijo një hapësirë të sigurt për ekipin tënd.' : 'Mirë se erdhe përsëri në hapësirën tënde të punës.'}</p>
        </div>

        <div className="auth-tabs" role="tablist" aria-label="Autentikimi">
          <button type="button" role="tab" aria-selected={!isRegister} className={`auth-tab ${!isRegister ? 'active' : ''}`} onClick={() => switchMode('login')}>Kyçu</button>
          <button type="button" role="tab" aria-selected={isRegister} className={`auth-tab ${isRegister ? 'active' : ''}`} onClick={() => switchMode('register')}>Regjistrohu</button>
        </div>

        {error && <div className="alert alert-error" role="alert"><ShieldAlert size={17} /><span>{error}</span></div>}

        <form onSubmit={handleSubmit} className="auth-form">
          {isRegister && (
            <div className="form-row">
              <div className="form-group"><label htmlFor="firstName">Emri</label><input id="firstName" className="input-field" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Filan" autoComplete="given-name" required /></div>
              <div className="form-group"><label htmlFor="lastName">Mbiemri</label><input id="lastName" className="input-field" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Fisteku" autoComplete="family-name" required /></div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input type="email" id="email" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="emri@kompania.com" autoComplete="email" required />
          </div>

          <div className="form-group">
            <div className="form-label-row"><label htmlFor="password">Fjalëkalimi</label>{isRegister && <span>Minimumi 6 karaktere</span>}</div>
            <div className="password-field">
              <input type={showPassword ? 'text' : 'password'} id="password" className="input-field" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Vendos fjalëkalimin" autoComplete={isRegister ? 'new-password' : 'current-password'} minLength={isRegister ? 6 : undefined} required />
              <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Fshih fjalëkalimin' : 'Shfaq fjalëkalimin'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
          </div>

          {isRegister && <div className="form-group"><label htmlFor="confirmPassword">Përsërit fjalëkalimin</label><input type={showPassword ? 'text' : 'password'} id="confirmPassword" className="input-field" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Përsërit fjalëkalimin" autoComplete="new-password" minLength={6} required /></div>}

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Duke u procesuar...' : isRegister ? <><UserPlus size={18} /><span>Krijo llogarinë</span></> : <><LogIn size={18} /><span>Kyçu në Virtuo</span></>}
          </button>
        </form>

        <p className="auth-hint">{isRegister ? 'Duke u regjistruar, pranon të përdorësh Virtuo vetëm për punën e ekipit tënd.' : 'Nuk ke llogari? Zgjidh “Regjistrohu” për të filluar.'}</p>
      </section>
    </main>
  );
}
