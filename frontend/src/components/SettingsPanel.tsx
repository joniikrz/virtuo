import React, { useEffect, useState } from 'react';
import { BellRing, History, KeyRound, Lock, Save, UserRound, UsersRound, X } from 'lucide-react';
import { User } from '../types';
import { apiErrorMessage, apiFetch, readApiJson } from '../lib/api';

type SettingsTab = 'account' | 'security' | 'activity' | 'notifications' | 'users';

interface ActivityItem {
  id: string;
  action: string;
  description: string;
  createdAt: string;
}

function activityDescription(item: ActivityItem): string {
  const fixed: Record<string, string> = {
    LOGIN: 'Signed in',
    PASSWORD_CHANGED: 'Changed password',
    PASSWORD_RESET_BY_ADMIN: 'Password changed by an administrator',
    PROFILE_UPDATED: 'Updated profile details',
    NOTIFICATION_SETTINGS: 'Updated notification preferences',
    RECOVERY_CODE_UPDATED: 'Changed recovery code',
    PASSWORD_RESET: 'Reset password with a recovery code',
  };
  if (fixed[item.action]) return fixed[item.action];
  return item.description
    .replace(/^Ndryshoi fjalëkalimin e\s+/i, 'Changed the password for ')
    .replace(/^Fshiu llogarinë\s+/i, 'Deleted the account ');
}

interface SettingsPanelProps {
  user: User;
  isOpen: boolean;
  initialTab?: SettingsTab;
  onClose: () => void;
  onUserUpdate: (user: User) => void;
}

const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: 'account', label: 'Account', icon: <UserRound size={17} /> },
  { id: 'security', label: 'Security', icon: <Lock size={17} /> },
  { id: 'activity', label: 'Activity', icon: <History size={17} /> },
  { id: 'notifications', label: 'Notifications', icon: <BellRing size={17} /> },
  { id: 'users', label: 'Users', icon: <UsersRound size={17} /> },
];

async function apiRequest<T>(url: string, method: string, body?: unknown): Promise<T> {
  const response = await apiFetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await readApiJson<T>(response);
  if (!response.ok) throw new Error(apiErrorMessage(response, data, 'The request failed. Please try again.'));
  return data;
}

