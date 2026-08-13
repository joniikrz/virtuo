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
          <span className="sidebar-title">Workspaces</span>
          <p>{spaces.length} private {spaces.length === 1 ? 'workspace' : 'workspaces'}</p>
        </div>
        <button
          onClick={onShowCreateSpace}
          className="workspace-add-button"
          title="Create a new workspace"
          aria-label="Create a new workspace"
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
            <strong>No workspaces yet</strong>
            <p>Create your first workspace and organize tasks with your team.</p>
            <button type="button" onClick={onShowCreateSpace} className="btn btn-primary btn-sm">
              <Plus size={15} /> Create workspace
            </button>
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="workspace-sidebar__footer">
          <button onClick={onShowRegisterUser} className="btn btn-secondary btn-sm">
            <UserPlus size={16} />
            <span>Register employee</span>
          </button>
        </div>
      )}
    </aside>
  );
}
