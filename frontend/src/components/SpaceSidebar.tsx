import React from 'react';
import { Plus, Lock, Unlock, UserPlus } from 'lucide-react';
import { Space } from '../types';

interface SpaceSidebarProps {
  spaces: Space[];
  activeSpace: Space | null;
  isAdmin: boolean;
  onSelectSpace: (space: Space) => void;
  onShowCreateSpace: () => void;
  onShowRegisterUser: () => void;
}

export default function SpaceSidebar({
  spaces,
  activeSpace,
  isAdmin,
  onSelectSpace,
  onShowCreateSpace,
  onShowRegisterUser
}: SpaceSidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">Hapësirat e Punës</span>
        <button
          onClick={onShowCreateSpace}
          className="btn btn-primary btn-sm"
          style={{ padding: '5px 9px', borderRadius: '50%' }}
          title="Krijo Hapësirë të re"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="space-list">
        {spaces.map(s => (
          <div 
            key={s.id} 
            className={`space-item ${activeSpace?.id === s.id ? 'active' : ''}`}
            onClick={() => onSelectSpace(s)}
          >
            <span className="space-item-name">
              <Lock size={14} style={{ color: 'hsl(var(--accent-warning))' }} />
              {s.name}
            </span>
            <span className="space-item-badge">Hapësirë private</span>
          </div>
        ))}
        {spaces.length === 0 && (
          <div className="empty-state">
            <Unlock size={24} />
            <span>Nuk ka asnjë hapësirë</span>
          </div>
        )}
      </div>

      {isAdmin && (
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button onClick={onShowRegisterUser} className="btn btn-secondary btn-sm">
            <UserPlus size={16} />
            <span>Regjistro Punonjës</span>
          </button>
        </div>
      )}
    </aside>
  );
}
