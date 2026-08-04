import React, { useMemo, useState } from 'react';
import { User } from '../types';

interface CreateSpaceModalProps {
  users: User[];
  onClose: () => void;
  onSubmit: (name: string, desc: string, memberIds: string[]) => Promise<void>;
  errorMsg: string;
}

export default function CreateSpaceModal({ users, onClose, onSubmit, errorMsg }: CreateSpaceModalProps) {
  const [spaceName, setSpaceName] = useState('');
  const [spaceDesc, setSpaceDesc] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const allSelected = useMemo(() => users.length > 0 && memberIds.length === users.length, [memberIds, users]);

  const toggleMember = (id: string) => setMemberIds((current) => current.includes(id) ? current.filter((memberId) => memberId !== id) : [...current, id]);
  const toggleAll = () => setMemberIds(allSelected ? [] : users.map((user) => user.id));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(spaceName, spaceDesc, memberIds);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '560px' }}>
        <div className="modal-header">
          <h3>Krijo Hapësirë të Re</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {errorMsg && <div style={{ color: 'hsl(var(--accent-danger))', marginBottom: '15px' }}>{errorMsg}</div>}
            <div className="form-group">
              <label>Emri i Hapësirës</label>
              <input type="text" className="input-field" value={spaceName} onChange={(e) => setSpaceName(e.target.value)} placeholder="p.sh. Marketing" required />
            </div>
            <div className="form-group">
              <label>Përshkrimi (opsional)</label>
              <textarea className="input-field" style={{ minHeight: '72px', resize: 'vertical' }} value={spaceDesc} onChange={(e) => setSpaceDesc(e.target.value)} placeholder="Çfarë punohet në këtë hapësirë?" />
            </div>
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px' }}>
                <div>
                  <label style={{ marginBottom: '4px' }}>Pjesëmarrësit</label>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>
                    Zgjidh kë e sheh hapësirën. Pa pjesëmarrës të zgjedhur, hapësira është vetëm për ty (My Tasks).
                  </p>
                </div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={toggleAll}>{allSelected ? 'Hiq të gjithë' : 'Zgjidh të gjithë'}</button>
              </div>
              <div style={{ marginTop: '12px', maxHeight: '185px', overflowY: 'auto', border: '1px solid hsl(var(--border))', borderRadius: 'var(--border-radius-md)', padding: '6px 12px' }}>
                {users.length ? users.map((user) => (
                  <label key={user.id} style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid hsl(var(--border) / 0.55)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={memberIds.includes(user.id)} onChange={() => toggleMember(user.id)} />
                    <span>{user.firstName} {user.lastName}</span>
                    <span style={{ color: 'hsl(var(--text-muted))', fontSize: '0.8rem' }}>{user.email}</span>
                  </label>
                )) : <p style={{ margin: '8px 0', color: 'hsl(var(--text-muted))', fontSize: '0.85rem' }}>Nuk ka përdorues të tjerë të regjistruar.</p>}
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Anulo</button>
            <button type="submit" className="btn btn-primary">Krijo Hapësirën</button>
          </div>
        </form>
      </div>
    </div>
  );
}
