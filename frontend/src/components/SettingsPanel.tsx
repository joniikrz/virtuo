import React, { useEffect, useState } from 'react';
import { BellRing, History, KeyRound, Lock, Save, UserRound, X } from 'lucide-react';
import { User } from '../types';
import { apiErrorMessage, readApiJson } from '../lib/api';

type SettingsTab = 'account' | 'security' | 'activity' | 'notifications';

interface ActivityItem {
  id: string;
  action: string;
  description: string;
  createdAt: string;
}

interface SettingsPanelProps {
  user: User;
  isOpen: boolean;
  initialTab?: SettingsTab;
  onClose: () => void;
  onUserUpdate: (user: User) => void;
}

const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: 'account', label: 'Llogaria', icon: <UserRound size={17} /> },
  { id: 'security', label: 'Siguria', icon: <Lock size={17} /> },
  { id: 'activity', label: 'Aktiviteti', icon: <History size={17} /> },
  { id: 'notifications', label: 'Njoftimet', icon: <BellRing size={17} /> },
];

async function apiRequest<T>(url: string, method: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await readApiJson<T>(response);
  if (!response.ok) throw new Error(apiErrorMessage(response, data, 'Kërkesa nuk u krye. Provo përsëri.'));
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

  if (!isOpen) return null;

  const runSave = async (request: () => Promise<void>) => {
    setSaving(true);
    setMessage(null);
    try {
      await request();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Ndodhi një gabim.' });
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
      setMessage({ type: 'success', text: data.message || 'Profili u ruajt.' });
    });
  };

  const savePassword = (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Fjalëkalimet e reja nuk përputhen.' });
      return;
    }
    void runSave(async () => {
      const data = await apiRequest<{ message?: string }>('/api/auth/change-password', 'PUT', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage({ type: 'success', text: data.message || 'Fjalëkalimi u ndryshua.' });
    });
  };

  const saveRecoveryCode = (event: React.FormEvent) => {
    event.preventDefault();
    void runSave(async () => {
      const data = await apiRequest<{ message?: string }>('/api/auth/recovery-code', 'PUT', { currentPassword: recoveryPassword, recoveryCode });
      onUserUpdate({ ...user, hasRecoveryCode: true });
      setRecoveryPassword('');
      setRecoveryCode('');
      setMessage({ type: 'success', text: data.message || 'Kodi u ruajt.' });
    });
  };

  const savePreferences = (event: React.FormEvent) => {
    event.preventDefault();
    void runSave(async () => {
      const data = await apiRequest<{ user: User; message?: string }>('/api/auth/preferences', 'PUT', { emailNotifications, inAppNotifications });
      onUserUpdate(data.user);
      setMessage({ type: 'success', text: data.message || 'Preferencat u ruajtën.' });
    });
  };

  return (
    <div className="settings-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="settings-header">
          <div><span className="settings-eyebrow">Virtuo</span><h2 id="settings-title">Cilësimet</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Mbyll cilësimet"><X size={20} /></button>
        </header>

        <nav className="settings-tabs" aria-label="Seksionet e cilësimeve">
          {tabs.map((item) => (
            <button key={item.id} type="button" className={tab === item.id ? 'active' : ''} onClick={() => { setTab(item.id); setMessage(null); }}>
              {item.icon}<span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="settings-content">
          {message && <div className={`settings-message ${message.type}`} role="status">{message.text}</div>}

          {tab === 'account' && (
            <form className="settings-form" onSubmit={saveProfile}>
              <div className="settings-section-heading"><h3>Të dhënat personale</h3><p>Përditëso emrin dhe adresën e email-it.</p></div>
              <div className="settings-grid">
                <label>Emri<input className="input-field" value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={60} required /></label>
                <label>Mbiemri<input className="input-field" value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={60} required /></label>
              </div>
              <label>Email<input type="email" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
              <label>Fjalëkalimi aktual<input type="password" className="input-field" value={profilePassword} onChange={(e) => setProfilePassword(e.target.value)} maxLength={128} autoComplete="current-password" required /></label>
              <button className="btn btn-primary settings-save" disabled={saving}><Save size={17} /> Ruaj profilin</button>
            </form>
          )}

          {tab === 'security' && (
            <div className="settings-stack">
              {!user.hasRecoveryCode && <div className="settings-message warning">Kjo llogari ende nuk ka kod rikuperimi. Vendose më poshtë që të mund ta rikthesh fjalëkalimin.</div>}
              <form className="settings-form settings-card" onSubmit={savePassword}>
                <div className="settings-section-heading"><h3>Ndrysho fjalëkalimin</h3><p>Përdor 12–128 karaktere dhe shmang fjalëkalimet e zakonshme.</p></div>
                <label>Fjalëkalimi aktual<input type="password" className="input-field" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} maxLength={128} autoComplete="current-password" required /></label>
                <label>Fjalëkalimi i ri<input type="password" className="input-field" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={12} maxLength={128} autoComplete="new-password" required /></label>
                <label>Përsërit fjalëkalimin<input type="password" className="input-field" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={12} maxLength={128} autoComplete="new-password" required /></label>
                <button className="btn btn-primary settings-save" disabled={saving}><Lock size={17} /> Ndrysho fjalëkalimin</button>
              </form>

              <form className="settings-form settings-card" onSubmit={saveRecoveryCode}>
                <div className="settings-section-heading"><h3>Kodi i rikuperimit</h3><p>Ruaje privatisht. Përdoret kur harron fjalëkalimin dhe nuk ruhet si tekst i lexueshëm.</p></div>
                <label>Fjalëkalimi aktual<input type="password" className="input-field" value={recoveryPassword} onChange={(e) => setRecoveryPassword(e.target.value)} required /></label>
                <label>Kodi i ri<input type="password" className="input-field" value={recoveryCode} onChange={(e) => setRecoveryCode(e.target.value)} minLength={10} maxLength={64} placeholder="10–64 karaktere" required /></label>
                <button className="btn btn-secondary settings-save" disabled={saving}><KeyRound size={17} /> Ruaj kodin</button>
              </form>
            </div>
          )}

          {tab === 'activity' && (
            <section>
              <div className="settings-section-heading"><h3>Historiku i aktivitetit</h3><p>50 veprimet më të fundit në llogarinë tënde.</p></div>
              {loadingActivity ? <p className="settings-empty">Duke u ngarkuar...</p> : activities.length === 0 ? <p className="settings-empty">Ende nuk ka aktivitet të regjistruar.</p> : (
                <div className="activity-list">{activities.map((item) => <article key={item.id}><span className="activity-dot" /><div><strong>{item.description}</strong><time>{new Date(item.createdAt).toLocaleString('sq-AL')}</time></div></article>)}</div>
              )}
            </section>
          )}

          {tab === 'notifications' && (
            <form className="settings-form" onSubmit={savePreferences}>
              <div className="settings-section-heading"><h3>Preferencat e njoftimeve</h3><p>Zgjidh si dëshiron të njoftohesh për detyrat.</p></div>
              <label className="preference-row"><div><strong>Njoftimet në aplikacion</strong><span>Shfaq njoftimet te ikona e ziles.</span></div><input type="checkbox" checked={inAppNotifications} onChange={(e) => setInAppNotifications(e.target.checked)} /></label>
              <label className="preference-row"><div><strong>Njoftimet me email</strong><span>Dërgo email kur caktohesh në një detyrë.</span></div><input type="checkbox" checked={emailNotifications} onChange={(e) => setEmailNotifications(e.target.checked)} /></label>
              <button className="btn btn-primary settings-save" disabled={saving}><Save size={17} /> Ruaj preferencat</button>
            </form>
          )}
        </div>
      </aside>
    </div>
  );
}
