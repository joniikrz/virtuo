import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { User, Space, Task } from '../types';
import { LockKeyhole, Plus, ShieldCheck, Trash2, UserPlus, Users, X } from 'lucide-react';
import SpaceSidebar from './SpaceSidebar';
import TaskBoard from './TaskBoard';
import TaskDetailModal from './TaskDetailModal';
import CreateTaskModal from './CreateTaskModal';
import EditTaskModal from './EditTaskModal';
import CreateSpaceModal from './CreateSpaceModal';
import InviteMemberModal from './InviteMemberModal';
import RegisterUserModal from './RegisterUserModal';
import StatsPanel from './StatsPanel';
import TaskFilters, { DEFAULT_TASK_FILTERS, TaskFiltersState } from './TaskFilters';
import type { TaskNavigationRequest } from '../App';
import { apiErrorMessage, readApiJson } from '../lib/api';

interface DashboardProps {
  currentUser: User;
  taskNavigationRequest: TaskNavigationRequest | null;
  onTaskNavigationHandled: () => void;
  onTaskNavigationUnavailable: (notificationId: string) => void;
}

const priorityWeight: Record<string, number> = { LOW: 1, NORMAL: 2, HIGH: 3, URGENT: 4 };

const getAssigneeIds = (task: Task) => task.assignees?.length
  ? task.assignees.map((assignment) => assignment.user.id)
  : task.assignedTo ? [task.assignedTo.id] : [];

const isSameCalendarDay = (first: Date, second: Date) => (
  first.getFullYear() === second.getFullYear()
  && first.getMonth() === second.getMonth()
  && first.getDate() === second.getDate()
);

const taskDataRevision = (spaceId: string, tasks: Task[]) => `${spaceId}|${tasks.map((task) => [
  task.id,
  task.updatedAt || '',
  task.status,
  task._count?.comments || 0,
  task._count?.attachments || 0,
].join(':')).join('|')}`;

