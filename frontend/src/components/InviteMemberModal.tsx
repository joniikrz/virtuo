import React, { useState } from 'react';
import { User, Space } from '../types';

interface InviteMemberModalProps {
  activeSpace: Space;
  spaceMembers: User[];
  onClose: () => void;
  onSubmit: (email: string) => Promise<void>;
  onRemove: (userId: string) => Promise<void>;
  errorMsg: string;
}

export default function InviteMemberModal({ activeSpace, spaceMembers, onClose, onSubmit, onRemove, errorMsg }: InviteMemberModalProps) {
  const [inviteEmail, setInviteEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void onSubmit(inviteEmail.trim().toLowerCase());
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Menaxho anëtarët: {activeSpace.name}</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {errorMsg && <div style={{ color: 'hsl(var(--accent-danger))', marginBottom: '15px' }}>{errorMsg}</div>}
            <div className="form-group">
              <label htmlFor="invite-email">Fto me email</label>
              <input
                id="invite-email"
                type="email"
                className="input-field"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="emri@kompania.com"
                maxLength={254}
                autoComplete="email"
                required
              />
              <small className="field-help">Përdoruesi duhet të jetë i regjistruar. Ai bëhet anëtar vetëm pasi ta pranojë ftesën te Njoftimet.</small>
            </div>
            <div className="form-group">
              <label>Anëtarët aktualë ({spaceMembers.length})</label>
              <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid hsl(var(--border))', borderRadius: 'var(--border-radius-md)', padding: '4px 10px' }}>
                {spaceMembers.map((member) => (
                  <div key={member.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid hsl(var(--border) / 0.5)' }}>
                    <span>{member.firstName} {member.lastName}</span>
                    {member.id !== activeSpace.createdBy?.id && <button type="button" className="btn btn-secondary btn-sm" onClick={() => onRemove(member.id)}>Hiq</button>}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Anulo</button>
            <button type="submit" className="btn btn-primary">Dërgo ftesën</button>
          </div>
        </form>
      </div>
    </div>
  );
}
