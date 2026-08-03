import React, { useState, useEffect } from 'react';
import { 
  Plus, Lock, Unlock, Calendar, Paperclip, UserPlus, 
  FileUp, FileText, CheckCircle2, Clock, Play, X, Download
} from 'lucide-react';

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
  status: string; // 'TODO' | 'IN_PROGRESS' | 'COMPLETED'
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

export default function Dashboard({ currentUser }: DashboardProps) {
  const isAdmin = currentUser.role === 'ADMIN';

  // State-et kryesore
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [activeSpace, setActiveSpace] = useState<Space | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [spaceMembers, setSpaceMembers] = useState<User[]>([]);

  // State-et e modal-eve
  const [showCreateSpace, setShowCreateSpace] = useState(false);
  const [spaceName, setSpaceName] = useState('');
  const [spaceDesc, setSpaceDesc] = useState('');
  const [spacePrivate, setSpacePrivate] = useState(false);

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

  // 1. Shkarkimi i Spaces
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

  // 2. Shkarkimi i të gjithë përdoruesve (vetëm për Admin)
  const fetchAllUsers = async () => {
    if (!isAdmin) return;
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

  // 3. Shkarkimi i detyrave për Space-in aktiv
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

  // 4. Shkarkimi i anëtarëve për Space-in aktiv
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

  // Krijimi i një Space të ri
  const handleCreateSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const res = await fetch('/api/spaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: spaceName, description: spaceDesc, isPrivate: spacePrivate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSpaces([...spaces, data]);
      setActiveSpace(data);
      setShowCreateSpace(false);
      setSpaceName('');
      setSpaceDesc('');
      setSpacePrivate(false);
      setSuccessMsg('Hapësira u krijua me sukses.');
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // Ftesa e një anëtari në Space
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
      setSuccessMsg('Anëtari u shtua me sukses në hapësirë.');
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // Krijimi i një Task-u të ri
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
      setSuccessMsg('Detyra u krijua dhe u caktua me sukses.');
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // Regjistrimi i përdoruesit
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
      setSuccessMsg('Llogaria e re u krijua me sukses.');
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // Ndryshimi i Statusit të Detyrës
  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setTasks(tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
        if (selectedTask && selectedTask.id === taskId) {
          setSelectedTask({ ...selectedTask, status: newStatus });
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Ngarkimi i një Shtojce (Attachment)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !selectedTask) return;
    setUploadingFile(true);
    setErrorMsg('');

    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`/api/tasks/${selectedTask.id}/attachments`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const updatedTask = {
        ...selectedTask,
        attachments: [...(selectedTask.attachments || []), data]
      };
      setSelectedTask(updatedTask);
      setTasks(tasks.map(t => t.id === selectedTask.id ? updatedTask : t));
      setSuccessMsg('Skedari u ngarkua me sukses.');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setUploadingFile(false);
    }
  };

  const getTasksByStatus = (status: string) => {
    return tasks.filter(t => t.status === status);
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar-i me Spaces */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="sidebar-title">Hapësirat e Punës</span>
          {isAdmin && (
            <button 
              onClick={() => setShowCreateSpace(true)} 
              className="btn btn-secondary btn-sm" 
              style={{ padding: '4px 8px', borderRadius: '50%' }}
              title="Krijo Space të ri"
            >
              <Plus size={16} />
            </button>
          )}
        </div>

        <div className="space-list">
          {spaces.map(s => (
            <div 
              key={s.id} 
              className={`space-item ${activeSpace?.id === s.id ? 'active' : ''}`}
              onClick={() => setActiveSpace(s)}
            >
              <span className="space-item-name">
                {s.isPrivate ? <Lock size={14} style={{ color: 'hsl(var(--accent-warning))' }} /> : <Unlock size={14} />}
                {s.name}
              </span>
              {s.isPrivate && <span className="space-item-badge">Boss</span>}
            </div>
          ))}
          {spaces.length === 0 && (
            <div className="empty-state">
              <Unlock size={24} />
              <span>Nuk ka asnjë hapësirë</span>
            </div>
          )}
        </div>

        {isAdmin && (
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button onClick={() => setShowRegisterUser(true)} className="btn btn-secondary btn-sm">
              <UserPlus size={16} />
              <span>Regjistro Punonjës</span>
            </button>
          </div>
        )}
      </aside>

      {/* Pjesa Kryesore */}
      <main className="main-content">
        {successMsg && (
          <div 
            style={{
              backgroundColor: 'hsl(var(--accent-success) / 0.15)',
              border: '1px solid hsl(var(--accent-success) / 0.3)',
              color: 'hsl(var(--accent-success))',
              padding: '12px 20px',
              borderRadius: 'var(--border-radius-md)',
              fontSize: '0.85rem',
              display: 'flex',
              justify: 'space-between',
              alignItems: 'center'
            }}
          >
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg('')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>
        )}

        {activeSpace ? (
          <>
            <div className="content-header">
              <div className="space-info">
                <h2>{activeSpace.name}</h2>
                <p>{activeSpace.description || 'Nuk ka përshkrim për këtë hapësirë.'}</p>
                <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', marginTop: '6px' }}>
                  Anëtarë: {spaceMembers.length} | Krijuesi: {activeSpace.createdBy?.firstName} {activeSpace.createdBy?.lastName}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                {isAdmin && (
                  <>
                    <button onClick={() => setShowInviteMember(true)} className="btn btn-secondary">
                      <UserPlus size={18} />
                      <span>Fto Anëtar</span>
                    </button>
                    <button onClick={() => setShowCreateTask(true)} className="btn btn-primary">
                      <Plus size={18} />
                      <span>Shto Detyrë</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Detyrat e ndara në 3 kolona */}
            <div className="tasks-layout">
              {/* TODO */}
              <div className="task-column">
                <div className="column-header">
                  <span className="column-title" style={{ color: 'hsl(var(--accent-warning))' }}>
                    <Clock size={16} />
                    <span>Për t'u bërë</span>
                  </span>
                  <span className="column-count">{getTasksByStatus('TODO').length}</span>
                </div>
                <div className="task-card-list">
                  {getTasksByStatus('TODO').map(t => (
                    <div key={t.id} className="task-card" onClick={() => setSelectedTask(t)}>
                      <h4 className="task-card-title">{t.title}</h4>
                      {t.description && <p className="task-card-description">{t.description}</p>}
                      <div className="task-card-footer">
                        <span className="task-card-assignee">
                          {t.assignedTo ? `${t.assignedTo.firstName} ${t.assignedTo.lastName[0]}.` : 'I pacaktuar'}
                        </span>
                        <span className={`task-card-deadline ${new Date(t.deadline) < new Date() ? 'danger' : 'normal'}`}>
                          <Calendar size={12} />
                          {new Date(t.deadline).toLocaleDateString('sq-AL', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* IN_PROGRESS */}
              <div className="task-column">
                <div className="column-header">
                  <span className="column-title" style={{ color: 'hsl(var(--primary))' }}>
                    <Play size={16} />
                    <span>Në proces</span>
                  </span>
                  <span className="column-count">{getTasksByStatus('IN_PROGRESS').length}</span>
                </div>
                <div className="task-card-list">
                  {getTasksByStatus('IN_PROGRESS').map(t => (
                    <div key={t.id} className="task-card" onClick={() => setSelectedTask(t)}>
                      <h4 className="task-card-title">{t.title}</h4>
                      {t.description && <p className="task-card-description">{t.description}</p>}
                      <div className="task-card-footer">
                        <span className="task-card-assignee">
                          {t.assignedTo ? `${t.assignedTo.firstName} ${t.assignedTo.lastName[0]}.` : 'I pacaktuar'}
                        </span>
                        <span className={`task-card-deadline ${new Date(t.deadline) < new Date() ? 'danger' : 'normal'}`}>
                          <Calendar size={12} />
                          {new Date(t.deadline).toLocaleDateString('sq-AL', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* COMPLETED */}
              <div className="task-column">
                <div className="column-header">
                  <span className="column-title" style={{ color: 'hsl(var(--accent-success))' }}>
                    <CheckCircle2 size={16} />
                    <span>E përfunduar</span>
                  </span>
                  <span className="column-count">{getTasksByStatus('COMPLETED').length}</span>
                </div>
                <div className="task-card-list">
                  {getTasksByStatus('COMPLETED').map(t => (
                    <div key={t.id} className="task-card" onClick={() => setSelectedTask(t)} style={{ opacity: 0.8 }}>
                      <h4 className="task-card-title" style={{ textDecoration: 'line-through' }}>{t.title}</h4>
                      {t.description && <p className="task-card-description">{t.description}</p>}
                      <div className="task-card-footer">
                        <span className="task-card-assignee">
                          {t.assignedTo ? `${t.assignedTo.firstName} ${t.assignedTo.lastName[0]}.` : 'I pacaktuar'}
                        </span>
                        <span className="task-card-deadline normal">
                          <CheckCircle2 size={12} style={{ color: 'hsl(var(--accent-success))' }} />
                          Kryer
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state" style={{ margin: 'auto', maxWidth: '400px' }}>
            <Unlock size={48} />
            <h3>Mirëseerdhët në Virtuo</h3>
            <p>Për të filluar punën, ju lutem krijoni një hapësirë të re ose zgjidhni një ekzistuese në sidebar.</p>
          </div>
        )}
      </main>

      {/* MODAL: KRIJO SPACE */}
      {showCreateSpace && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Krijo Hapësirë të Re</h3>
              <button className="modal-close-btn" onClick={() => setShowCreateSpace(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreateSpace}>
              <div className="modal-body">
                {errorMsg && <div style={{ color: 'hsl(var(--accent-danger))', marginBottom: '15px' }}>{errorMsg}</div>}
                <div className="form-group">
                  <label>Emri i Hapësirës</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={spaceName} 
                    onChange={e => setSpaceName(e.target.value)} 
                    placeholder="p.sh. Departamenti i Financës" 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Përshkrimi (Opsional)</label>
                  <textarea 
                    className="input-field" 
                    style={{ minHeight: '80px', resize: 'vertical' }}
                    value={spaceDesc} 
                    onChange={e => setSpaceDesc(e.target.value)} 
                    placeholder="Shkruani një përshkrim të shkurtër"
                  />
                </div>
                <div className="form-group" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px' }}>Hapësirë Ekzekutive Private</label>
                    <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>
                      Vetëm për Shefat/Menaxhmentin. Punonjësit nuk do ta shohin.
                    </span>
                  </div>
                  <label className="switch">
                    <input 
                      type="checkbox" 
                      checked={spacePrivate} 
                      onChange={e => setSpacePrivate(e.target.checked)} 
                    />
                    <span className="slider"></span>
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateSpace(false)}>Anulo</button>
                <button type="submit" className="btn btn-primary">Krijo</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: FTO ANETAR */}
      {showInviteMember && activeSpace && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Fto Anëtar te: {activeSpace.name}</h3>
              <button className="modal-close-btn" onClick={() => setShowInviteMember(false)}>&times;</button>
            </div>
            <form onSubmit={handleInviteMember}>
              <div className="modal-body">
                {errorMsg && <div style={{ color: 'hsl(var(--accent-danger))', marginBottom: '15px' }}>{errorMsg}</div>}
                <div className="form-group">
                  <label>Zgjidh Përdoruesin</label>
                  <select 
                    className="input-field"
                    value={selectedInviteUser}
                    onChange={e => setSelectedInviteUser(e.target.value)}
                    required
                  >
                    <option value="">Zgjidh një anëtar...</option>
                    {users
                      .filter(u => !activeSpace.isPrivate || u.role === 'ADMIN')
                      .filter(u => !spaceMembers.some(m => m.id === u.id))
                      .map(u => (
                        <option key={u.id} value={u.id}>
                          {u.firstName} {u.lastName} ({u.email}) - [{u.role}]
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowInviteMember(false)}>Anulo</button>
                <button type="submit" className="btn btn-primary">Fto Anëtar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: SHTO TASK */}
      {showCreateTask && activeSpace && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Shto Detyrë të Re</h3>
              <button className="modal-close-btn" onClick={() => setShowCreateTask(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreateTask}>
              <div className="modal-body">
                {errorMsg && <div style={{ color: 'hsl(var(--accent-danger))', marginBottom: '15px' }}>{errorMsg}</div>}
                <div className="form-group">
                  <label>Titulli i Detyrës</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={taskTitle} 
                    onChange={e => setTaskTitle(e.target.value)} 
                    placeholder="p.sh. Përgatit raportin mujor" 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Përshkrimi</label>
                  <textarea 
                    className="input-field" 
                    style={{ minHeight: '80px', resize: 'vertical' }}
                    value={taskDesc} 
                    onChange={e => setTaskDesc(e.target.value)} 
                    placeholder="Çfarë duhet të bëhet..."
                  />
                </div>
                <div className="form-group">
                  <label>Afati i Fundit (Deadline)</label>
                  <input 
                    type="datetime-local" 
                    className="input-field" 
                    value={taskDeadline} 
                    onChange={e => setTaskDeadline(e.target.value)} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Caktoja Punonjësit (Opsional)</label>
                  <select 
                    className="input-field"
                    value={taskAssignee}
                    onChange={e => setTaskAssignee(e.target.value)}
                  >
                    <option value="">I pacaktuar (Asnjë)</option>
                    {spaceMembers.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateTask(false)}>Anulo</button>
                <button type="submit" className="btn btn-primary">Krijo Detyrë</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGJISTRO PUNONJES */}
      {showRegisterUser && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Regjistro Përdorues të Ri</h3>
              <button className="modal-close-btn" onClick={() => setShowRegisterUser(false)}>&times;</button>
            </div>
            <form onSubmit={handleRegisterUser}>
              <div className="modal-body">
                {errorMsg && <div style={{ color: 'hsl(var(--accent-danger))', marginBottom: '15px' }}>{errorMsg}</div>}
                <div className="form-group">
                  <label>Emri</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={regFirstName} 
                    onChange={e => setRegFirstName(e.target.value)} 
                    placeholder="Filan" 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Mbiemri</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={regLastName} 
                    onChange={e => setRegLastName(e.target.value)} 
                    placeholder="Fisteku" 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Email Adresa</label>
                  <input 
                    type="email" 
                    className="input-field" 
                    value={regEmail} 
                    onChange={e => setRegEmail(e.target.value)} 
                    placeholder="filan@kompania.com" 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Fjalëkalimi</label>
                  <input 
                    type="password" 
                    className="input-field" 
                    value={regPassword} 
                    onChange={e => setRegPassword(e.target.value)} 
                    placeholder="Fjalëkalim i sigurt..." 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Roli i Përdoruesit</label>
                  <select 
                    className="input-field"
                    value={regRole}
                    onChange={e => setRegRole(e.target.value)}
                    required
                  >
                    <option value="USER">Punonjës (User)</option>
                    <option value="ADMIN">Menaxher / Shef (Admin)</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowRegisterUser(false)}>Anulo</button>
                <button type="submit" className="btn btn-primary">Regjistro</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DETAJET E TASK-UT */}
      {selectedTask && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3 style={{ textDecoration: selectedTask.status === 'COMPLETED' ? 'line-through' : 'none' }}>
                {selectedTask.title}
              </h3>
              <button className="modal-close-btn" onClick={() => setSelectedTask(null)}>&times;</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <span className="task-detail-label">Statusi i Detyrës</span>
                  <div style={{ marginTop: '6px' }}>
                    <select
                      className="input-field"
                      value={selectedTask.status}
                      onChange={e => handleStatusChange(selectedTask.id, e.target.value)}
                      style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                    >
                      <option value="TODO">Për t'u bërë (TODO)</option>
                      <option value="IN_PROGRESS">Në proces (IN PROGRESS)</option>
                      <option value="COMPLETED">E përfunduar (COMPLETED)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <span className="task-detail-label">Afati i fundit</span>
                  <div className="task-detail-val" style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={16} />
                    <span>
                      {new Date(selectedTask.deadline).toLocaleString('sq-AL', {
                        dateStyle: 'medium',
                        timeStyle: 'short'
                      })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="task-detail-section" style={{ marginBottom: '20px' }}>
                <span className="task-detail-label">Përshkrimi</span>
                <p style={{ marginTop: '6px', fontSize: '0.95rem', color: 'hsl(var(--text-secondary))', whiteSpace: 'pre-line' }}>
                  {selectedTask.description || 'Nuk ka përshkrim për këtë detyrë.'}
                </p>
              </div>

              {/* Shtojcat (Attachments) */}
              <div className="task-detail-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span className="task-detail-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Paperclip size={16} />
                    <span>Skedarët e bashkëngjitur ({selectedTask.attachments?.length || 0})</span>
                  </span>
                  
                  <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', padding: '4px 10px' }}>
                    <FileUp size={14} />
                    <span>{uploadingFile ? 'Po ngarkohet...' : 'Ngarko Skedar'}</span>
                    <input type="file" onChange={handleFileUpload} disabled={uploadingFile} style={{ display: 'none' }} />
                  </label>
                </div>

                <div className="attachments-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedTask.attachments && selectedTask.attachments.length > 0 ? (
                    selectedTask.attachments.map(att => (
                      <div 
                        key={att.id} 
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justify: 'space-between',
                          padding: '8px 12px',
                          backgroundColor: 'hsl(var(--bg-secondary))',
                          borderRadius: 'var(--border-radius-sm)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                          <FileText size={16} />
                          <span style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {att.fileName}
                          </span>
                        </div>
                        <a 
                          href={`/api/attachments/${att.id}/download`} 
                          download 
                          className="btn btn-secondary btn-sm" 
                          style={{ padding: '4px 8px' }}
                        >
                          <Download size={14} />
                        </a>
                      </div>
                    ))
                  ) : (
                    <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>Nuk ka skedarë të bashkëngjitur.</span>
                  )}
                </div>
              </div>

            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setSelectedTask(null)}>Mbyll</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}