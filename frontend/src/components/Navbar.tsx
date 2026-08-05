import React, { useState } from 'react';
import { LogOut, User as UserIcon, Bell } from 'lucide-react';
import { User, Notification } from '../types';
import NotificationsPanel from './NotificationsPanel';
import ThemeToggle from './ThemeToggle';
import ProfileModal from './ProfileModal';

interface NavbarProps {
  user: User;
  onLogout: () => void;
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
}

export default function Navbar({ user, onLogout, notifications, onMarkAsRead, onMarkAllAsRead }: NavbarProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  
  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <>
      <nav className="navbar" style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', padding: '12px 24px', backgroundColor: 'hsl(var(--bg-secondary))', borderBottom: '1px solid hsl(var(--border))' }}>
        <div className="nav-brand" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '1.25rem' }}>
          <img className="nav-logo-image" src="/assets/virtuo-logo.png" alt="Virtuo" />
        </div>

        <div className="nav-user" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          
          <ThemeToggle />

          <div style={{ position: 'relative' }}>
            <button 
              className="btn btn-secondary btn-sm" 
              style={{ padding: '6px', borderRadius: '50%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => setShowNotifications(!showNotifications)}
              aria-label={unreadCount > 0 ? `Njoftimet, ${unreadCount} të palexuara` : 'Njoftimet'}
              aria-expanded={showNotifications}
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  backgroundColor: 'hsl(var(--accent-danger))',
                  color: 'white',
                  fontSize: '0.65rem',
                  fontWeight: 'bold',
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {unreadCount}
                </span>
              )}
            </button>
          </div>

          <div 
            className="user-badge" 
            onClick={() => setShowProfile(true)} 
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', backgroundColor: 'hsl(var(--bg-primary))', borderRadius: '20px', border: '1px solid hsl(var(--border))' }}
          >
            <UserIcon size={14} />
            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{user.firstName} {user.lastName}</span>
            <span className={`role-tag ${user.role.toLowerCase()}`} style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '10px', backgroundColor: user.role === 'ADMIN' ? 'hsl(var(--accent-danger) / 0.1)' : 'hsl(var(--primary) / 0.1)', color: user.role === 'ADMIN' ? 'hsl(var(--accent-danger))' : 'hsl(var(--primary))' }}>
              {user.role}
            </span>
          </div>

          <button onClick={onLogout} className="btn btn-secondary btn-sm nav-logout" title="Dil" aria-label="Dil nga llogaria" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <LogOut size={16} />
            <span>Dil</span>
          </button>
        </div>
      </nav>

      <NotificationsPanel
        notifications={notifications}
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        onMarkAsRead={onMarkAsRead}
        onMarkAllAsRead={onMarkAllAsRead}
      />
      
      {showProfile && <ProfileModal user={user} onClose={() => setShowProfile(false)} />}
    </>
  );
}
