import React, { useState } from 'react';
import { ArrowLeft, Eye, EyeOff, KeyRound, LogIn, ShieldAlert, ShieldCheck, UserPlus } from 'lucide-react';
import { apiErrorMessage, readApiJson } from '../lib/api';
import { User } from '../types';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

type AuthMode = 'login' | 'register' | 'forgot' | 'reset';

export default function Login({ onLoginSuccess }: LoginProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError('');
    setSuccess('');
    setPassword('');
    setConfirmPassword('');
    if (next !== 'forgot') setRecoveryCode('');
  };

  const submitAuth = async () => {
    if (mode === 'register' && password !== confirmPassword) throw new Error('Fjalëkalimet nuk përputhen.');
    const isRegister = mode === 'register';
    const response = await fetch(isRegister ? '/api/auth/register' : '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(isRegister
        ? { email: email.trim(), password, firstName: firstName.trim(), lastName: lastName.trim(), recoveryCode }
        : { email: email.trim(), password }),
    });
    const data = await readApiJson<{ user?: User }>(response);
    if (!response.ok) throw new Error(apiErrorMessage(response, data, 'Nuk u krye kërkesa. Provo përsëri.'));
    if (!data.user) throw new Error('Përgjigje e pavlefshme nga serveri. Provo përsëri.');
    onLoginSuccess(data.user);
  };

  const submitRecovery = async () => {
    if (mode === 'forgot') {
      const response = await fetch('/api/auth/forgot-password/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ email: email.trim(), recoveryCode }),
      });
      const data = await readApiJson<{ resetToken?: string }>(response);
      if (!response.ok) throw new Error(apiErrorMessage(response, data, 'Verifikimi dështoi.'));
      if (!data.resetToken) throw new Error('Përgjigje e pavlefshme nga serveri.');
      setResetToken(data.resetToken);
      setRecoveryCode('');
      setMode('reset');
      setSuccess('Kodi u verifikua. Vendos fjalëkalimin e ri.');
      return;
    }

    if (password !== confirmPassword) throw new Error('Fjalëkalimet nuk përputhen.');
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ resetToken, newPassword: password }),
    });
    const data = await readApiJson<{ message?: string }>(response);
    if (!response.ok) throw new Error(apiErrorMessage(response, data, 'Rivendosja dështoi.'));
    setMode('login');
    setResetToken('');
    setPassword('');
    setConfirmPassword('');
    setSuccess(data.message || 'Fjalëkalimi u rivendos. Tani mund të kyçeni.');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      if (mode === 'forgot' || mode === 'reset') await submitRecovery();
      else await submitAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nuk u lidhëm me serverin. Provo përsëri.');
    } finally {
      setLoading(false);
    }
  };

  const isRegister = mode === 'register';
  const isRecovery = mode === 'forgot' || mode === 'reset';
  const intro = isRegister
    ? 'Krijo një hapësirë të sigurt për ekipin tënd.'
    : isRecovery ? 'Rikthe qasjen në llogarinë tënde në mënyrë të sigurt.'
      : 'Mirë se erdhe përsëri në hapësirën tënde të punës.';

  return (
    <main className="auth-wrapper">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="logo-header">
          <img className="auth-logo" src="/assets/virtuo-logo.png" alt="Virtuo" />
          <h1 id="auth-title" className="sr-only">Virtuo</h1>
          <p>{intro}</p>
        </div>

        {!isRecovery ? (
          <div className="auth-tabs" role="tablist" aria-label="Autentikimi">
            <button type="button" role="tab" aria-selected={!isRegister} className={`auth-tab ${!isRegister ? 'active' : ''}`} onClick={() => switchMode('login')}>Kyçu</button>
            <button type="button" role="tab" aria-selected={isRegister} className={`auth-tab ${isRegister ? 'active' : ''}`} onClick={() => switchMode('register')}>Regjistrohu</button>
          </div>
        ) : (
          <button type="button" className="auth-back" onClick={() => switchMode('login')}><ArrowLeft size={16} /> Kthehu te kyçja</button>
        )}

        {error && <div className="alert alert-error" role="alert"><ShieldAlert size={17} /><span>{error}</span></div>}
        {success && <div className="alert alert-success" role="status"><ShieldCheck size={17} /><span>{success}</span></div>}

        <form onSubmit={handleSubmit} className="auth-form">
          {isRegister && (
            <div className="form-row">
              <div className="form-group"><label htmlFor="firstName">Emri</label><input id="firstName" className="input-field" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Filan" autoComplete="given-name" required /></div>
              <div className="form-group"><label htmlFor="lastName">Mbiemri</label><input id="lastName" className="input-field" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Fisteku" autoComplete="family-name" required /></div>
            </div>
          )}

          {mode !== 'reset' && (
            <div className="form-group"><label htmlFor="email">Email</label><input type="email" id="email" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="emri@kompania.com" autoComplete="email" required /></div>
          )}

          {(mode === 'login' || mode === 'register' || mode === 'reset') && (
            <div className="form-group">
              <div className="form-label-row"><label htmlFor="password">{mode === 'reset' ? 'Fjalëkalimi i ri' : 'Fjalëkalimi'}</label>{(isRegister || mode === 'reset') && <span>Minimumi 6 karaktere</span>}</div>
              <div className="password-field">
                <input type={showPassword ? 'text' : 'password'} id="password" className="input-field" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Vendos fjalëkalimin" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'login' ? undefined : 6} required />
                <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Fshih fjalëkalimin' : 'Shfaq fjalëkalimin'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
            </div>
          )}

          {(isRegister || mode === 'reset') && <div className="form-group"><label htmlFor="confirmPassword">Përsërit fjalëkalimin</label><input type={showPassword ? 'text' : 'password'} id="confirmPassword" className="input-field" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Përsërit fjalëkalimin" autoComplete="new-password" minLength={6} required /></div>}

          {(isRegister || mode === 'forgot') && (
            <div className="form-group">
              <div className="form-label-row"><label htmlFor="recoveryCode">Kodi i rikuperimit</label><span>6–64 karaktere</span></div>
              <input type="password" id="recoveryCode" className="input-field" value={recoveryCode} onChange={(e) => setRecoveryCode(e.target.value)} placeholder={isRegister ? 'Zgjidh një kod që e mban mend' : 'Shkruaj kodin e vendosur në regjistrim'} minLength={6} maxLength={64} autoComplete="off" required />
              {isRegister && <small className="field-help">Ruaje privatisht: ky kod të lejon të krijosh fjalëkalim të ri nëse e harron.</small>}
            </div>
          )}

          {mode === 'login' && <button type="button" className="forgot-password-link" onClick={() => switchMode('forgot')}>Harrove fjalëkalimin?</button>}

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Duke u procesuar...' : isRegister ? <><UserPlus size={18} /><span>Krijo llogarinë</span></> : isRecovery ? <><KeyRound size={18} /><span>{mode === 'forgot' ? 'Verifiko kodin' : 'Ruaj fjalëkalimin e ri'}</span></> : <><LogIn size={18} /><span>Kyçu në Virtuo</span></>}
          </button>
        </form>

        {!isRecovery && <p className="auth-hint">{isRegister ? 'Duke u regjistruar, pranon të përdorësh Virtuo vetëm për punën e ekipit tënd.' : 'Nuk ke llogari? Zgjidh “Regjistrohu” për të filluar.'}</p>}
      </section>
    </main>
  );
}
