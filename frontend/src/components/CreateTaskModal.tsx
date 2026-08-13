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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSubmit({
        title: taskTitle,
        description: taskDesc,
        deadline: taskDeadline,
        assignedToIds: taskAssigneeIds,
        priority: taskPriority,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Create a new task</h3>
          <button type="button" className="modal-close-btn" onClick={onClose} disabled={isSubmitting}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {errorMsg && <div style={{ color: 'hsl(var(--accent-danger))', marginBottom: '15px' }}>{errorMsg}</div>}
            
            <div className="form-group">
              <label>Task title</label>
              <input 
                type="text" 
                className="input-field" 
                value={taskTitle} 
                onChange={e => setTaskTitle(e.target.value)} 
                placeholder="e.g. Prepare the monthly report"
                required 
              />
            </div>
            
            <div className="form-group">
              <label>Description</label>
              <textarea 
                className="input-field" 
                style={{ minHeight: '80px', resize: 'vertical' }}
                value={taskDesc} 
                onChange={e => setTaskDesc(e.target.value)} 
                placeholder="What needs to be done..."
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label>Deadline</label>
                <input 
                  type="datetime-local" 
                  className="input-field" 
                  value={taskDeadline} 
                  onChange={e => setTaskDeadline(e.target.value)} 
                  required 
                />
              </div>

              <div className="form-group">
                <label>Priority</label>
                <select 
                  className="input-field"
                  value={taskPriority}
                  onChange={e => setTaskPriority(e.target.value)}
                >
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
            </div>
            
            <AssigneeSelector members={spaceMembers} selectedIds={taskAssigneeIds} onChange={setTaskAssigneeIds} />

          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={taskAssigneeIds.length === 0 || isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
