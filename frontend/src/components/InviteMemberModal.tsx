import React, { useState } from 'react';
import { User, Space } from '../types';

interface InviteMemberModalProps {
  activeSpace: Space;
  users: User[];
  spaceMembers: User[];
  onClose: () => void;
  onSubmit: (userId: string) => Promise<void>;
  errorMsg: string;
}

export default function InviteMemberModal({ activeSpace, users, spaceMembers, onClose, onSubmit, errorMsg }: InviteMemberModalProps) {
  const [selectedInviteUser, setSelectedInviteUser] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(selectedInviteUser);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Fto Anëtar te: {activeSpace.name}</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {errorMsg && <div style={{ color: 'hsl(var(--accent-danger))', marginBottom: '15px' }}>{errorMsg}</div>}
            <div className="form-group">
              <label>Zgjidh Përdoruesin</label>
              <select 
                className="input-field"
                value={selectedInviteUser}
                onChange={e => setSelectedInviteUser(e.target.value)}
                required
              >
                <option value="">Zgjidh një anëtar...</option>
                {users
                  .filter(u => !activeSpace.isPrivate || u.role === 'ADMIN')
                  .filter(u => !spaceMembers.some(m => m.id === u.id))
                  .map(u => (
                    <option key={u.id} value={u.id}>
                      {u.firstName} {u.lastName} ({u.email}) - [{u.role}]
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Anulo</button>
            <button type="submit" className="btn btn-primary">Fto Anëtar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
