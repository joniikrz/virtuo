import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyRound, Search, ShieldCheck, Trash2, UserPlus, UsersRound } from 'lucide-react';
import { User } from '../types';
import { apiErrorMessage, apiFetch, readApiJson } from '../lib/api';
import RegisterUserModal from './RegisterUserModal';

interface AdminPanelProps {
  currentUser: User;
}

async function apiRequest<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await apiFetch(url, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await readApiJson<T>(response);
  if (!response.ok) throw new Error(apiErrorMessage(response, data, 'Kërkesa nuk u krye. Provo përsëri.'));
  return data;
}

export default function AdminPanel({ currentUser }: AdminPanelProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await apiRequest<User[]>('/api/auth/users'));
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Përdoruesit nuk u ngarkuan.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('sq-AL');
    if (!normalized) return users;
    return users.filter((user) => `${user.firstName} ${user.lastName} ${user.email} ${user.role}`.toLocaleLowerCase('sq-AL').includes(normalized));
  }, [query, users]);

  const userCount = users.filter((user) => user.role === 'USER').length;
  const adminCount = users.filter((user) => user.role === 'ADMIN').length;

  const handleRegister = async (userData: unknown) => {
    setModalError('');
    try {
      const data = await apiRequest<{ user: User; message?: string }>('/api/auth/register-user', 'POST', userData);
      setUsers((current) => [...current, data.user].sort((a, b) => a.firstName.localeCompare(b.firstName, 'sq')));
      setShowRegister(false);
      setMessage({ type: 'success', text: data.message || 'Llogaria u krijua me sukses.' });
    } catch (error) {
      setModalError(error instanceof Error ? error.message : 'Llogaria nuk u krijua.');
      throw error;
    }
  };

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!resetUser || saving) return;
    if (newPassword !== confirmPassword) {
      setModalError('Fjalëkalimet nuk përputhen.');
      return;
    }
    setSaving(true);
    setModalError('');
    try {
      const data = await apiRequest<{ message?: string }>(`/api/auth/users/${encodeURIComponent(resetUser.id)}/password`, 'PUT', { newPassword });
      setResetUser(null);
      setNewPassword('');
      setConfirmPassword('');
      setMessage({ type: 'success', text: data.message || 'Fjalëkalimi u ndryshua.' });
    } catch (error) {
      setModalError(error instanceof Error ? error.message : 'Fjalëkalimi nuk u ndryshua.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!deleteUser || saving) return;
    setSaving(true);
    setModalError('');
    try {
      const data = await apiRequest<{ message?: string; deletedUserId: string }>(`/api/auth/users/${encodeURIComponent(deleteUser.id)}`, 'DELETE', { currentPassword: adminPassword });
      setUsers((current) => current.filter((user) => user.id !== data.deletedUserId));
      setDeleteUser(null);
      setAdminPassword('');
      setMessage({ type: 'success', text: data.message || 'Llogaria u fshi.' });
    } catch (error) {
      setModalError(error instanceof Error ? error.message : 'Llogaria nuk u fshi.');
    } finally {
      setSaving(false);
    }
  };

  const openReset = (user: User) => {
    setResetUser(user);
    setNewPassword('');
    setConfirmPassword('');
    setModalError('');
  };

  const openDelete = (user: User) => {
    setDeleteUser(user);
    setAdminPassword('');
    setModalError('');
  };

  return (
    <main className="admin-dashboard">
      <section className="admin-hero">
        <div><span className="admin-eyebrow"><ShieldCheck size={15} /> ADMIN</span><h1>Paneli i administrimit</h1><p>Menaxho llogaritë e Virtuo-s pa hyrë në hapësirat e punës.</p></div>
        <button type="button" className="btn btn-primary" onClick={() => { setShowRegister(true); setModalError(''); }}><UserPlus size={17} /> Regjistro përdorues</button>
      </section>

      {message && <div className={`admin-message ${message.type}`} role="status">{message.text}</div>}

      <section className="admin-stats" aria-label="Statistikat e përdoruesve">
        <article><UsersRound size={20} /><div><strong>{users.length}</strong><span>Gjithsej</span></div></article>
        <article><UsersRound size={20} /><div><strong>{userCount}</strong><span>Përdorues</span></div></article>
        <article><ShieldCheck size={20} /><div><strong>{adminCount}</strong><span>Administratorë</span></div></article>
      </section>

      <section className="admin-users-card">
        <header><div><h2>Llogaritë e regjistruara</h2><p>Ndrysho fjalëkalimin ose fshije plotësisht një llogari.</p></div><label className="admin-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Kërko emër ose email..." /></label></header>
        {loading ? <div className="admin-empty">Duke i ngarkuar përdoruesit...</div> : filteredUsers.length === 0 ? <div className="admin-empty">Nuk u gjet asnjë përdorues.</div> : (
          <div className="admin-user-list">
            {filteredUsers.map((account) => {
              const isCurrent = account.id === currentUser.id;
              return <article className="admin-user-row" key={account.id}>
                <span className="admin-avatar">{account.firstName[0]}{account.lastName[0]}</span>
                <div className="admin-user-info"><strong>{account.firstName} {account.lastName}{isCurrent && <small>Ti</small>}</strong><span>{account.email}</span></div>
                <span className={`admin-role ${account.role.toLowerCase()}`}>{account.role}</span>
                <div className="admin-user-actions">
                  <button type="button" className="btn btn-secondary btn-sm" disabled={isCurrent} onClick={() => openReset(account)}><KeyRound size={15} /> Password</button>
                  <button type="button" className="btn btn-secondary btn-sm admin-delete-button" disabled={isCurrent} onClick={() => openDelete(account)}><Trash2 size={15} /> Fshij</button>
                </div>
              </article>;
            })}
          </div>
        )}
      </section>

      {showRegister && <RegisterUserModal onClose={() => setShowRegister(false)} onSubmit={handleRegister} errorMsg={modalError} />}

      {resetUser && <div className="modal-overlay"><div className="modal-content"><div className="modal-header"><h3>Ndrysho fjalëkalimin</h3><button type="button" className="modal-close-btn" onClick={() => setResetUser(null)}>&times;</button></div><form onSubmit={handleResetPassword}><div className="modal-body"><p className="admin-modal-note">Llogaria: <strong>{resetUser.firstName} {resetUser.lastName}</strong><br />{resetUser.email}</p>{modalError && <div className="settings-message error">{modalError}</div>}<div className="form-group"><label>Fjalëkalimi i ri</label><input type="password" className="input-field" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={12} maxLength={128} autoComplete="new-password" required /></div><div className="form-group"><label>Përsërit fjalëkalimin</label><input type="password" className="input-field" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={12} maxLength={128} autoComplete="new-password" required /></div></div><div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setResetUser(null)}>Anulo</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Duke u ndryshuar...' : 'Ndrysho password-in'}</button></div></form></div></div>}

      {deleteUser && <div className="modal-overlay"><div className="modal-content"><div className="modal-header"><h3>Fshij llogarinë</h3><button type="button" className="modal-close-btn" onClick={() => setDeleteUser(null)}>&times;</button></div><form onSubmit={handleDeleteUser}><div className="modal-body"><div className="admin-danger-note"><strong>Ky veprim nuk kthehet prapa.</strong><p>Do të fshihet {deleteUser.firstName} {deleteUser.lastName}, hapësirat që zotëron, task-et e krijuara, komentet, skedarët dhe njoftimet e lidhura.</p></div>{modalError && <div className="settings-message error">{modalError}</div>}<div className="form-group"><label>Fjalëkalimi aktual i Admin-it</label><input type="password" className="input-field" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} autoComplete="current-password" required /></div></div><div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setDeleteUser(null)}>Anulo</button><button className="btn btn-danger" disabled={saving}><Trash2 size={16} /> {saving ? 'Duke u fshirë...' : 'Fshije përfundimisht'}</button></div></form></div></div>}
    </main>
  );
}
