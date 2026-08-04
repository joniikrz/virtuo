import React, { useState } from 'react';
import { User, Space } from '../types';

interface CreateTaskModalProps {
  activeSpace: Space;
  spaceMembers: User[];
  onClose: () => void;
  onSubmit: (taskData: any) => Promise<void>;
  errorMsg: string;
}

export default function CreateTaskModal({ activeSpace, spaceMembers, onClose, onSubmit, errorMsg }: CreateTaskModalProps) {
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskDeadline, setTaskDeadline] = useState('');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskPriority, setTaskPriority] = useState('NORMAL');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title: taskTitle,
      description: taskDesc,
      deadline: taskDeadline,
      assignedToId: taskAssignee || null,
      priority: taskPriority,
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Shto Detyrë të Re</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {errorMsg && <div style={{ color: 'hsl(var(--accent-danger))', marginBottom: '15px' }}>{errorMsg}</div>}
            
            <div className="form-group">
              <label>Titulli i Detyrës</label>
              <input 
                type="text" 
                className="input-field" 
                value={taskTitle} 
                onChange={e => setTaskTitle(e.target.value)} 
                placeholder="p.sh. Përgatit raportin mujor" 
                required 
              />
            </div>
            
            <div className="form-group">
              <label>Përshkrimi</label>
              <textarea 
                className="input-field" 
                style={{ minHeight: '80px', resize: 'vertical' }}
                value={taskDesc} 
                onChange={e => setTaskDesc(e.target.value)} 
                placeholder="Çfarë duhet të bëhet..."
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label>Afati i Fundit (Deadline)</label>
                <input 
                  type="datetime-local" 
                  className="input-field" 
                  value={taskDeadline} 
                  onChange={e => setTaskDeadline(e.target.value)} 
                  required 
                />
              </div>

              <div className="form-group">
                <label>Prioriteti</label>
                <select 
                  className="input-field"
                  value={taskPriority}
                  onChange={e => setTaskPriority(e.target.value)}
                >
                  <option value="LOW">I ulët (LOW)</option>
                  <option value="NORMAL">Normal (NORMAL)</option>
                  <option value="HIGH">I lartë (HIGH)</option>
                  <option value="URGENT">Urgjent (URGENT)</option>
                </select>
              </div>
            </div>
            
            <div className="form-group">
              <label>Caktoja Punonjësit (Opsional)</label>
              <select 
                className="input-field"
                value={taskAssignee}
                onChange={e => setTaskAssignee(e.target.value)}
              >
                <option value="">I pacaktuar (Asnjë)</option>
                {spaceMembers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px' }}>E dukshme për të gjithë</label>
                <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>
                  A munden anëtarët e tjerë ta shohin këtë detyrë?
                </span>
              </div>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={visibleToAll} 
                  onChange={e => setVisibleToAll(e.target.checked)} 
                />
                <span className="slider"></span>
              </label>
            </div>

          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Anulo</button>
            <button type="submit" className="btn btn-primary">Krijo Detyrë</button>
          </div>
        </form>
      </div>
    </div>
  );
}