export default function SettingsPanel({ user, isOpen, initialTab = 'account', onClose, onUserUpdate }: SettingsPanelProps) {
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [email, setEmail] = useState(user.email);
  const [profilePassword, setProfilePassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [emailNotifications, setEmailNotifications] = useState(user.emailNotifications ?? true);
  const [inAppNotifications, setInAppNotifications] = useState(user.inAppNotifications ?? true);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setTab(initialTab);
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setEmail(user.email);
    setEmailNotifications(user.emailNotifications ?? true);
    setInAppNotifications(user.inAppNotifications ?? true);
    setProfilePassword('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setRecoveryPassword('');
    setRecoveryCode('');
    setSelectedUserId('');
    setAdminPassword('');
    setAdminConfirmPassword('');
    setMessage(null);
  }, [isOpen, initialTab, user]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || tab !== 'activity') return;
    setLoadingActivity(true);
    apiRequest<{ activities?: ActivityItem[] }>('/api/auth/activity', 'GET')
      .then((data) => setActivities(data.activities || []))
      .catch((error: Error) => setMessage({ type: 'error', text: error.message }))
      .finally(() => setLoadingActivity(false));
  }, [isOpen, tab]);

  useEffect(() => {
    if (!isOpen || tab !== 'users' || user.role !== 'ADMIN') return;
    setLoadingUsers(true);
    apiRequest<User[]>('/api/auth/users', 'GET')
      .then((users) => setAdminUsers(users))
      .catch((error: Error) => setMessage({ type: 'error', text: error.message }))
      .finally(() => setLoadingUsers(false));
  }, [isOpen, tab, user.role]);

  if (!isOpen) return null;

  const runSave = async (request: () => Promise<void>) => {
    setSaving(true);
    setMessage(null);
    try {
      await request();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'An error occurred.' });
    } finally {
      setSaving(false);
    }
  };

  const saveProfile = (event: React.FormEvent) => {
    event.preventDefault();
    void runSave(async () => {
      const data = await apiRequest<{ user: User; message?: string }>('/api/auth/profile', 'PUT', { firstName, lastName, email, currentPassword: profilePassword });
      onUserUpdate(data.user);
      setProfilePassword('');
      setMessage({ type: 'success', text: data.message || 'Profile saved.' });
    });
  };

  const savePassword = (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'The new passwords do not match.' });
      return;
    }
    void runSave(async () => {
      const data = await apiRequest<{ message?: string }>('/api/auth/change-password', 'PUT', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage({ type: 'success', text: data.message || 'Password changed.' });
    });
  };

  const saveRecoveryCode = (event: React.FormEvent) => {
    event.preventDefault();
    void runSave(async () => {
      const data = await apiRequest<{ message?: string }>('/api/auth/recovery-code', 'PUT', { currentPassword: recoveryPassword, recoveryCode });
      onUserUpdate({ ...user, hasRecoveryCode: true });
      setRecoveryPassword('');
      setRecoveryCode('');
      setMessage({ type: 'success', text: data.message || 'Recovery code saved.' });
    });
  };

  const savePreferences = (event: React.FormEvent) => {
    event.preventDefault();
    void runSave(async () => {
      const data = await apiRequest<{ user: User; message?: string }>('/api/auth/preferences', 'PUT', { emailNotifications, inAppNotifications });
      onUserUpdate(data.user);
      setMessage({ type: 'success', text: data.message || 'Preferences saved.' });
    });
  };

  const saveUserPassword = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedUserId) {
      setMessage({ type: 'error', text: 'Select a user.' });
      return;
    }
    if (adminPassword !== adminConfirmPassword) {
      setMessage({ type: 'error', text: 'The new passwords do not match.' });
      return;
    }
    void runSave(async () => {
      const data = await apiRequest<{ message?: string }>(`/api/auth/users/${encodeURIComponent(selectedUserId)}/password`, 'PUT', { newPassword: adminPassword });
      setAdminPassword('');
      setAdminConfirmPassword('');
      setMessage({ type: 'success', text: data.message || 'Password changed.' });
    });
  };

  const visibleTabs = tabs.filter((item) => item.id !== 'users' || user.role === 'ADMIN');

  return (
    <div className="settings-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="settings-header">
          <div><span className="settings-eyebrow">Virtuo</span><h2 id="settings-title">Settings</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close settings"><X size={20} /></button>
        </header>

        <nav className={`settings-tabs ${user.role === 'ADMIN' ? 'admin-tabs' : ''}`} aria-label="Settings sections">
          {visibleTabs.map((item) => (
            <button key={item.id} type="button" className={tab === item.id ? 'active' : ''} onClick={() => { setTab(item.id); setMessage(null); }}>
              {item.icon}<span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="settings-content">
          {message && <div className={`settings-message ${message.type}`} role="status">{message.text}</div>}

          {tab === 'account' && (
            <form className="settings-form" onSubmit={saveProfile}>
              <div className="settings-section-heading"><h3>Personal information</h3><p>Update your name and email address.</p></div>
              <div className="settings-grid">
                <label>First name<input className="input-field" value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={60} required /></label>
                <label>Last name<input className="input-field" value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={60} required /></label>
              </div>
              <label>Email<input type="email" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
              <label>Current password<input type="password" className="input-field" value={profilePassword} onChange={(e) => setProfilePassword(e.target.value)} maxLength={128} autoComplete="current-password" required /></label>
              <button className="btn btn-primary settings-save" disabled={saving}><Save size={17} /> Save profile</button>
            </form>
          )}

          {tab === 'security' && (
            <div className="settings-stack">
              {!user.hasRecoveryCode && <div className="settings-message warning">This account does not have a recovery code yet. Set one below so you can recover your password.</div>}
              <form className="settings-form settings-card" onSubmit={savePassword}>
                <div className="settings-section-heading"><h3>Change password</h3><p>Use 12–128 characters and avoid common passwords.</p></div>
                <label>Current password<input type="password" className="input-field" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} maxLength={128} autoComplete="current-password" required /></label>
                <label>New password<input type="password" className="input-field" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={12} maxLength={128} autoComplete="new-password" required /></label>
                <label>Confirm password<input type="password" className="input-field" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={12} maxLength={128} autoComplete="new-password" required /></label>
                <button className="btn btn-primary settings-save" disabled={saving}><Lock size={17} /> Change password</button>
              </form>

              <form className="settings-form settings-card" onSubmit={saveRecoveryCode}>
                <div className="settings-section-heading"><h3>Recovery code</h3><p>Keep it private. It is used if you forget your password and is never stored as readable text.</p></div>
                <label>Current password<input type="password" className="input-field" value={recoveryPassword} onChange={(e) => setRecoveryPassword(e.target.value)} required /></label>
                <label>New code<input type="password" className="input-field" value={recoveryCode} onChange={(e) => setRecoveryCode(e.target.value)} minLength={10} maxLength={64} placeholder="10–64 characters" required /></label>
                <button className="btn btn-secondary settings-save" disabled={saving}><KeyRound size={17} /> Save code</button>
              </form>
            </div>
          )}

          {tab === 'activity' && (
            <section>
              <div className="settings-section-heading"><h3>Activity history</h3><p>The 50 most recent actions on your account.</p></div>
              {loadingActivity ? <p className="settings-empty">Loading...</p> : activities.length === 0 ? <p className="settings-empty">No recorded activity yet.</p> : (
                <div className="activity-list">{activities.map((item) => <article key={item.id}><span className="activity-dot" /><div><strong>{activityDescription(item)}</strong><time>{new Date(item.createdAt).toLocaleString('en-GB')}</time></div></article>)}</div>
              )}
            </section>
          )}

          {tab === 'notifications' && (
            <form className="settings-form" onSubmit={savePreferences}>
              <div className="settings-section-heading"><h3>Notification preferences</h3><p>Choose how you want to be notified about tasks.</p></div>
              <label className="preference-row"><div><strong>In-app notifications</strong><span>Show notifications under the bell icon.</span></div><input type="checkbox" checked={inAppNotifications} onChange={(e) => setInAppNotifications(e.target.checked)} /></label>
              <label className="preference-row"><div><strong>Email notifications</strong><span>Send an email when a task is assigned to you.</span></div><input type="checkbox" checked={emailNotifications} onChange={(e) => setEmailNotifications(e.target.checked)} /></label>
              <button className="btn btn-primary settings-save" disabled={saving}><Save size={17} /> Save preferences</button>
            </form>
          )}

          {tab === 'users' && user.role === 'ADMIN' && (
            <form className="settings-form" onSubmit={saveUserPassword}>
              <div className="settings-section-heading">
                <h3>User management</h3>
                <p>Set a new password. The user will be signed out of all existing sessions.</p>
              </div>
              {loadingUsers ? <p className="settings-empty">Loading users...</p> : (
                <label>
                  User
                  <select className="input-field" value={selectedUserId} onChange={(event) => { setSelectedUserId(event.target.value); setMessage(null); }} required>
                    <option value="">Select a user</option>
                    {adminUsers.filter((account) => account.id !== user.id).map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.firstName} {account.lastName} — {account.email} ({account.role})
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>New password<input type="password" className="input-field" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} minLength={12} maxLength={128} autoComplete="new-password" required /></label>
              <label>Confirm password<input type="password" className="input-field" value={adminConfirmPassword} onChange={(event) => setAdminConfirmPassword(event.target.value)} minLength={12} maxLength={128} autoComplete="new-password" required /></label>
              <button className="btn btn-primary settings-save" disabled={saving || loadingUsers || !selectedUserId}>
                <KeyRound size={17} /> {saving ? 'Changing...' : 'Change password'}
              </button>
            </form>
          )}
        </div>
      </aside>
    </div>
  );
}