export default function Dashboard({ currentUser, taskNavigationRequest, onTaskNavigationHandled, onTaskNavigationUnavailable }: DashboardProps) {
  const isAdmin = currentUser.role === 'ADMIN';

  const [spaces, setSpaces] = useState<Space[]>([]);
  const [activeSpace, setActiveSpace] = useState<Space | null>(null);
  const isSpaceOwner = Boolean(activeSpace && activeSpace.createdBy?.id === currentUser.id);
  const canManageActiveSpace = isSpaceOwner;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [spaceMembers, setSpaceMembers] = useState<User[]>([]);
  const canCreateTask = Boolean(activeSpace && spaceMembers.some((member) => member.id === currentUser.id));

  const [showCreateSpace, setShowCreateSpace] = useState(false);
  const [showInviteMember, setShowInviteMember] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showEditTask, setShowEditTask] = useState(false);
  const [showRegisterUser, setShowRegisterUser] = useState(false);

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [taskFilters, setTaskFilters] = useState<TaskFiltersState>(DEFAULT_TASK_FILTERS);
  const activeSpaceIdRef = useRef<string | null>(null);
  const tasksRevisionRef = useRef('');
  const taskEtagsRef = useRef<Record<string, string>>({});
  activeSpaceIdRef.current = activeSpace?.id || null;

  const filteredTasks = useMemo(() => {
    const now = new Date();
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(now.getDate() + 7);
    const query = taskFilters.query.trim().toLocaleLowerCase('sq-AL');

    const matchingTasks = tasks.filter((task) => {
      const assigneeIds = getAssigneeIds(task);
      const deadline = task.deadline ? new Date(task.deadline) : null;
      const hasValidDeadline = Boolean(deadline && !Number.isNaN(deadline.getTime()));
      const searchableText = [
        task.title,
        task.description,
        task.createdBy?.firstName,
        task.createdBy?.lastName,
        ...(task.assignees || []).flatMap(({ user }) => [user.firstName, user.lastName, user.email]),
        ...(task.tags || []).map(({ tag }) => tag.name),
      ].filter(Boolean).join(' ').toLocaleLowerCase('sq-AL');

      if (query && !searchableText.includes(query)) return false;
      if (taskFilters.status !== 'ALL' && task.status !== taskFilters.status) return false;
      if (taskFilters.priority !== 'ALL' && task.priority !== taskFilters.priority) return false;
      if (taskFilters.assignee === 'UNASSIGNED' && assigneeIds.length > 0) return false;
      if (taskFilters.assignee !== 'ALL' && taskFilters.assignee !== 'UNASSIGNED' && !assigneeIds.includes(taskFilters.assignee)) return false;
      if (taskFilters.tag !== 'ALL' && !(task.tags || []).some(({ tag }) => tag.id === taskFilters.tag)) return false;
      if (taskFilters.relationship === 'ASSIGNED_TO_ME' && !assigneeIds.includes(currentUser.id)) return false;
      if (taskFilters.relationship === 'CREATED_BY_ME' && task.createdBy?.id !== currentUser.id) return false;

      if (taskFilters.deadline === 'NO_DEADLINE' && hasValidDeadline) return false;
      if (taskFilters.deadline !== 'ALL' && taskFilters.deadline !== 'NO_DEADLINE' && !hasValidDeadline) return false;
      if (deadline && hasValidDeadline) {
        if (taskFilters.deadline === 'OVERDUE' && !(deadline < now && task.status !== 'COMPLETED')) return false;
        if (taskFilters.deadline === 'TODAY' && !isSameCalendarDay(deadline, now)) return false;
        if (taskFilters.deadline === 'NEXT_7_DAYS' && !(deadline >= now && deadline <= sevenDaysFromNow)) return false;
      }
      return true;
    });

    return matchingTasks.sort((first, second) => {
      if (taskFilters.sort === 'DEADLINE_ASC') return new Date(first.deadline).getTime() - new Date(second.deadline).getTime();
      if (taskFilters.sort === 'DEADLINE_DESC') return new Date(second.deadline).getTime() - new Date(first.deadline).getTime();
      if (taskFilters.sort === 'PRIORITY_DESC') return (priorityWeight[second.priority] || 0) - (priorityWeight[first.priority] || 0);
      if (taskFilters.sort === 'TITLE_ASC') return first.title.localeCompare(second.title, 'sq');
      if (taskFilters.sort === 'CREATED_DESC') return new Date(second.createdAt || 0).getTime() - new Date(first.createdAt || 0).getTime();
      return 0;
    });
  }, [tasks, taskFilters, currentUser.id]);

  // Fetching Logic
  const fetchSpaces = async () => {
    try {
      const res = await fetch('/api/spaces');
      if (res.ok) {
        const data = await res.json();
        setSpaces(data);
        setActiveSpace((current) => {
          if (data.length === 0) return null;
          if (!current) return data[0];
          return data.find((space: Space) => space.id === current.id) || data[0];
        });
      }
    } catch (err) { console.error(err); }
  };

  const fetchTasks = useCallback(async (spaceId: string) => {
    try {
      const etag = taskEtagsRef.current[spaceId];
      const res = await fetch(`/api/spaces/${spaceId}/tasks`, {
        cache: 'no-store',
        headers: etag ? { 'If-None-Match': etag } : undefined,
      });
      if (res.status === 304) return;
      if (res.ok) {
        const data: Task[] = await res.json();
        if (activeSpaceIdRef.current !== spaceId) return;
        const nextEtag = res.headers.get('ETag');
        if (nextEtag) taskEtagsRef.current[spaceId] = nextEtag;
        const revision = taskDataRevision(spaceId, data);
        if (tasksRevisionRef.current === revision) return;
        tasksRevisionRef.current = revision;
        setTasks(data);
        setSelectedTask((current) => {
          if (!current) return null;
          return data.some((task) => task.id === current.id) ? current : null;
        });
      }
    } catch (err) { console.error(err); }
  }, []);

  const fetchTaskDetail = useCallback(async (taskId: string): Promise<Task | null> => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { cache: 'no-store' });
      if (!res.ok) return null;
      return await res.json() as Task;
    } catch (error) {
      console.error('Gabim gjatë marrjes së detajeve të detyrës:', error);
      return null;
    }
  }, []);

  const handleTaskClick = useCallback(async (task: Task) => {
    const detailedTask = await fetchTaskDetail(task.id);
    if (detailedTask) setSelectedTask(detailedTask);
  }, [fetchTaskDetail]);

  useEffect(() => {
    if (!taskNavigationRequest) return;
    let cancelled = false;

    const openNotificationTask = async () => {
      setErrorMsg('');
      // Mos e lër detyrën e hapur më parë të duket sikur i përket njoftimit të ri.
      setSelectedTask(null);
      setShowEditTask(false);
      try {
        const taskResponse = await fetch(`/api/tasks/${taskNavigationRequest.taskId}`, { cache: 'no-store' });
        if (taskResponse.status === 404) {
          if (taskNavigationRequest.notificationId) {
            onTaskNavigationUnavailable(taskNavigationRequest.notificationId);
            throw new Error('Kjo detyrë është fshirë. Njoftimi i vjetër u hoq automatikisht.');
          }
          throw new Error('Detyra nuk u gjet ose nuk ke më qasje në të.');
        }
        if (!taskResponse.ok) throw new Error('Detyra nuk mund të ngarkohet tani. Provo përsëri.');
        const detailedTask = await taskResponse.json() as Task;

        let availableSpaces = spaces;
        let targetSpace = availableSpaces.find((space) => space.id === detailedTask.spaceId);
        if (!targetSpace) {
          const response = await fetch('/api/spaces', { cache: 'no-store' });
          if (!response.ok) throw new Error('Hapësira e detyrës nuk mund të ngarkohet.');
          availableSpaces = await response.json() as Space[];
          targetSpace = availableSpaces.find((space) => space.id === detailedTask.spaceId);
          if (!cancelled) setSpaces(availableSpaces);
        }
        if (!targetSpace) throw new Error('Hapësira e kësaj detyre nuk është më e disponueshme.');

        if (!cancelled) {
          setActiveSpace(targetSpace);
          setSelectedTask(detailedTask);
          setTaskFilters(DEFAULT_TASK_FILTERS);
        }
      } catch (error) {
        if (!cancelled) setErrorMsg(error instanceof Error ? error.message : 'Detyra nuk mund të hapet.');
      } finally {
        if (!cancelled) onTaskNavigationHandled();
      }
    };

    void openNotificationTask();
    return () => { cancelled = true; };
  }, [taskNavigationRequest?.requestId]);

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
    void fetchSpaces();
  }, []);

  useEffect(() => {
    const refreshSpaces = () => void fetchSpaces();
    window.addEventListener('virtuo:data-change', refreshSpaces);
    return () => window.removeEventListener('virtuo:data-change', refreshSpaces);
  }, []);

  useEffect(() => {
    if (activeSpace) {
      tasksRevisionRef.current = '';
      setTaskFilters(DEFAULT_TASK_FILTERS);
      void fetchTasks(activeSpace.id);
      void fetchSpaceMembers(activeSpace.id);
    } else {
      setTasks([]);
      setSelectedTask(null);
    }
  }, [activeSpace, fetchTasks]);

  useEffect(() => {
    if (!activeSpace) return;
    let requestInFlight = false;
    const refresh = async () => {
      if (requestInFlight || document.visibilityState !== 'visible') return;
      requestInFlight = true;
      try {
        await fetchTasks(activeSpace.id);
      } finally {
        requestInFlight = false;
      }
    };
    const onFocus = () => void refresh();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const intervalId = window.setInterval(() => void refresh(), 10000);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [activeSpace, fetchTasks]);

  useEffect(() => {
    const taskId = selectedTask?.id;
    if (!taskId) return;
    let requestInFlight = false;
    const refreshDetail = async () => {
      if (requestInFlight || document.visibilityState !== 'visible') return;
      requestInFlight = true;
      try {
        const detailedTask = await fetchTaskDetail(taskId);
        if (detailedTask) setSelectedTask((current) => current?.id === taskId ? detailedTask : current);
      } finally {
        requestInFlight = false;
      }
    };
    const intervalId = window.setInterval(() => void refreshDetail(), 7000);
    return () => window.clearInterval(intervalId);
  }, [selectedTask?.id, fetchTaskDetail]);

  // Handlers
  const handleCreateSpace = async (name: string) => {
    setErrorMsg('');
    try {
      const res = await fetch('/api/spaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const createdSpace = { ...data, createdBy: { id: currentUser.id, firstName: currentUser.firstName, lastName: currentUser.lastName } };
      setSpaces((current) => [...current, createdSpace]);
      setActiveSpace(createdSpace);
      setShowCreateSpace(false);
      setSuccessMsg('Hapësira u krijua me sukses.');
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleInviteMember = async (email: string) => {
    setErrorMsg('');
    if (!activeSpace) return;
    try {
      const res = await fetch(`/api/spaces/${activeSpace.id}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowInviteMember(false);
      setSuccessMsg(data.message || 'Ftesa u dërgua me sukses.');
      window.dispatchEvent(new Event('virtuo:data-change'));
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
      const data = await readApiJson<Task>(res);
      if (!res.ok) throw new Error(apiErrorMessage(res, data, 'Detyra nuk mund të krijohet.'));

      setTasks((current) => [data, ...current]);
      setShowCreateTask(false);
      setSuccessMsg('Detyra u krijua me sukses.');
      void fetchSpaces();
      window.dispatchEvent(new Event('virtuo:data-change'));
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

      setTasks((current) => current.map((task) => task.id === selectedTask.id ? data : task));
      setSelectedTask(data);
      setShowEditTask(false);
      setSuccessMsg('Detyra u përditësua me sukses.');
      window.dispatchEvent(new Event('virtuo:data-change'));
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
        setTasks((current) => current.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
        setSelectedTask((current) => current?.id === taskId ? { ...current, status: newStatus } : current);
        window.dispatchEvent(new Event('virtuo:data-change'));
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
        setTasks((current) => current.map((task) => task.id === taskId ? updatedTask : task));
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
      await Promise.all([fetchSpaceMembers(activeSpace.id), fetchSpaces()]);
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
    window.dispatchEvent(new Event('virtuo:data-change'));
  };

  const handleDeleteComment = async (taskId: string, commentId: string) => {
    if (!window.confirm('A dëshiron ta fshish këtë koment?')) return;
    const res = await fetch(`/api/tasks/${taskId}/comments/${commentId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Komenti nuk u fshi');
    const updateTask = (task: Task) => task.id === taskId
      ? { ...task, comments: (task.comments || []).filter((comment) => comment.id !== commentId) }
      : task;
    setTasks((current) => current.map(updateTask));
    setSelectedTask((current) => current && updateTask(current));
    setSuccessMsg('Komenti u fshi.');
    window.dispatchEvent(new Event('virtuo:data-change'));
  };

  const handleDeleteAttachment = async (taskId: string, attachmentId: string) => {
    if (!window.confirm('A dëshiron ta fshish këtë skedar?')) return;
    const res = await fetch(`/api/tasks/${taskId}/attachments/${attachmentId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Skedari nuk u fshi');
    const updateTask = (task: Task) => task.id === taskId
      ? { ...task, attachments: (task.attachments || []).filter((attachment) => attachment.id !== attachmentId) }
      : task;
    setTasks((current) => current.map(updateTask));
    setSelectedTask((current) => current && updateTask(current));
    setSuccessMsg('Skedari u fshi.');
    window.dispatchEvent(new Event('virtuo:data-change'));
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('A dëshiron ta fshish këtë detyrë?')) return;
    const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Detyra nuk u fshi');
    setTasks((current) => current.filter((task) => task.id !== taskId));
    await fetchSpaces();
    setSelectedTask(null);
    setSuccessMsg('Detyra u fshi.');
    window.dispatchEvent(new Event('virtuo:data-change'));
  };

  const handleDeleteSpace = async () => {
    if (!activeSpace || !window.confirm(`A dëshiron ta fshish hapësirën "${activeSpace.name}" dhe të gjitha detyrat e saj?`)) return;
    const spaceId = activeSpace.id;
    const res = await fetch(`/api/spaces/${spaceId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) { setErrorMsg(data.error || 'Hapësira nuk u fshi'); return; }
    setSpaces((current) => current.filter((space) => space.id !== spaceId));
    setActiveSpace(null);
    setTasks([]);
    setSpaceMembers([]);
    setSuccessMsg('Hapësira dhe të dhënat e lidhura u fshinë.');
  };

  return (
    <div className="dashboard-layout">
      
      <SpaceSidebar 
        spaces={spaces}
        activeSpace={activeSpace}
        isAdmin={isAdmin}
        onSelectSpace={setActiveSpace}
        onShowCreateSpace={() => { setErrorMsg(''); setShowCreateSpace(true); }}
        onShowRegisterUser={() => { setErrorMsg(''); setShowRegisterUser(true); }}
      />

      <main className="main-content dashboard-main">
        {successMsg && (
          <div className="dashboard-alert dashboard-alert--success">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg('')} aria-label="Mbyll mesazhin">
              <X size={16} />
            </button>
          </div>
        )}

        {activeSpace ? (
          <>
            <div className="content-header workspace-hero">
              <div className="space-info">
                <span className="workspace-hero__eyebrow"><ShieldCheck size={14} /> Hapësirë private</span>
                <h1>{activeSpace.name}</h1>
                <div className="workspace-hero__meta">
                  <span><Users size={14} /> {spaceMembers.length} {spaceMembers.length === 1 ? 'anëtar' : 'anëtarë'}</span>
                  <span className="workspace-hero__separator" />
                  <span>Krijuar nga <strong>{activeSpace.createdBy?.firstName} {activeSpace.createdBy?.lastName}</strong></span>
                </div>
              </div>

              <div className="workspace-hero__actions">
                {canManageActiveSpace && (
                  <button onClick={() => { setErrorMsg(''); setShowInviteMember(true); }} className="btn btn-secondary">
                    <UserPlus size={18} />
                    <span>Menaxho anëtarët</span>
                  </button>
                )}
                {isSpaceOwner && (
                  <button onClick={handleDeleteSpace} className="btn btn-secondary btn-danger-soft">
                    <Trash2 size={18} />
                    <span>Fshij hapësirën</span>
                  </button>
                )}
                {canCreateTask && (
                  <button onClick={() => { setErrorMsg(''); setShowCreateTask(true); }} className="btn btn-primary">
                    <Plus size={18} />
                    <span>Shto detyrë</span>
                  </button>
                )}
              </div>
            </div>

            <StatsPanel tasks={tasks} membersCount={spaceMembers.length} />

            <TaskFilters
              tasks={tasks}
              members={spaceMembers}
              filters={taskFilters}
              resultCount={filteredTasks.length}
              onChange={setTaskFilters}
            />

            <TaskBoard tasks={filteredTasks} statusFilter={taskFilters.status} onTaskClick={handleTaskClick} />
          </>
        ) : (
          <div className="empty-state dashboard-empty">
            <span className="dashboard-empty__icon"><LockKeyhole size={30} /></span>
            <h3 style={{ marginBottom: '8px' }}>Mirëseerdhët në Virtuo</h3>
            <p style={{ color: 'hsl(var(--text-secondary))' }}>
              Krijo një hapësirë të re ose zgjidh një ekzistuese nga lista për të filluar punën.
            </p>
            <button onClick={() => { setErrorMsg(''); setShowCreateSpace(true); }} className="btn btn-primary" style={{ marginTop: '16px' }}>
              <Plus size={18} />
              <span>Krijo hapësirën e parë</span>
            </button>
          </div>
        )}
      </main>

      {/* Modals */}
      {showCreateSpace && (
        <CreateSpaceModal 
          onClose={() => setShowCreateSpace(false)} 
          onSubmit={handleCreateSpace} 
          errorMsg={errorMsg} 
        />
      )}

      {showInviteMember && activeSpace && (
        <InviteMemberModal 
          activeSpace={activeSpace}
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
          key={selectedTask.id}
          task={selectedTask}
          canEdit={selectedTask.createdBy?.id === currentUser.id}
          onClose={() => setSelectedTask(null)}
          onStatusChange={handleStatusChange}
          onFileUpload={handleFileUpload}
          uploadingFile={uploadingFile}
          onAddComment={handleAddComment}
          onDeleteComment={handleDeleteComment}
          onDeleteAttachment={handleDeleteAttachment}
          currentUserId={currentUser.id}
          canDelete={selectedTask.createdBy?.id === currentUser.id}
          onDelete={handleDeleteTask}
          onEditClick={() => {
            setErrorMsg('');
            setShowEditTask(true);
          }}
        />
      )}

    </div>
  );
}
