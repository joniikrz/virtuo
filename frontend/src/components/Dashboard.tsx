import React, { useState, useEffect } from 'react';
import {
  Plus, Lock, Calendar, Paperclip, UserPlus,
  FileUp, FileText, CheckCircle2, Clock, Play, X, Download, Trash2
} from 'lucide-react';

const BOARD_COLORS = [
  '#0079BF', '#D29034', '#519839', '#B04632',
  '#89609E', '#CD5A91', '#4BBF6B', '#00AEEF', '#838C91',
];

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface Space {
  id: string;
  name: string;
  description: string;
  color: string;
  isPrivate: boolean;
  createdBy: {
    firstName: string;
    lastName: string;
  };
  _count?: {
    members: number;
    tasks: number;
  };
}

interface Attachment {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  deadline: string;
  assignedTo: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null;
  createdBy: {
    firstName: string;
    lastName: string;
  };
  attachments: Attachment[];
}

interface DashboardProps {
  currentUser: User;
}

function getInitials(firstName: string, lastName: string) {
  return `${firstName[0]}${lastName[0]}`.toUpperCase();
}

export default function Dashboard({ currentUser }: DashboardProps) {
  const isAdmin = currentUser.role === 'ADMIN';

  const [spaces, setSpaces] = useState<Space[]>([]);
  const [activeSpace, setActiveSpace] = useState<Space | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [spaceMembers, setSpaceMembers] = useState<User[]>([]);

  const [showCreateSpace, setShowCreateSpace] = useState(false);
  const [spaceName, setSpaceName] = useState('');
  const [spaceDesc, setSpaceDesc] = useState('');
  const [spacePrivate, setSpacePrivate] = useState(false);
  const [spaceColor, setSpaceColor] = useState(BOARD_COLORS[0]);

  const [showInviteMember, setShowInviteMember] = useState(false);
  const [selectedInviteUser, setSelectedInviteUser] = useState('');

  const [showCreateTask, setShowCreateTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskDeadline, setTaskDeadline] = useState('');
  const [taskAssignee, setTaskAssignee] = useState('');

  const [showRegisterUser, setShowRegisterUser] = useState(false);
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regRole, setRegRole] = useState('USER');

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchSpaces = async () => {
    try {
      const res = await fetch('/api/spaces');
      if (res.ok) {
        const data = await res.json();
        setSpaces(data);
        if (data.length > 0 && !activeSpace) {
          setActiveSpace(data[0]);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const res = await fetch('/api/auth/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTasks = async (spaceId: string) => {
    try {
      const res = await fetch(`/api/spaces/${spaceId}/tasks`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSpaceMembers = async (spaceId: string) => {
    try {
      const res = await fetch(`/api/spaces/${spaceId}/members`);
      if (res.ok) {
        const data = await res.json();
        setSpaceMembers(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSpaces();
    fetchAllUsers();
  }, []);

  useEffect(() => {
    if (activeSpace) {
      fetchTasks(activeSpace.id);
      fetchSpaceMembers(activeSpace.id);
    }
  }, [activeSpace]);

  const handleCreateSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const res = await fetch('/api/spaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: spaceName, description: spaceDesc, isPrivate: spacePrivate, color: spaceColor }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSpaces([...spaces, data]);
      setActiveSpace(data);
      setShowCreateSpace(false);
      setSpaceName('');
      setSpaceDesc('');
      setSpacePrivate(false);
      setSpaceColor(BOARD_COLORS[0]);
      setSuccessMsg('Bordi u krijua me sukses.');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Gabim');
    }
  };

  const handleDeleteSpace = async () => {
    if (!activeSpace || !confirm(`Fshir bordin "${activeSpace.name}"?`)) return;
    try {
      const res = await fetch(`/api/spaces/${activeSpace.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const remaining = spaces.filter((s) => s.id !== activeSpace.id);
      setSpaces(remaining);
      setActiveSpace(remaining[0] || null);
      setTasks([]);
      setSuccessMsg('Bordi u fshi.');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Gabim');
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!activeSpace) return;
    try {
      const res = await fetch(`/api/spaces/${activeSpace.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedInviteUser }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowInviteMember(false);
      setSelectedInviteUser('');
      fetchSpaceMembers(activeSpace.id);
      setSuccessMsg('Anëtari u shtua në bord.');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Gabim');
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!activeSpace) return;
    try {
      const res = await fetch(`/api/spaces/${activeSpace.id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskTitle,
          description: taskDesc,
          deadline: taskDeadline,
          assignedToId: taskAssignee || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setTasks([data, ...tasks]);
      setShowCreateTask(false);
      setTaskTitle('');
      setTaskDesc('');
      setTaskDeadline('');
      setTaskAssignee('');
      setSuccessMsg('Karta u shtua në bord.');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Gabim');
    }
  };

  const handleRegisterUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const res = await fetch('/api/auth/register-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: regEmail,
          password: regPassword,
          firstName: regFirstName,
          lastName: regLastName,
          roleName: regRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowRegisterUser(false);
      setRegEmail('');
      setRegPassword('');
      setRegFirstName('');
      setRegLastName('');
      setRegRole('USER');
      fetchAllUsers();
      setSuccessMsg('Përdoruesi u regjistrua.');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Gabim');
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setTasks(tasks.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
        if (selectedTask?.id === taskId) {
          setSelectedTask({ ...selectedTask, status: newStatus });
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Fshir këtë detyrë?')) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      setTasks(tasks.filter((t) => t.id !== taskId));
      setSelectedTask(null);
      setSuccessMsg('Detyra u fshi.');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Gabim');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !selectedTask) return;
    setUploadingFile(true);
    setErrorMsg('');

    const formData = new FormData();
    formData.append('file', e.target.files[0]);

    try {
      const res = await fetch(`/api/tasks/${selectedTask.id}/attachments`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const updatedTask = {
        ...selectedTask,
        attachments: [...(selectedTask.attachments || []), data],
      };
      setSelectedTask(updatedTask);
      setTasks(tasks.map((t) => (t.id === selectedTask.id ? updatedTask : t)));
      setSuccessMsg('Skedari u ngarkua.');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Gabim');
    } finally {
      setUploadingFile(false);
    }
  };

  const getTasksByStatus = (status: string) => tasks.filter((t) => t.status === status);

  const boardColor = activeSpace?.color || '#0079BF';

  const renderTaskCard = (t: Task, colClass: string) => (
    <div
      key={t.id}
      className={`task-card ${colClass}`}
      onClick={() => setSelectedTask(t)}
    >
      <div className="task-card-labels">
        <span className="task-label" style={{ background: boardColor }} />
      </div>
      <h4 className={`task-card-title ${t.status === 'COMPLETED' ? 'done' : ''}`}>{t.title}</h4>
      {t.description && <p className="task-card-description">{t.description}</p>}
      <div className="task-card-footer">
        {t.assignedTo ? (
          <span className="task-card-assignee" title={`${t.assignedTo.firstName} ${t.assignedTo.lastName}`}>
            {getInitials(t.assignedTo.firstName, t.assignedTo.lastName)}
          </span>
        ) : (
          <span />
        )}
        <span
          className={`task-card-deadline ${
            t.status === 'COMPLETED' ? 'done' : new Date(t.deadline) < new Date() ? 'danger' : 'normal'
          }`}
        >
          {t.status === 'COMPLETED' ? (
            <><CheckCircle2 size={12} /> Kryer</>
          ) : (
            <><Calendar size={12} />{new Date(t.deadline).toLocaleDateString('sq-AL', { month: 'short', day: 'numeric' })}</>
          )}
        </span>
      </div>
    </div>
  );

  return (
    <div className="dashboard-layout">
      <aside className="boards-sidebar">
        <div className="sidebar-header">
          <span className="sidebar-title">Bordet e Mia</span>
        </div>

        <div className="board-list">
          {spaces.map((s) => (
            <div
              key={s.id}
              className={`board-tile ${activeSpace?.id === s.id ? 'active' : ''}`}
              style={{ background: s.color || '#0079BF' }}
              onClick={() => setActiveSpace(s)}
            >
              {s.isPrivate && <span className="board-tile-badge"><Lock size={10} /> Privat</span>}
              <span className="board-tile-name">{s.name}</span>
            </div>
          ))}

          <button className="create-board-btn" onClick={() => setShowCreateSpace(true)}>
            <Plus size={18} />
            Krijo bord të ri
          </button>
        </div>

        <div className="sidebar-footer">
          {isAdmin ? (
            <button onClick={() => setShowRegisterUser(true)} className="btn btn-light btn-sm btn-full">
              <UserPlus size={16} />
              Shto përdorues (Admin)
            </button>
          ) : (
            <div className="user-status-card">
              <span>Anëtar i ekipit</span>
            </div>
          )}
        </div>
      </aside>

      <main className="board-main">
        {successMsg && (
          <div className="alert alert-success" style={{ margin: '12px 16px 0', justifyContent: 'space-between' }}>
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>
        )}

        {activeSpace ? (
          <>
            <div className="board-header" style={{ background: boardColor }}>
              <div className="board-header-info">
                <h2>{activeSpace.name}</h2>
                <p>{activeSpace.description || 'Menaxho detyrat në stil Trello'}</p>
                <div className="board-header-meta">
                  {spaceMembers.length} anëtarë · Krijuar nga {activeSpace.createdBy?.firstName} {activeSpace.createdBy?.lastName}
                </div>
              </div>
              <div className="board-header-actions">
                <button onClick={() => setShowInviteMember(true)} className="btn btn-secondary btn-sm">
                  <UserPlus size={16} /> Fto anëtar
                </button>
                <button onClick={() => setShowCreateTask(true)} className="btn btn-secondary btn-sm">
                  <Plus size={16} /> Karta e re
                </button>
                {(isAdmin || activeSpace.createdBy?.firstName === currentUser.firstName) && (
                  <button onClick={handleDeleteSpace} className="btn btn-secondary btn-sm" title="Fshi bordin">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>

            <div className="board-content">
              <div className="kanban-board">
                <div className="kanban-column col-todo">
                  <div className="kanban-column-header">
                    <span className="column-title"><Clock size={14} /> Për t&apos;u bërë</span>
                    <span className="column-count">{getTasksByStatus('TODO').length}</span>
                  </div>
                  <div className="kanban-cards">
                    {getTasksByStatus('TODO').map((t) => renderTaskCard(t, 'col-todo'))}
                  </div>
                </div>

                <div className="kanban-column col-progress">
                  <div className="kanban-column-header">
                    <span className="column-title"><Play size={14} /> Në proces</span>
                    <span className="column-count">{getTasksByStatus('IN_PROGRESS').length}</span>
                  </div>
                  <div className="kanban-cards">
                    {getTasksByStatus('IN_PROGRESS').map((t) => renderTaskCard(t, 'col-progress'))}
                  </div>
                </div>

                <div className="kanban-column col-done">
                  <div className="kanban-column-header">
                    <span className="column-title"><CheckCircle2 size={14} /> E përfunduar</span>
                    <span className="column-count">{getTasksByStatus('COMPLETED').length}</span>
                  </div>
                  <div className="kanban-cards">
                    {getTasksByStatus('COMPLETED').map((t) => renderTaskCard(t, 'col-done'))}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state" style={{ margin: 'auto' }}>
            <Plus size={48} />
            <h3>Mirëseerdhët në Virtuo</h3>
            <p>{isAdmin ? 'Krijo bordin e parë ose zgjidh një nga lista.' : 'Prit të të ftojë admini në një bord.'}</p>
          </div>
        )}
      </main>

      {/* MODAL: KRIJO BORD */}
      {showCreateSpace && (
        <div className="modal-overlay" onClick={() => setShowCreateSpace(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Krijo bord të ri</h3>
              <button className="modal-close-btn" onClick={() => setShowCreateSpace(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreateSpace}>
              <div className="modal-body">
                {errorMsg && <div className="alert alert-error" style={{ marginBottom: 12 }}>{errorMsg}</div>}
                <div className="form-group">
                  <label>Emri i bordit</label>
                  <input type="text" className="input-field" value={spaceName} onChange={(e) => setSpaceName(e.target.value)} placeholder="p.sh. Marketing" required />
                </div>
                <div className="form-group">
                  <label>Përshkrimi</label>
                  <textarea className="input-field" style={{ minHeight: 70 }} value={spaceDesc} onChange={(e) => setSpaceDesc(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Ngjyra e bordit</label>
                  <div className="color-picker">
                    {BOARD_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`color-swatch ${spaceColor === c ? 'selected' : ''}`}
                        style={{ background: c }}
                        onClick={() => setSpaceColor(c)}
                      />
                    ))}
                  </div>
                </div>
                <div className="form-group" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <label style={{ display: 'block' }}>Bord privat (vetëm admin)</label>
                  </div>
                  <label className="switch">
                    <input type="checkbox" checked={spacePrivate} onChange={(e) => setSpacePrivate(e.target.checked)} />
                    <span className="slider" />
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light" onClick={() => setShowCreateSpace(false)}>Anulo</button>
                <button type="submit" className="btn btn-primary">Krijo bordin</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: FTO ANËTAR */}
      {showInviteMember && activeSpace && (
        <div className="modal-overlay" onClick={() => setShowInviteMember(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Fto anëtar te: {activeSpace.name}</h3>
              <button className="modal-close-btn" onClick={() => setShowInviteMember(false)}>&times;</button>
            </div>
            <form onSubmit={handleInviteMember}>
              <div className="modal-body">
                {errorMsg && <div className="alert alert-error" style={{ marginBottom: 12 }}>{errorMsg}</div>}
                <div className="form-group">
                  <label>Zgjidh përdoruesin</label>
                  <select className="input-field" value={selectedInviteUser} onChange={(e) => setSelectedInviteUser(e.target.value)} required>
                    <option value="">Zgjidh...</option>
                    {users
                      .filter((u) => !activeSpace.isPrivate || u.role === 'ADMIN')
                      .filter((u) => !spaceMembers.some((m) => m.id === u.id))
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.firstName} {u.lastName} ({u.email})
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light" onClick={() => setShowInviteMember(false)}>Anulo</button>
                <button type="submit" className="btn btn-primary">Fto</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: KARTË E RE */}
      {showCreateTask && activeSpace && (
        <div className="modal-overlay" onClick={() => setShowCreateTask(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Shto kartë të re</h3>
              <button className="modal-close-btn" onClick={() => setShowCreateTask(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreateTask}>
              <div className="modal-body">
                {errorMsg && <div className="alert alert-error" style={{ marginBottom: 12 }}>{errorMsg}</div>}
                <div className="form-group">
                  <label>Titulli</label>
                  <input type="text" className="input-field" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Përshkrimi</label>
                  <textarea className="input-field" style={{ minHeight: 70 }} value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Afati</label>
                  <input type="datetime-local" className="input-field" value={taskDeadline} onChange={(e) => setTaskDeadline(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Cakto te</label>
                  <select className="input-field" value={taskAssignee} onChange={(e) => setTaskAssignee(e.target.value)}>
                    <option value="">Pa caktuar</option>
                    {spaceMembers.map((u) => (
                      <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light" onClick={() => setShowCreateTask(false)}>Anulo</button>
                <button type="submit" className="btn btn-primary">Shto kartën</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGJISTRO PËRDORUES (Admin) */}
      {showRegisterUser && (
        <div className="modal-overlay" onClick={() => setShowRegisterUser(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Shto përdorues (Admin)</h3>
              <button className="modal-close-btn" onClick={() => setShowRegisterUser(false)}>&times;</button>
            </div>
            <form onSubmit={handleRegisterUser}>
              <div className="modal-body">
                {errorMsg && <div className="alert alert-error" style={{ marginBottom: 12 }}>{errorMsg}</div>}
                <div className="form-row">
                  <div className="form-group">
                    <label>Emri</label>
                    <input type="text" className="input-field" value={regFirstName} onChange={(e) => setRegFirstName(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Mbiemri</label>
                    <input type="text" className="input-field" value={regLastName} onChange={(e) => setRegLastName(e.target.value)} required />
                  </div>
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" className="input-field" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Fjalëkalimi</label>
                  <input type="password" className="input-field" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Roli</label>
                  <select className="input-field" value={regRole} onChange={(e) => setRegRole(e.target.value)}>
                    <option value="USER">Anëtar</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light" onClick={() => setShowRegisterUser(false)}>Anulo</button>
                <button type="submit" className="btn btn-primary">Regjistro</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DETAJET E KARTËS */}
      {selectedTask && (
        <div className="modal-overlay" onClick={() => setSelectedTask(null)}>
          <div className="modal-content" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ textDecoration: selectedTask.status === 'COMPLETED' ? 'line-through' : 'none' }}>
                {selectedTask.title}
              </h3>
              <button className="modal-close-btn" onClick={() => setSelectedTask(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div>
                  <span className="task-detail-label">Statusi</span>
                  <select
                    className="input-field"
                    value={selectedTask.status}
                    onChange={(e) => handleStatusChange(selectedTask.id, e.target.value)}
                    style={{ marginTop: 6 }}
                  >
                    <option value="TODO">Për t&apos;u bërë</option>
                    <option value="IN_PROGRESS">Në proces</option>
                    <option value="COMPLETED">E përfunduar</option>
                  </select>
                </div>
                <div>
                  <span className="task-detail-label">Afati</span>
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Calendar size={16} />
                    {new Date(selectedTask.deadline).toLocaleString('sq-AL', { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <span className="task-detail-label">Përshkrimi</span>
                <p style={{ marginTop: 6, color: 'var(--trello-text-muted)' }}>
                  {selectedTask.description || 'Pa përshkrim.'}
                </p>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span className="task-detail-label">
                    <Paperclip size={14} style={{ marginRight: 4 }} />
                    Bashkëngjitje ({selectedTask.attachments?.length || 0})
                  </span>
                  <label className="btn btn-light btn-sm" style={{ cursor: 'pointer' }}>
                    <FileUp size={14} />
                    {uploadingFile ? 'Po ngarkohet...' : 'Ngarko'}
                    <input type="file" onChange={handleFileUpload} disabled={uploadingFile} style={{ display: 'none' }} />
                  </label>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {selectedTask.attachments?.length ? (
                    selectedTask.attachments.map((att) => (
                      <div key={att.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--trello-column-bg)', borderRadius: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <FileText size={16} />
                          <span style={{ fontSize: '0.85rem' }}>{att.fileName}</span>
                        </div>
                        <a
                          href={`/api/tasks/${selectedTask.id}/attachments/${att.id}`}
                          download
                          className="btn btn-light btn-sm"
                        >
                          <Download size={14} />
                        </a>
                      </div>
                    ))
                  ) : (
                    <span style={{ fontSize: '0.8rem', color: 'var(--trello-text-muted)' }}>Nuk ka skedarë.</span>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              {isAdmin && (
                <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteTask(selectedTask.id)}>
                  <Trash2 size={14} /> Fshi
                </button>
              )}
              <button type="button" className="btn btn-light" onClick={() => setSelectedTask(null)} style={{ marginLeft: 'auto' }}>
                Mbyll
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
