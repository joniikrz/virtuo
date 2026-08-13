import React, { useState, useEffect, useCallback, useRef } from 'react';
import Login from './components/Login';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import AdminPanel from './components/AdminPanel';
import { apiFetch, readApiJson } from './lib/api';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  emailNotifications?: boolean;
  inAppNotifications?: boolean;
  hasRecoveryCode?: boolean;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  taskId: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  spaceInviteId?: string | null;
  createdAt: string;
}

export interface TaskNavigationRequest {
  taskId: string;
  notificationId: string;
  requestId: number;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const notificationsEtagRef = useRef('');
  const taskNavigationSequenceRef = useRef(0);
  const [taskNavigationRequest, setTaskNavigationRequest] = useState<TaskNavigationRequest | null>(null);
  const [myTasksRequestId, setMyTasksRequestId] = useState(0);
  const [isMyTasksView, setIsMyTasksView] = useState(true);

  // 1. Restore an existing session (auto-login).
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me', { credentials: 'include' });
        if (response.ok) {
          const data = await readApiJson<{ user?: User }>(response);
          setUser(data.user || null);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Session verification failed:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setNotifications([]);
      notificationsEtagRef.current = '';
      setTaskNavigationRequest(null);
    };
    window.addEventListener('virtuo:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('virtuo:unauthorized', handleUnauthorized);
  }, []);

  // 2. Fetch notifications for the signed-in user.
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await apiFetch('/api/notifications', {
        credentials: 'include',
        headers: notificationsEtagRef.current ? { 'If-None-Match': notificationsEtagRef.current } : undefined,
      });
      if (res.status === 304) return;
      if (res.ok) {
        const data = await readApiJson<{ notifications?: NotificationItem[] }>(res);
        notificationsEtagRef.current = res.headers.get('ETag') || '';
        setNotifications(data.notifications || []);
      }
    } catch (err) {
      console.error('Unable to fetch notifications:', err);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      notificationsEtagRef.current = '';
      return;
    }

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void fetchNotifications();
    };
    void fetchNotifications();
    const intervalId = window.setInterval(refreshWhenVisible, 15000);
    window.addEventListener('focus', refreshWhenVisible);
    window.addEventListener('virtuo:data-change', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshWhenVisible);
      window.removeEventListener('virtuo:data-change', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [user, fetchNotifications]);

  // 3. Sign out.
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { 
        method: 'POST', 
        credentials: 'include' 
      });
    } catch (error) {
      console.error('Sign out failed:', error);
    } finally {
      setUser(null);
      setNotifications([]);
      notificationsEtagRef.current = '';
    }
  };

  // 4. Mark one notification as read.
  const handleMarkAsRead = async (id: string) => {
    // Update the interface immediately (optimistic update).
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );

    try {
      await apiFetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Unable to save the notification status:', error);
    }
  };

  // 5. Mark all notifications as read.
  const handleMarkAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));

    try {
      await apiFetch('/api/notifications/read-all', {
        method: 'PATCH',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Unable to save notification statuses:', error);
    }
  };

  const handleOpenTask = (taskId: string, notificationId: string) => {
    taskNavigationSequenceRef.current += 1;
    setTaskNavigationRequest({ taskId, notificationId, requestId: taskNavigationSequenceRef.current });
  };

  useEffect(() => {
    if (!user) return;
    const currentUrl = new URL(window.location.href);
    const linkedTaskId = currentUrl.searchParams.get('task')?.trim() || '';
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(linkedTaskId)) return;

    taskNavigationSequenceRef.current += 1;
    setTaskNavigationRequest({
      taskId: linkedTaskId,
      notificationId: '',
      requestId: taskNavigationSequenceRef.current,
    });

    // Consume the deep link so a refresh does not reopen the task unexpectedly.
    currentUrl.searchParams.delete('task');
    window.history.replaceState({}, '', `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
  }, [user]);

  const handleSpaceInviteResponse = async (inviteId: string, action: 'accept' | 'reject', notificationId: string): Promise<string> => {
    const response = await apiFetch(`/api/spaces/invitations/${inviteId}/${action}`, {
      method: 'POST',
      credentials: 'include',
    });
    const data = await readApiJson<{ message?: string }>(response);
    if (!response.ok) throw new Error(data.message || (data as { error?: string }).error || 'The invitation could not be processed.');
    setNotifications((current) => current.filter((notification) => notification.id !== notificationId));
    notificationsEtagRef.current = '';
    window.dispatchEvent(new Event('virtuo:data-change'));
    return data.message || (action === 'accept' ? 'Invitation accepted.' : 'Invitation declined.');
  };

  const handleUnavailableNotification = useCallback(async (notificationId: string) => {
    if (!notificationId) return;
    setNotifications((current) => current.filter((notification) => notification.id !== notificationId));
    notificationsEtagRef.current = '';
    try {
      await apiFetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
    } catch (error) {
      console.error('The outdated notification could not be removed:', error);
    }
  }, []);

  // Loading screen.
  if (loading) {
    return (
      <div className="app-loading" role="status" aria-live="polite" aria-label="Loading Virtuo">
        <div className="app-loading__content">
          <img className="app-loading__logo" src="/assets/virtuo-logo.png" alt="Virtuo" />
          <span className="app-loading__spinner" aria-hidden="true" />
          <p>Preparing your workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {user ? (
        <>
          <Navbar
            user={user}
            onUserUpdate={setUser}
            onLogout={handleLogout}
            notifications={notifications}
            onMarkAsRead={handleMarkAsRead}
            onMarkAllAsRead={handleMarkAllAsRead}
            onOpenTask={handleOpenTask}
            onRespondToSpaceInvite={handleSpaceInviteResponse}
            isMyTasks={isMyTasksView}
            onShowMyTasks={() => setMyTasksRequestId((current) => current + 1)}
          />
          {user.role === 'ADMIN' ? (
            <AdminPanel currentUser={user} />
          ) : (
            <Dashboard
              currentUser={user}
              taskNavigationRequest={taskNavigationRequest}
              onTaskNavigationHandled={() => setTaskNavigationRequest(null)}
              onTaskNavigationUnavailable={handleUnavailableNotification}
              myTasksRequestId={myTasksRequestId}
              onMyTasksViewChange={setIsMyTasksView}
            />
          )}
        </>
      ) : (
        <Login onLoginSuccess={(u) => setUser(u)} />
      )}
    </div>
  );
}
