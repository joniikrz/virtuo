import React, { useState, useEffect, useCallback, useRef } from 'react';
import Login from './components/Login';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import { readApiJson } from './lib/api';

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

  // 1. Verifikimi i sesionit ekzistues (Auto-Login)
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
        console.error('Verifikimi i sesionit dështoi:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // 2. Marrja e njoftimeve kur përdoruesi është i kyçur
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/notifications', {
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
      console.error('Gabim gjatë leximit të njoftimeve:', err);
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

  // 3. Dalja nga sistemi (Logout)
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { 
        method: 'POST', 
        credentials: 'include' 
      });
    } catch (error) {
      console.error('Gabim gjatë daljes nga sistemi:', error);
    } finally {
      setUser(null);
      setNotifications([]);
      notificationsEtagRef.current = '';
    }
  };

  // 4. Shënimi i një njoftimi si të lexuar
  const handleMarkAsRead = async (id: string) => {
    // Përditëso UI-në menjëherë (Optimistic UI Update)
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );

    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Dështoi ruajtja e statusit të njoftimit:', error);
    }
  };

  // 5. Shënimi i të gjitha njoftimeve si të lexuara
  const handleMarkAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));

    try {
      await fetch('/api/notifications/read-all', {
        method: 'PATCH',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Dështoi ruajtja e statusit të njoftimeve:', error);
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

    // Konsumo deep-link-un që refresh-i të mos e hapë detyrën përsëri pa kërkesë.
    currentUrl.searchParams.delete('task');
    window.history.replaceState({}, '', `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
  }, [user]);

  const handleSpaceInviteResponse = async (inviteId: string, action: 'accept' | 'reject', notificationId: string): Promise<string> => {
    const response = await fetch(`/api/spaces/invitations/${inviteId}/${action}`, {
      method: 'POST',
      credentials: 'include',
    });
    const data = await readApiJson<{ message?: string }>(response);
    if (!response.ok) throw new Error(data.message || (data as { error?: string }).error || 'Ftesa nuk mund të përpunohej.');
    setNotifications((current) => current.filter((notification) => notification.id !== notificationId));
    notificationsEtagRef.current = '';
    window.dispatchEvent(new Event('virtuo:data-change'));
    return data.message || (action === 'accept' ? 'Ftesa u pranua.' : 'Ftesa u refuzua.');
  };

  const handleUnavailableNotification = useCallback(async (notificationId: string) => {
    if (!notificationId) return;
    setNotifications((current) => current.filter((notification) => notification.id !== notificationId));
    notificationsEtagRef.current = '';
    try {
      await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Njoftimi i vjetër nuk mund të pastrohej:', error);
    }
  }, []);

  // Ekrani gjatë ngarkimit (Loading Screen)
  if (loading) {
    return (
      <div className="app-loading" role="status" aria-live="polite" aria-label="Duke u ngarkuar Virtuo">
        <div className="app-loading__content">
          <img className="app-loading__logo" src="/assets/virtuo-logo.png" alt="Virtuo" />
          <span className="app-loading__spinner" aria-hidden="true" />
          <p>Duke përgatitur hapësirën tënde...</p>
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
          />
          <Dashboard
            currentUser={user}
            taskNavigationRequest={taskNavigationRequest}
            onTaskNavigationHandled={() => setTaskNavigationRequest(null)}
            onTaskNavigationUnavailable={handleUnavailableNotification}
          />
        </>
      ) : (
        <Login onLoginSuccess={(u) => setUser(u)} />
      )}
    </div>
  );
}
