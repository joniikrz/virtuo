import React from 'react';
import { Check, FolderKanban, ListTodo, LockKeyhole, Plus, UserPlus, Users } from 'lucide-react';
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
    <aside className="sidebar workspace-sidebar">
      <div className="workspace-sidebar__heading">
        <div>
          <span className="sidebar-title">Hapësirat e punës</span>
          <p>{spaces.length} {spaces.length === 1 ? 'hapësirë private' : 'hapësira private'}</p>
        </div>
        <button
          onClick={onShowCreateSpace}
          className="workspace-add-button"
          title="Krijo hapësirë të re"
          aria-label="Krijo hapësirë të re"
        >
          <Plus size={18} />
        </button>
      </div>

      <div className="space-list">
        {spaces.map((space) => {
          const isActive = activeSpace?.id === space.id;
          const color = space.color || '#7048e8';
          return (
            <button
              type="button"
              key={space.id}
              className={`space-card ${isActive ? 'active' : ''}`}
              onClick={() => onSelectSpace(space)}
              aria-pressed={isActive}
              style={{ '--space-accent': color } as React.CSSProperties}
            >
              <span className="space-card__icon"><FolderKanban size={19} /></span>
              <span className="space-card__body">
                <span className="space-card__name">{space.name}</span>
                <span className="space-card__meta">
                  <span><Users size={12} /> {space._count?.members ?? 0}</span>
                  <span><ListTodo size={12} /> {space._count?.tasks ?? 0}</span>
                  <span><LockKeyhole size={11} /> Private</span>
                </span>
              </span>
              {isActive && <span className="space-card__selected"><Check size={13} /></span>}
            </button>
          );
        })}

        {spaces.length === 0 && (
          <div className="workspace-empty">
            <span><FolderKanban size={25} /></span>
            <strong>Nuk ka hapësira</strong>
            <p>Krijo hapësirën e parë dhe organizo detyrat me ekipin.</p>
            <button type="button" onClick={onShowCreateSpace} className="btn btn-primary btn-sm">
              <Plus size={15} /> Krijo hapësirë
            </button>
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="workspace-sidebar__footer">
          <button onClick={onShowRegisterUser} className="btn btn-secondary btn-sm">
            <UserPlus size={16} />
            <span>Regjistro punonjës</span>
          </button>
        </div>
      )}
    </aside>
  );
}
