import React from 'react';
import { LogOut, LayoutGrid } from 'lucide-react';

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
        <div className="nav-logo-mark">V</div>
        <span className="nav-logo">Virtuo</span>
        <LayoutGrid size={16} style={{ color: 'rgba(255,255,255,0.6)', marginLeft: 4 }} />
      </div>

      <div className="nav-user">
        <div className="user-badge">
          <span>{user.firstName} {user.lastName}</span>
          <span className={`role-tag ${user.role.toLowerCase()}`}>
            {user.role === 'ADMIN' ? 'Admin' : 'Anëtar'}
          </span>
        </div>

        <button onClick={onLogout} className="btn btn-secondary btn-sm" title="Dil">
          <LogOut size={16} />
          <span>Dil</span>
        </button>
      </div>
    </nav>
  );
}
