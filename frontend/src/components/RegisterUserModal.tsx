import React, { useState } from 'react';

interface RegisterUserModalProps {
  onClose: () => void;
  onSubmit: (userData: any) => Promise<void>;
  errorMsg: string;
}

export default function RegisterUserModal({ onClose, onSubmit, errorMsg }: RegisterUserModalProps) {
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regRole, setRegRole] = useState('USER');
  const [regRecoveryCode, setRegRecoveryCode] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      email: regEmail,
      password: regPassword,
      firstName: regFirstName,
      lastName: regLastName,
      roleName: regRole,
      recoveryCode: regRecoveryCode,
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Regjistro Përdorues të Ri</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {errorMsg && <div style={{ color: 'hsl(var(--accent-danger))', marginBottom: '15px' }}>{errorMsg}</div>}
            <div className="form-group">
              <label>Emri</label>
              <input 
                type="text" 
                className="input-field" 
                value={regFirstName} 
                onChange={e => setRegFirstName(e.target.value)} 
                placeholder="Filan" 
                required 
              />
            </div>
            <div className="form-group">
              <label>Mbiemri</label>
              <input 
                type="text" 
                className="input-field" 
                value={regLastName} 
                onChange={e => setRegLastName(e.target.value)} 
                placeholder="Fisteku" 
                required 
              />
            </div>
            <div className="form-group">
              <label>Email Adresa</label>
              <input 
                type="email" 
                className="input-field" 
                value={regEmail} 
                onChange={e => setRegEmail(e.target.value)} 
                placeholder="filan@kompania.com" 
                required 
              />
            </div>
            <div className="form-group">
              <label>Fjalëkalimi</label>
              <input 
                type="password" 
                className="input-field" 
                value={regPassword} 
                onChange={e => setRegPassword(e.target.value)} 
                placeholder="Fjalëkalim i sigurt..." 
                required 
              />
            </div>
            <div className="form-group">
              <label>Roli i Përdoruesit</label>
              <select 
                className="input-field"
                value={regRole}
                onChange={e => setRegRole(e.target.value)}
                required
              >
                <option value="USER">Punonjës (User)</option>
                <option value="ADMIN">Menaxher / Shef (Admin)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Kodi fillestar i rikuperimit</label>
              <input
                type="password"
                className="input-field"
                value={regRecoveryCode}
                onChange={e => setRegRecoveryCode(e.target.value)}
                placeholder="Së paku 6 karaktere"
                minLength={6}
                maxLength={64}
                required
              />
              <small className="field-help">Jepja përdoruesit privatisht; ai mund ta ndryshojë te Cilësimet.</small>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Anulo</button>
            <button type="submit" className="btn btn-primary">Regjistro</button>
          </div>
        </form>
      </div>
    </div>
  );
}
