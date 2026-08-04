import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Verifikimi i sesionit ekzistues (Auto-Login nëse ekziston cookie-i)
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me', { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        }
      } catch (error) {
        console.error('Session check failed:', error);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        fontFamily: "'Outfit', sans-serif",
        background: '#0079bf',
        color: '#fff',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="trello-logo-mark" style={{ margin: '0 auto 16px' }}>V</div>
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
          <Navbar user={user} onLogout={handleLogout} />
          <Dashboard currentUser={user} />
        </>
      ) : (
        <Login onLoginSuccess={(u) => setUser(u)} />
      )}
    </div>
  );
}
