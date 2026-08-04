import React, { useState } from 'react';
import { User, Task } from '../types';

interface EditTaskModalProps {
  task: Task;
  spaceMembers: User[];
  onClose: () => void;
  onSubmit: (taskData: any) => Promise<void>;
  errorMsg: string;
}

export default function EditTaskModal({ task, spaceMembers, onClose, onSubmit, errorMsg }: EditTaskModalProps) {
  const [taskTitle, setTaskTitle] = useState(task.title);
  const [taskDesc, setTaskDesc] = useState(task.description);
  // Formatting datetime-local requires YYYY-MM-DDThh:mm
  const formatForInput = (isoStr: string) => {
    if (!isoStr) return '';
    return new Date(isoStr).toISOString().slice(0, 16);
  };
  const [taskDeadline, setTaskDeadline] = useState(formatForInput(task.deadline));
  const [taskAssignee, setTaskAssignee] = useState(task.assignedTo?.id || '');
  const [taskPriority, setTaskPriority] = useState(task.priority || 'NORMAL');
  const [visibleToAll, setVisibleToAll] = useState(task.visibleToAll !== undefined ? task.visibleToAll : true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title: taskTitle,
      description: taskDesc,
      deadline: taskDeadline,
      assignedToId: taskAssignee || null,
      priority: taskPriority,
      visibleToAll: visibleToAll,
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Ndrysho Detyrën</h3>
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
            <button type="submit" className="btn btn-primary">Ruaj Ndryshimet</button>
          </div>
        </form>
      </div>
    </div>
  );
}
