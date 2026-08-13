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
    if (mode === 'register' && password !== confirmPassword) throw new Error('Passwords do not match.');
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
    if (!response.ok) throw new Error(apiErrorMessage(response, data, 'The request failed. Please try again.'));
    if (!data.user) throw new Error('Invalid server response. Please try again.');
    onLoginSuccess(data.user);
  };

  const submitRecovery = async () => {
    if (mode === 'forgot') {
      const response = await fetch('/api/auth/forgot-password/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ email: email.trim(), recoveryCode }),
      });
      const data = await readApiJson<{ resetToken?: string }>(response);
      if (!response.ok) throw new Error(apiErrorMessage(response, data, 'Verification failed.'));
      if (!data.resetToken) throw new Error('Invalid server response.');
      setResetToken(data.resetToken);
      setRecoveryCode('');
      setMode('reset');
      setSuccess('Code verified. Enter your new password.');
      return;
    }

    if (password !== confirmPassword) throw new Error('Passwords do not match.');
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ resetToken, newPassword: password }),
    });
    const data = await readApiJson<{ message?: string }>(response);
    if (!response.ok) throw new Error(apiErrorMessage(response, data, 'Password reset failed.'));
    setMode('login');
    setResetToken('');
    setPassword('');
    setConfirmPassword('');
    setSuccess(data.message || 'Password reset. You can now sign in.');
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
      setError(err instanceof Error ? err.message : 'Could not connect to the server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isRegister = mode === 'register';
  const isRecovery = mode === 'forgot' || mode === 'reset';
  const intro = isRegister
    ? 'Create a secure workspace for your team.'
    : isRecovery ? 'Securely recover access to your account.'
      : 'Welcome back to your workspace.';

  return (
    <main className="auth-wrapper">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="logo-header">
          <img className="auth-logo" src="/assets/virtuo-logo.png" alt="Virtuo" />
          <h1 id="auth-title" className="sr-only">Virtuo</h1>
          <p>{intro}</p>
        </div>

        {!isRecovery ? (
          <div className="auth-tabs" role="tablist" aria-label="Authentication">
            <button type="button" role="tab" aria-selected={!isRegister} className={`auth-tab ${!isRegister ? 'active' : ''}`} onClick={() => switchMode('login')}>Sign in</button>
            <button type="button" role="tab" aria-selected={isRegister} className={`auth-tab ${isRegister ? 'active' : ''}`} onClick={() => switchMode('register')}>Sign up</button>
          </div>
        ) : (
          <button type="button" className="auth-back" onClick={() => switchMode('login')}><ArrowLeft size={16} /> Back to sign in</button>
        )}

        {error && <div className="alert alert-error" role="alert"><ShieldAlert size={17} /><span>{error}</span></div>}
        {success && <div className="alert alert-success" role="status"><ShieldCheck size={17} /><span>{success}</span></div>}

        <form onSubmit={handleSubmit} className="auth-form">
          {isRegister && (
            <div className="form-row">
              <div className="form-group"><label htmlFor="firstName">First name</label><input id="firstName" className="input-field" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" autoComplete="given-name" maxLength={60} required /></div>
              <div className="form-group"><label htmlFor="lastName">Last name</label><input id="lastName" className="input-field" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Smith" autoComplete="family-name" maxLength={60} required /></div>
            </div>
          )}

          {mode !== 'reset' && (
            <div className="form-group"><label htmlFor="email">Email</label><input type="email" id="email" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" autoComplete="email" maxLength={254} required /></div>
          )}

          {(mode === 'login' || mode === 'register' || mode === 'reset') && (
            <div className="form-group">
              <div className="form-label-row"><label htmlFor="password">{mode === 'reset' ? 'New password' : 'Password'}</label>{(isRegister || mode === 'reset') && <span>12–128 characters</span>}</div>
              <div className="password-field">
                <input type={showPassword ? 'text' : 'password'} id="password" className="input-field" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'login' ? undefined : 12} maxLength={128} required />
                <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
            </div>
          )}

          {(isRegister || mode === 'reset') && <div className="form-group"><label htmlFor="confirmPassword">Confirm password</label><input type={showPassword ? 'text' : 'password'} id="confirmPassword" className="input-field" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm password" autoComplete="new-password" minLength={12} maxLength={128} required /></div>}

          {(isRegister || mode === 'forgot') && (
            <div className="form-group">
              <div className="form-label-row"><label htmlFor="recoveryCode">Recovery code</label><span>10–64 characters</span></div>
              <input type="password" id="recoveryCode" className="input-field" value={recoveryCode} onChange={(e) => setRecoveryCode(e.target.value)} placeholder={isRegister ? 'Choose a memorable private code' : 'Enter the code set during registration'} minLength={10} maxLength={64} autoComplete="off" required />
              {isRegister && <small className="field-help">Keep it private: this code lets you create a new password if you forget it.</small>}
            </div>
          )}

          {mode === 'login' && <button type="button" className="forgot-password-link" onClick={() => switchMode('forgot')}>Forgot password?</button>}

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Processing...' : isRegister ? <><UserPlus size={18} /><span>Create account</span></> : isRecovery ? <><KeyRound size={18} /><span>{mode === 'forgot' ? 'Verify code' : 'Save new password'}</span></> : <><LogIn size={18} /><span>Sign in to Virtuo</span></>}
          </button>
        </form>

        {!isRecovery && <p className="auth-hint">{isRegister ? 'By signing up, you agree to use Virtuo only for your team’s work.' : 'No account yet? Choose “Sign up” to get started.'}</p>}
      </section>
    </main>
  );
}
