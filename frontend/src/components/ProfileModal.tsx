import React from 'react';
import { User as UserIcon, Mail, Shield } from 'lucide-react';
import { User } from '../types';

interface ProfileModalProps {
  user: User;
  onClose: () => void;
}

export default function ProfileModal({ user, onClose }: ProfileModalProps) {
  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '400px' }}>
        <div className="modal-header">
          <h3>Profili i Përdoruesit</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body" style={{ textAlign: 'center', padding: '20px' }}>
          
          <div style={{ 
            width: '80px', 
            height: '80px', 
            backgroundColor: 'hsl(var(--primary))', 
            color: 'white', 
            borderRadius: '50%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            margin: '0 auto 20px auto',
            fontSize: '2rem',
            fontWeight: 600
          }}>
            {user.firstName[0]}{user.lastName[0]}
          </div>

          <h3 style={{ marginBottom: '5px' }}>{user.firstName} {user.lastName}</h3>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'hsl(var(--text-secondary))', marginBottom: '10px' }}>
            <Mail size={16} />
            <span>{user.email}</span>
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', backgroundColor: 'hsl(var(--bg-secondary))', borderRadius: '16px', fontSize: '0.85rem', fontWeight: 600 }}>
            <Shield size={14} style={{ color: user.role === 'ADMIN' ? 'hsl(var(--accent-danger))' : 'hsl(var(--primary))' }} />
            <span>{user.role}</span>
          </div>

        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} style={{ width: '100%' }}>Mbyll</button>
        </div>
      </div>
    </div>
  );
}
