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
          <h3>Register New User</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {errorMsg && <div style={{ color: 'hsl(var(--accent-danger))', marginBottom: '15px' }}>{errorMsg}</div>}
            <div className="form-group">
              <label>First name</label>
              <input 
                type="text" 
                className="input-field" 
                value={regFirstName} 
                onChange={e => setRegFirstName(e.target.value)} 
                placeholder="John"
                maxLength={60}
                required 
              />
            </div>
            <div className="form-group">
              <label>Last name</label>
              <input 
                type="text" 
                className="input-field" 
                value={regLastName} 
                onChange={e => setRegLastName(e.target.value)} 
                placeholder="Smith"
                maxLength={60}
                required 
              />
            </div>
            <div className="form-group">
              <label>Email address</label>
              <input 
                type="email" 
                className="input-field" 
                value={regEmail} 
                onChange={e => setRegEmail(e.target.value)} 
                placeholder="person@company.com"
                maxLength={254}
                required 
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input 
                type="password" 
                className="input-field" 
                value={regPassword} 
                onChange={e => setRegPassword(e.target.value)} 
                placeholder="Secure password..."
                minLength={12}
                maxLength={128}
                required 
              />
            </div>
            <div className="form-group">
              <label>User role</label>
              <select 
                className="input-field"
                value={regRole}
                onChange={e => setRegRole(e.target.value)}
                required
              >
                <option value="USER">Employee (User)</option>
                <option value="ADMIN">Manager (Admin)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Initial recovery code</label>
              <input
                type="password"
                className="input-field"
                value={regRecoveryCode}
                onChange={e => setRegRecoveryCode(e.target.value)}
                placeholder="10–64 characters"
                minLength={10}
                maxLength={64}
                required
              />
              <small className="field-help">Share it with the user privately; they can change it in Settings.</small>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Register</button>
          </div>
        </form>
      </div>
    </div>
  );
}
