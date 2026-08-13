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
  if (!response.ok) throw new Error(apiErrorMessage(response, data, 'The request failed. Please try again.'));
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
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Users could not be loaded.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('en-GB');
    if (!normalized) return users;
    return users.filter((user) => `${user.firstName} ${user.lastName} ${user.email} ${user.role}`.toLocaleLowerCase('en-GB').includes(normalized));
  }, [query, users]);

  const userCount = users.filter((user) => user.role === 'USER').length;
  const adminCount = users.filter((user) => user.role === 'ADMIN').length;

  const handleRegister = async (userData: unknown) => {
    setModalError('');
    try {
      const data = await apiRequest<{ user: User; message?: string }>('/api/auth/register-user', 'POST', userData);
      setUsers((current) => [...current, data.user].sort((a, b) => a.firstName.localeCompare(b.firstName, 'en')));
      setShowRegister(false);
      setMessage({ type: 'success', text: data.message || 'Account created successfully.' });
    } catch (error) {
      setModalError(error instanceof Error ? error.message : 'The account could not be created.');
      throw error;
    }
  };

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!resetUser || saving) return;
    if (newPassword !== confirmPassword) {
      setModalError('Passwords do not match.');
      return;
    }
    setSaving(true);
    setModalError('');
    try {
      const data = await apiRequest<{ message?: string }>(`/api/auth/users/${encodeURIComponent(resetUser.id)}/password`, 'PUT', { newPassword });
      setResetUser(null);
      setNewPassword('');
      setConfirmPassword('');
      setMessage({ type: 'success', text: data.message || 'Password changed.' });
    } catch (error) {
      setModalError(error instanceof Error ? error.message : 'The password could not be changed.');
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
      setMessage({ type: 'success', text: data.message || 'Account deleted.' });
    } catch (error) {
      setModalError(error instanceof Error ? error.message : 'The account could not be deleted.');
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
        <div><span className="admin-eyebrow"><ShieldCheck size={15} /> ADMIN</span><h1>Administration Panel</h1><p>Manage Virtuo accounts without entering user workspaces.</p></div>
        <button type="button" className="btn btn-primary" onClick={() => { setShowRegister(true); setModalError(''); }}><UserPlus size={17} /> Register user</button>
      </section>

      {message && <div className={`admin-message ${message.type}`} role="status">{message.text}</div>}

      <section className="admin-stats" aria-label="User statistics">
        <article><UsersRound size={20} /><div><strong>{users.length}</strong><span>Total</span></div></article>
        <article><UsersRound size={20} /><div><strong>{userCount}</strong><span>Users</span></div></article>
        <article><ShieldCheck size={20} /><div><strong>{adminCount}</strong><span>Administrators</span></div></article>
      </section>

      <section className="admin-users-card">
        <header><div><h2>Registered accounts</h2><p>Change a password or permanently delete an account.</p></div><label className="admin-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or email..." /></label></header>
        {loading ? <div className="admin-empty">Loading users...</div> : filteredUsers.length === 0 ? <div className="admin-empty">No users found.</div> : (
          <div className="admin-user-list">
            {filteredUsers.map((account) => {
              const isCurrent = account.id === currentUser.id;
              return <article className="admin-user-row" key={account.id}>
                <span className="admin-avatar">{account.firstName[0]}{account.lastName[0]}</span>
                <div className="admin-user-info"><strong>{account.firstName} {account.lastName}{isCurrent && <small>You</small>}</strong><span>{account.email}</span></div>
                <span className={`admin-role ${account.role.toLowerCase()}`}>{account.role}</span>
                <div className="admin-user-actions">
                  <button type="button" className="btn btn-secondary btn-sm" disabled={isCurrent} onClick={() => openReset(account)}><KeyRound size={15} /> Password</button>
                  <button type="button" className="btn btn-secondary btn-sm admin-delete-button" disabled={isCurrent} onClick={() => openDelete(account)}><Trash2 size={15} /> Delete</button>
                </div>
              </article>;
            })}
          </div>
        )}
      </section>

      {showRegister && <RegisterUserModal onClose={() => setShowRegister(false)} onSubmit={handleRegister} errorMsg={modalError} />}

      {resetUser && <div className="modal-overlay"><div className="modal-content"><div className="modal-header"><h3>Change password</h3><button type="button" className="modal-close-btn" onClick={() => setResetUser(null)}>&times;</button></div><form onSubmit={handleResetPassword}><div className="modal-body"><p className="admin-modal-note">Account: <strong>{resetUser.firstName} {resetUser.lastName}</strong><br />{resetUser.email}</p>{modalError && <div className="settings-message error">{modalError}</div>}<div className="form-group"><label>New password</label><input type="password" className="input-field" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={12} maxLength={128} autoComplete="new-password" required /></div><div className="form-group"><label>Confirm password</label><input type="password" className="input-field" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={12} maxLength={128} autoComplete="new-password" required /></div></div><div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setResetUser(null)}>Cancel</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Changing...' : 'Change password'}</button></div></form></div></div>}

      {deleteUser && <div className="modal-overlay"><div className="modal-content"><div className="modal-header"><h3>Delete account</h3><button type="button" className="modal-close-btn" onClick={() => setDeleteUser(null)}>&times;</button></div><form onSubmit={handleDeleteUser}><div className="modal-body"><div className="admin-danger-note"><strong>This action cannot be undone.</strong><p>This will delete {deleteUser.firstName} {deleteUser.lastName}, their workspaces, created tasks, comments, attachments, and related notifications.</p></div>{modalError && <div className="settings-message error">{modalError}</div>}<div className="form-group"><label>Current admin password</label><input type="password" className="input-field" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} autoComplete="current-password" required /></div></div><div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setDeleteUser(null)}>Cancel</button><button className="btn btn-danger" disabled={saving}><Trash2 size={16} /> {saving ? 'Deleting...' : 'Delete permanently'}</button></div></form></div></div>}
    </main>
  );
}
