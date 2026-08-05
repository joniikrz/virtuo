import React, { useState } from 'react';
import { User, Space } from '../types';
import AssigneeSelector from './AssigneeSelector';

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
  const [taskAssigneeIds, setTaskAssigneeIds] = useState<string[]>([]);
  const [taskPriority, setTaskPriority] = useState('NORMAL');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title: taskTitle,
      description: taskDesc,
      deadline: taskDeadline,
      assignedToIds: taskAssigneeIds,
      priority: taskPriority,
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Krijo detyrë të re</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {errorMsg && <div style={{ color: 'hsl(var(--accent-danger))', marginBottom: '15px' }}>{errorMsg}</div>}
            
            <div className="form-group">
              <label>Titulli i detyrës</label>
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
                <label>Afati i fundit</label>
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
                  <option value="LOW">I ulët</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">I lartë</option>
                  <option value="URGENT">Urgjent</option>
                </select>
              </div>
            </div>
            
            <AssigneeSelector members={spaceMembers} selectedIds={taskAssigneeIds} onChange={setTaskAssigneeIds} />

          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Anulo</button>
            <button type="submit" className="btn btn-primary" disabled={taskAssigneeIds.length === 0}>Krijo detyrën</button>
          </div>
        </form>
      </div>
    </div>
  );
}
