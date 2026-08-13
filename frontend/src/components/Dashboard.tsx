import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { User, Space, Task } from '../types';
import { ListChecks, LockKeyhole, Plus, ShieldCheck, Trash2, UserPlus, Users, X } from 'lucide-react';
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
import { apiErrorMessage, apiFetch, readApiJson } from '../lib/api';

interface DashboardProps {
  currentUser: User;
  taskNavigationRequest: TaskNavigationRequest | null;
  onTaskNavigationHandled: () => void;
  onTaskNavigationUnavailable: (notificationId: string) => void;
  myTasksRequestId: number;
  onMyTasksViewChange: (isMyTasks: boolean) => void;
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

export default function Dashboard({ currentUser, taskNavigationRequest, onTaskNavigationHandled, onTaskNavigationUnavailable, myTasksRequestId, onMyTasksViewChange }: DashboardProps) {
  const isAdmin = currentUser.role === 'ADMIN';

  const [spaces, setSpaces] = useState<Space[]>([]);
  const [activeSpace, setActiveSpace] = useState<Space | null>(null);
  const [isMyTasks, setIsMyTasks] = useState(true);
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
  activeSpaceIdRef.current = isMyTasks ? '__my_tasks__' : activeSpace?.id || null;

  useEffect(() => onMyTasksViewChange(isMyTasks), [isMyTasks, onMyTasksViewChange]);

  useEffect(() => {
    if (myTasksRequestId === 0) return;
    setIsMyTasks(true);
    setSelectedTask(null);
    setShowEditTask(false);
  }, [myTasksRequestId]);

  const myTaskMembers = useMemo(() => {
    const users = tasks.flatMap((task) => task.assignees?.length
      ? task.assignees.map((assignment) => assignment.user)
      : task.assignedTo ? [task.assignedTo] : []);
    return [...new Map(users.map((user) => [user.id, user])).values()] as User[];
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const now = new Date();
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(now.getDate() + 7);
    const query = taskFilters.query.trim().toLocaleLowerCase('en-US');

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
      ].filter(Boolean).join(' ').toLocaleLowerCase('en-US');

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
      if (taskFilters.sort === 'TITLE_ASC') return first.title.localeCompare(second.title, 'en');
      if (taskFilters.sort === 'CREATED_DESC') return new Date(second.createdAt || 0).getTime() - new Date(first.createdAt || 0).getTime();
      return 0;
    });
  }, [tasks, taskFilters, currentUser.id]);

  // Fetching Logic
  const fetchSpaces = useCallback(async () => {
    try {
      const res = await apiFetch('/api/spaces');
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
  }, []);

  const fetchTasks = useCallback(async (spaceId: string) => {
    try {
      const etag = taskEtagsRef.current[spaceId];
      const res = await apiFetch(`/api/spaces/${spaceId}/tasks`, {
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

  const fetchMyTasks = useCallback(async () => {
    try {
      const viewKey = '__my_tasks__';
      const etag = taskEtagsRef.current[viewKey];
      const res = await apiFetch('/api/tasks?scope=assigned', {
        cache: 'no-store',
        headers: etag ? { 'If-None-Match': etag } : undefined,
      });
      if (res.status === 304) return;
      if (!res.ok || activeSpaceIdRef.current !== viewKey) return;
      const data = await readApiJson<Task[]>(res);
      const nextEtag = res.headers.get('ETag');
      if (nextEtag) taskEtagsRef.current[viewKey] = nextEtag;
      const revision = taskDataRevision(viewKey, data);
      if (tasksRevisionRef.current === revision) return;
      tasksRevisionRef.current = revision;
      setTasks(data);
      setSelectedTask((current) => current && data.some((task) => task.id === current.id) ? current : null);
    } catch (error) {
      console.error('Unable to fetch My Tasks:', error);
    }
  }, []);

  const fetchTaskDetail = useCallback(async (taskId: string): Promise<Task | null> => {
    try {
      const res = await apiFetch(`/api/tasks/${taskId}`, { cache: 'no-store' });
      if (!res.ok) return null;
      return await res.json() as Task;
    } catch (error) {
      console.error('Unable to fetch task details:', error);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!taskNavigationRequest) return;
    let cancelled = false;

    const openNotificationTask = async () => {
      setErrorMsg('');
      // Close the previous task before resolving a new notification target.
      setSelectedTask(null);
      setShowEditTask(false);
      try {
        const taskResponse = await apiFetch(`/api/tasks/${taskNavigationRequest.taskId}`, { cache: 'no-store' });
        if (taskResponse.status === 404) {
          if (taskNavigationRequest.notificationId) {
            onTaskNavigationUnavailable(taskNavigationRequest.notificationId);
            throw new Error('This task was deleted. Its outdated notification was removed automatically.');
          }
          throw new Error('The task was not found or you no longer have access to it.');
        }
        if (!taskResponse.ok) throw new Error('The task cannot be loaded right now. Please try again.');
        const detailedTask = await taskResponse.json() as Task;

        let availableSpaces = spaces;
        let targetSpace = availableSpaces.find((space) => space.id === detailedTask.spaceId);
        if (!targetSpace) {
          const response = await apiFetch('/api/spaces', { cache: 'no-store' });
          if (!response.ok) throw new Error('The task workspace could not be loaded.');
          availableSpaces = await response.json() as Space[];
          targetSpace = availableSpaces.find((space) => space.id === detailedTask.spaceId);
          if (!cancelled) setSpaces(availableSpaces);
        }
        if (!targetSpace) throw new Error('This task workspace is no longer available.');

        if (!cancelled) {
          setActiveSpace(targetSpace);
          setIsMyTasks(false);
          setSelectedTask(detailedTask);
          setTaskFilters(DEFAULT_TASK_FILTERS);
        }
      } catch (error) {
        if (!cancelled) setErrorMsg(error instanceof Error ? error.message : 'The task could not be opened.');
      } finally {
        if (!cancelled) onTaskNavigationHandled();
      }
    };

    void openNotificationTask();
    return () => { cancelled = true; };
  }, [taskNavigationRequest?.requestId]);

  const fetchSpaceMembers = useCallback(async (spaceId: string) => {
    try {
      const res = await apiFetch(`/api/spaces/${spaceId}/members`);
      if (res.ok) {
        const data = await res.json();
        setSpaceMembers(data);
      }
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => {
    void fetchSpaces();
  }, [fetchSpaces]);

  useEffect(() => {
    const refreshSpaces = () => void fetchSpaces();
    window.addEventListener('virtuo:data-change', refreshSpaces);
    return () => window.removeEventListener('virtuo:data-change', refreshSpaces);
  }, [fetchSpaces]);

  useEffect(() => {
    const refreshTasks = () => {
      const viewKey = isMyTasks ? '__my_tasks__' : activeSpace?.id || '';
      if (viewKey) taskEtagsRef.current[viewKey] = '';
      if (isMyTasks) void fetchMyTasks();
      else if (activeSpace) void fetchTasks(activeSpace.id);
    };
    window.addEventListener('virtuo:data-change', refreshTasks);
    return () => window.removeEventListener('virtuo:data-change', refreshTasks);
  }, [activeSpace, isMyTasks, fetchMyTasks, fetchTasks]);

  useEffect(() => {
    tasksRevisionRef.current = '';
    setTaskFilters(DEFAULT_TASK_FILTERS);
    if (isMyTasks) {
      void fetchMyTasks();
    } else if (activeSpace) {
      void fetchTasks(activeSpace.id);
      void fetchSpaceMembers(activeSpace.id);
    } else {
      setTasks([]);
      setSelectedTask(null);
    }
  }, [activeSpace, isMyTasks, fetchTasks, fetchMyTasks, fetchSpaceMembers]);

  useEffect(() => {
    if (!isMyTasks && !activeSpace) return;
    let requestInFlight = false;
    const refresh = async () => {
      if (requestInFlight || document.visibilityState !== 'visible') return;
      requestInFlight = true;
      try {
        if (isMyTasks) await fetchMyTasks();
        else if (activeSpace) await fetchTasks(activeSpace.id);
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
  }, [activeSpace, isMyTasks, fetchTasks, fetchMyTasks]);

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
      const res = await apiFetch('/api/spaces', {
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
      setSuccessMsg('Workspace created successfully.');
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleInviteMember = async (email: string) => {
    setErrorMsg('');
    if (!activeSpace) return;
    try {
      const res = await apiFetch(`/api/spaces/${activeSpace.id}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowInviteMember(false);
      setSuccessMsg(data.message || 'Invitation sent successfully.');
      window.dispatchEvent(new Event('virtuo:data-change'));
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleCreateTask = async (taskData: any) => {
    setErrorMsg('');
    if (!activeSpace) return;
    try {
      const res = await apiFetch(`/api/spaces/${activeSpace.id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      });
      const data = await readApiJson<Task>(res);
      if (!res.ok) throw new Error(apiErrorMessage(res, data, 'The task could not be created.'));

      setTasks((current) => [data, ...current]);
      setShowCreateTask(false);
      setSuccessMsg('Task created successfully.');
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
      const res = await apiFetch(`/api/tasks/${selectedTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setTasks((current) => current.map((task) => task.id === selectedTask.id ? data : task));
      setSelectedTask(data);
      setShowEditTask(false);
      setSuccessMsg('Task updated successfully.');
      window.dispatchEvent(new Event('virtuo:data-change'));
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleRegisterUser = async (userData: any) => {
    setErrorMsg('');
    try {
      const res = await apiFetch('/api/auth/register-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowRegisterUser(false);
      setSuccessMsg('The new account was created successfully.');
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      const res = await apiFetch(`/api/tasks/${taskId}/status`, {
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
      const res = await apiFetch(`/api/tasks/${taskId}/attachments`, {
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
      setSuccessMsg('File uploaded successfully.');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setUploadingFile(false);
    }
  };

  const handleTaskClick = useCallback(async (task: Task) => {
    const detailedTask = await fetchTaskDetail(task.id);
    if (detailedTask) {
      await fetchSpaceMembers(detailedTask.spaceId);
      setSelectedTask(detailedTask);
    }
  }, [fetchTaskDetail, fetchSpaceMembers]);

  const handleRemoveMember = async (userId: string) => {
    if (!activeSpace) return;
    setErrorMsg('');
    try {
      const res = await apiFetch(`/api/spaces/${activeSpace.id}/members/${userId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await Promise.all([fetchSpaceMembers(activeSpace.id), fetchSpaces()]);
      setSuccessMsg('Member removed from the workspace.');
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleAddComment = async (taskId: string, content: string) => {
    setErrorMsg('');
    const res = await apiFetch(`/api/tasks/${taskId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'The comment could not be saved.');
    const updateTask = (task: Task) => task.id === taskId ? { ...task, comments: [...(task.comments || []), data] } : task;
    setTasks((current) => current.map(updateTask));
    setSelectedTask((current) => current && updateTask(current));
    window.dispatchEvent(new Event('virtuo:data-change'));
  };

  const handleDeleteComment = async (taskId: string, commentId: string) => {
    if (!window.confirm('Delete this comment?')) return;
    const res = await apiFetch(`/api/tasks/${taskId}/comments/${commentId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'The comment could not be deleted.');
    const updateTask = (task: Task) => task.id === taskId
      ? { ...task, comments: (task.comments || []).filter((comment) => comment.id !== commentId) }
      : task;
    setTasks((current) => current.map(updateTask));
    setSelectedTask((current) => current && updateTask(current));
    setSuccessMsg('Comment deleted.');
    window.dispatchEvent(new Event('virtuo:data-change'));
  };

  const handleDeleteAttachment = async (taskId: string, attachmentId: string) => {
    if (!window.confirm('Delete this file?')) return;
    const res = await apiFetch(`/api/tasks/${taskId}/attachments/${attachmentId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'The file could not be deleted.');
    const updateTask = (task: Task) => task.id === taskId
      ? { ...task, attachments: (task.attachments || []).filter((attachment) => attachment.id !== attachmentId) }
      : task;
    setTasks((current) => current.map(updateTask));
    setSelectedTask((current) => current && updateTask(current));
    setSuccessMsg('File deleted.');
    window.dispatchEvent(new Event('virtuo:data-change'));
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('Delete this task?')) return;
    const res = await apiFetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'The task could not be deleted.');
    setTasks((current) => current.filter((task) => task.id !== taskId));
    await fetchSpaces();
    setSelectedTask(null);
    setSuccessMsg('Task deleted.');
    window.dispatchEvent(new Event('virtuo:data-change'));
  };

  const handleDeleteSpace = async () => {
    if (!activeSpace || !window.confirm(`Delete the workspace "${activeSpace.name}" and all of its tasks?`)) return;
    const spaceId = activeSpace.id;
    const res = await apiFetch(`/api/spaces/${spaceId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) { setErrorMsg(data.error || 'The workspace could not be deleted.'); return; }
    setSpaces((current) => current.filter((space) => space.id !== spaceId));
    setActiveSpace(null);
    setTasks([]);
    setSpaceMembers([]);
    setSuccessMsg('The workspace and all related data were deleted.');
  };

  return (
    <div className="dashboard-layout">
      
      <SpaceSidebar 
        spaces={spaces}
        activeSpace={isMyTasks ? null : activeSpace}
        isAdmin={isAdmin}
        onSelectSpace={(space) => { setIsMyTasks(false); setActiveSpace(space); setSelectedTask(null); setShowEditTask(false); }}
        onShowCreateSpace={() => { setErrorMsg(''); setShowCreateSpace(true); }}
        onShowRegisterUser={() => { setErrorMsg(''); setShowRegisterUser(true); }}
      />

      <main className="main-content dashboard-main">
        {successMsg && (
          <div className="dashboard-alert dashboard-alert--success">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg('')} aria-label="Dismiss message">
              <X size={16} />
            </button>
          </div>
        )}

        {isMyTasks ? (
          <>
            <div className="content-header workspace-hero my-tasks-hero">
              <div className="space-info">
                <span className="workspace-hero__eyebrow"><ListChecks size={14} /> Combined view</span>
                <h1>My Tasks</h1>
                <div className="workspace-hero__meta"><span>Tasks assigned to you across all workspaces</span><span className="workspace-hero__separator" /><span>{spaces.length} accessible {spaces.length === 1 ? 'workspace' : 'workspaces'}</span></div>
              </div>
            </div>

            <StatsPanel tasks={tasks} membersCount={myTaskMembers.length} />
            <TaskFilters tasks={tasks} members={myTaskMembers} filters={taskFilters} resultCount={filteredTasks.length} onChange={setTaskFilters} />
            <TaskBoard tasks={filteredTasks} statusFilter={taskFilters.status} onTaskClick={handleTaskClick} />
          </>
        ) : activeSpace ? (
          <>
            <div className="content-header workspace-hero">
              <div className="space-info">
                <span className="workspace-hero__eyebrow"><ShieldCheck size={14} /> Private workspace</span>
                <h1>{activeSpace.name}</h1>
                <div className="workspace-hero__meta">
                  <span><Users size={14} /> {spaceMembers.length} {spaceMembers.length === 1 ? 'member' : 'members'}</span>
                  <span className="workspace-hero__separator" />
                  <span>Created by <strong>{activeSpace.createdBy?.firstName} {activeSpace.createdBy?.lastName}</strong></span>
                </div>
              </div>

              <div className="workspace-hero__actions">
                {canManageActiveSpace && (
                  <button onClick={() => { setErrorMsg(''); setShowInviteMember(true); }} className="btn btn-secondary">
                    <UserPlus size={18} />
                    <span>Manage members</span>
                  </button>
                )}
                {isSpaceOwner && (
                  <button onClick={handleDeleteSpace} className="btn btn-secondary btn-danger-soft">
                    <Trash2 size={18} />
                    <span>Delete workspace</span>
                  </button>
                )}
                {canCreateTask && (
                  <button onClick={() => { setErrorMsg(''); setShowCreateTask(true); }} className="btn btn-primary">
                    <Plus size={18} />
                    <span>Add task</span>
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
            <h3 style={{ marginBottom: '8px' }}>Welcome to Virtuo</h3>
            <p style={{ color: 'hsl(var(--text-secondary))' }}>
              Create a new workspace or select one from the list to get started.
            </p>
            <button onClick={() => { setErrorMsg(''); setShowCreateSpace(true); }} className="btn btn-primary" style={{ marginTop: '16px' }}>
              <Plus size={18} />
              <span>Create your first workspace</span>
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

      {selectedTask && !showEditTask && (
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
