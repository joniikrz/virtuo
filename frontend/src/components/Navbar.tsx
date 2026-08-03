import React from 'react';
import { LogOut, User, Activity } from 'lucide-react';

interface NavbarProps {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  };
  onLogout: () => void;
}

export default function Navbar({ user, onLogout }: NavbarProps) {
  return (
    <nav className="navbar">
      <div className="nav-brand">
        <Activity size={24} style={{ color: 'hsl(var(--primary))' }} />
        <span className="nav-logo">Virtuo</span>
      </div>

      <div className="nav-user">
        <div className="user-badge">
          <User size={14} />
          <span>{user.firstName} {user.lastName}</span>
          <span className={`role-tag ${user.role.toLowerCase()}`}>
            {user.role}
          </span>
        </div>

        <button onClick={onLogout} className="btn btn-secondary btn-sm" title="Log Out">
          <LogOut size={16} />
          <span>Dil</span>
        </button>
      </div>
    </nav>
  );
}
