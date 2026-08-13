import React, { useState } from 'react';

interface CreateSpaceModalProps {
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
  errorMsg: string;
}

export default function CreateSpaceModal({ onClose, onSubmit, errorMsg }: CreateSpaceModalProps) {
  const [spaceName, setSpaceName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void onSubmit(spaceName);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '560px' }}>
        <div className="modal-header">
          <h3>Create a New Workspace</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {errorMsg && <div style={{ color: 'hsl(var(--accent-danger))', marginBottom: '15px' }}>{errorMsg}</div>}
            <div className="form-group">
              <label>Workspace name</label>
              <input type="text" className="input-field" value={spaceName} onChange={(e) => setSpaceName(e.target.value)} placeholder="p.sh. Marketing" required />
            </div>
            <div className="space-private-note">
              <strong>Private workspace</strong>
              <p>It is initially created for you only. Afterward, you can invite members using their email address.</p>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Create workspace</button>
          </div>
        </form>
      </div>
    </div>
  );
}
