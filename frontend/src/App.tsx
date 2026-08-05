import React, { useState, useEffect, useCallback } from 'react';
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
  createdAt: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

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
      const res = await fetch('/api/notifications', { credentials: 'include' });
      if (res.ok) {
        const data = await readApiJson<{ notifications?: NotificationItem[] }>(res);
        setNotifications(data.notifications || []);
      }
    } catch (err) {
      console.error('Gabim gjatë leximit të njoftimeve:', err);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void fetchNotifications();
    };
    void fetchNotifications();
    const intervalId = window.setInterval(refreshWhenVisible, 8000);
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

  // Ekrani gjatë ngarkimit (Loading Screen)
  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          fontFamily: "'Outfit', sans-serif",
          background: '#0079bf',
          color: '#fff',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div className="trello-logo-mark" style={{ margin: '0 auto 16px' }}>
            V
          </div>
          <h2 style={{ marginBottom: '8px' }}>Duke u ngarkuar...</h2>
          <p style={{ opacity: 0.85 }}>Virtuo Task Manager</p>
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
          />
          <Dashboard currentUser={user} />
        </>
      ) : (
        <Login onLoginSuccess={(u) => setUser(u)} />
      )}
    </div>
  );
}
