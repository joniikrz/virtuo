import React, { useState, useEffect } from 'react';
import { User, Space, Task, Notification } from '../types';
import { Unlock, Plus, UserPlus, X } from 'lucide-react';
import SpaceSidebar from './SpaceSidebar';
import TaskBoard from './TaskBoard';
import TaskDetailModal from './TaskDetailModal';
import CreateTaskModal from './CreateTaskModal';
import EditTaskModal from './EditTaskModal';
import CreateSpaceModal from './CreateSpaceModal';
import InviteMemberModal from './InviteMemberModal';
import RegisterUserModal from './RegisterUserModal';
import StatsPanel from './StatsPanel';

interface DashboardProps {
  currentUser: User;
}

export default function Dashboard({ currentUser }: DashboardProps) {
  const isAdmin = currentUser.role === 'ADMIN';

  const [spaces, setSpaces] = useState<Space[]>([]);
  const [activeSpace, setActiveSpace] = useState<Space | null>(null);
  const canManageActiveSpace = Boolean(activeSpace && (isAdmin || activeSpace.createdBy?.id === currentUser.id));
  const canCreateTask = Boolean(activeSpace && (isAdmin || spaceMembers.some((member) => member.id === currentUser.id)));
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [spaceMembers, setSpaceMembers] = useState<User[]>([]);

  const [showCreateSpace, setShowCreateSpace] = useState(false);
  const [showInviteMember, setShowInviteMember] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showEditTask, setShowEditTask] = useState(false);
  const [showRegisterUser, setShowRegisterUser] = useState(false);

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Fetching Logic
  const fetchSpaces = async () => {
    try {
      const res = await fetch('/api/spaces');
      if (res.ok) {
        const data = await res.json();
        setSpaces(data);
        if (data.length > 0 && !activeSpace) setActiveSpace(data[0]);
      }
    } catch (err) { console.error(err); }
  };

  const fetchAllUsers = async () => {
    try {
      const res = await fetch('/api/auth/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) { console.error(err); }
  };

  const fetchTasks = async (spaceId: string) => {
    try {
      const res = await fetch(`/api/spaces/${spaceId}/tasks`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } catch (err) { console.error(err); }
  };

  const fetchSpaceMembers = async (spaceId: string) => {
    try {
      const res = await fetch(`/api/spaces/${spaceId}/members`);
      if (res.ok) {
        const data = await res.json();
        setSpaceMembers(data);
      }
    } catch (err) { console.error(err); }
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

  // Handlers
  const handleCreateSpace = async (name: string, memberIds: string[]) => {
    setErrorMsg('');
    try {
      const res = await fetch('/api/spaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, memberIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const createdSpace = { ...data, createdBy: { id: currentUser.id, firstName: currentUser.firstName, lastName: currentUser.lastName } };
      setSpaces([...spaces, createdSpace]);
      setActiveSpace(createdSpace);
      setShowCreateSpace(false);
      setSuccessMsg('Hapësira u krijua me sukses.');
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleInviteMember = async (userId: string) => {
    setErrorMsg('');
    if (!activeSpace) return;
    try {
      const res = await fetch(`/api/spaces/${activeSpace.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowInviteMember(false);
      fetchSpaceMembers(activeSpace.id);
      setSuccessMsg('Anëtari u shtua me sukses në hapësirë.');
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleCreateTask = async (taskData: any) => {
    setErrorMsg('');
    if (!activeSpace) return;
    try {
      const res = await fetch(`/api/spaces/${activeSpace.id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setTasks([data, ...tasks]);
      setShowCreateTask(false);
      setSuccessMsg('Detyra u krijua me sukses.');
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleEditTask = async (taskData: any) => {
    setErrorMsg('');
    if (!selectedTask) return;
    try {
      const res = await fetch(`/api/tasks/${selectedTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setTasks(tasks.map(t => t.id === selectedTask.id ? data : t));
      setSelectedTask(data);
      setShowEditTask(false);
      setSuccessMsg('Detyra u përditësua me sukses.');
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleRegisterUser = async (userData: any) => {
    setErrorMsg('');
    try {
      const res = await fetch('/api/auth/register-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowRegisterUser(false);
      fetchAllUsers();
      setSuccessMsg('Llogaria e re u krijua me sukses.');
    } catch (err: any) {
      setErrorMsg(err.message);
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
        setTasks(tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
        if (selectedTask && selectedTask.id === taskId) {
          setSelectedTask({ ...selectedTask, status: newStatus });
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileUpload = async (taskId: string, file: File) => {
    setUploadingFile(true);
    setErrorMsg('');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`/api/tasks/${taskId}/attachments`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (selectedTask && selectedTask.id === taskId) {
        const updatedTask = { ...selectedTask, attachments: [...(selectedTask.attachments || []), data] };
        setSelectedTask(updatedTask);
        setTasks(tasks.map(t => t.id === taskId ? updatedTask : t));
      }
      setSuccessMsg('Skedari u ngarkua me sukses.');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setUploadingFile(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!activeSpace) return;
    setErrorMsg('');
    try {
      const res = await fetch(`/api/spaces/${activeSpace.id}/members/${userId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchSpaceMembers(activeSpace.id);
      setSuccessMsg('Anëtari u hoq nga hapësira.');
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleAddComment = async (taskId: string, content: string) => {
    setErrorMsg('');
    const res = await fetch(`/api/tasks/${taskId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Komenti nuk u ruajt');
    const updateTask = (task: Task) => task.id === taskId ? { ...task, comments: [...(task.comments || []), data] } : task;
    setTasks((current) => current.map(updateTask));
    setSelectedTask((current) => current && updateTask(current));
  };

  return (
    <div className="dashboard-layout" style={{ display: 'flex', height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
      
      <SpaceSidebar 
        spaces={spaces}
        activeSpace={activeSpace}
        isAdmin={isAdmin}
        onSelectSpace={setActiveSpace}
        onShowCreateSpace={() => { setErrorMsg(''); setShowCreateSpace(true); }}
        onShowRegisterUser={() => { setErrorMsg(''); setShowRegisterUser(true); }}
      />

      <main className="main-content" style={{ flex: 1, overflowY: 'auto', padding: '24px', backgroundColor: 'hsl(var(--bg-primary))' }}>
        {successMsg && (
          <div style={{
            backgroundColor: 'hsl(var(--accent-success) / 0.15)',
            border: '1px solid hsl(var(--accent-success) / 0.3)',
            color: 'hsl(var(--accent-success))',
            padding: '12px 20px',
            borderRadius: 'var(--border-radius-md)',
            fontSize: '0.85rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px'
          }}>
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg('')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>
        )}

        {activeSpace ? (
          <>
            <div className="content-header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="space-info">
                <h2 style={{ marginBottom: '8px' }}>{activeSpace.name}</h2>
                <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
                  Hapësirë private · Anëtarë: {spaceMembers.length} | Krijuesi: {activeSpace.createdBy?.firstName} {activeSpace.createdBy?.lastName}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <>
                  {canManageActiveSpace && (
                    <button onClick={() => { setErrorMsg(''); setShowInviteMember(true); }} className="btn btn-secondary">
                      <UserPlus size={18} />
                      <span>Fto Anëtar</span>
                    </button>
                  )}
                  {canCreateTask && (
                    <button onClick={() => { setErrorMsg(''); setShowCreateTask(true); }} className="btn btn-primary">
                      <Plus size={18} />
                      <span>Shto Detyrë</span>
                    </button>
                  )}
                </>
              </div>
            </div>

            <StatsPanel tasks={tasks} membersCount={spaceMembers.length} />

            <TaskBoard tasks={tasks} onTaskClick={setSelectedTask} />
          </>
        ) : (
          <div className="empty-state" style={{ margin: 'auto', maxWidth: '400px', textAlign: 'center', marginTop: '100px' }}>
            <Unlock size={48} style={{ color: 'hsl(var(--text-muted))', marginBottom: '16px' }} />
            <h3 style={{ marginBottom: '8px' }}>Mirëseerdhët në Virtuo</h3>
            <p style={{ color: 'hsl(var(--text-secondary))' }}>
              Për të filluar punën, ju lutem krijoni një hapësirë të re ose zgjidhni një ekzistuese në sidebar.
            </p>
            <button onClick={() => { setErrorMsg(''); setShowCreateSpace(true); }} className="btn btn-primary" style={{ marginTop: '16px' }}>
              <Plus size={18} />
              <span>Krijo Hapësirën e parë</span>
            </button>
          </div>
        )}
      </main>

      {/* Modals */}
      {showCreateSpace && (
        <CreateSpaceModal 
          users={users}
          onClose={() => setShowCreateSpace(false)} 
          onSubmit={handleCreateSpace} 
          errorMsg={errorMsg} 
        />
      )}

      {showInviteMember && activeSpace && (
        <InviteMemberModal 
          activeSpace={activeSpace}
          users={users}
          spaceMembers={spaceMembers}
          onClose={() => setShowInviteMember(false)}
          onSubmit={handleInviteMember}
          onRemove={handleRemoveMember}
          errorMsg={errorMsg}
        />
      )}

      {showCreateTask && activeSpace && (
        <CreateTaskModal
          activeSpace={activeSpace}
          spaceMembers={spaceMembers}
          onClose={() => setShowCreateTask(false)}
          onSubmit={handleCreateTask}
          errorMsg={errorMsg}
        />
      )}

      {showEditTask && selectedTask && (
        <EditTaskModal
          task={selectedTask}
          spaceMembers={spaceMembers}
          onClose={() => setShowEditTask(false)}
          onSubmit={handleEditTask}
          errorMsg={errorMsg}
        />
      )}

      {showRegisterUser && (
        <RegisterUserModal
          onClose={() => setShowRegisterUser(false)}
          onSubmit={handleRegisterUser}
          errorMsg={errorMsg}
        />
      )}

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          isAdmin={isAdmin || selectedTask.createdBy?.id === currentUser.id}
          onClose={() => setSelectedTask(null)}
          onStatusChange={handleStatusChange}
          onFileUpload={handleFileUpload}
          uploadingFile={uploadingFile}
          onAddComment={handleAddComment}
          onEditClick={() => {
            setErrorMsg('');
            setShowEditTask(true);
          }}
        />
      )}

    </div>
  );
}
