import React, { useState } from 'react';

interface CreateSpaceModalProps {
  onClose: () => void;
  onSubmit: (name: string, desc: string, isPrivate: boolean) => Promise<void>;
  errorMsg: string;
}

export default function CreateSpaceModal({ onClose, onSubmit, errorMsg }: CreateSpaceModalProps) {
  const [spaceName, setSpaceName] = useState('');
  const [spaceDesc, setSpaceDesc] = useState('');
  const [spacePrivate, setSpacePrivate] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(spaceName, spaceDesc, spacePrivate);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Krijo Hapësirë të Re</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {errorMsg && <div style={{ color: 'hsl(var(--accent-danger))', marginBottom: '15px' }}>{errorMsg}</div>}
            <div className="form-group">
              <label>Emri i Hapësirës</label>
              <input 
                type="text" 
                className="input-field" 
                value={spaceName} 
                onChange={e => setSpaceName(e.target.value)} 
                placeholder="p.sh. Departamenti i Financës" 
                required 
              />
            </div>
            <div className="form-group">
              <label>Përshkrimi (Opsional)</label>
              <textarea 
                className="input-field" 
                style={{ minHeight: '80px', resize: 'vertical' }}
                value={spaceDesc} 
                onChange={e => setSpaceDesc(e.target.value)} 
                placeholder="Shkruani një përshkrim të shkurtër"
              />
            </div>
            <div className="form-group" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px' }}>Hapësirë Ekzekutive Private</label>
                <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>
                  Vetëm për Shefat/Menaxhmentin. Punonjësit nuk do ta shohin.
                </span>
              </div>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={spacePrivate} 
                  onChange={e => setSpacePrivate(e.target.checked)} 
                />
                <span className="slider"></span>
              </label>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Anulo</button>
            <button type="submit" className="btn btn-primary">Krijo</button>
          </div>
        </form>
      </div>
    </div>
  );
}
