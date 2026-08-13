import React, { useState } from 'react';
import { User, Task } from '../types';
import AssigneeSelector from './AssigneeSelector';

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
  const [taskAssigneeIds, setTaskAssigneeIds] = useState<string[]>(
    task.assignees?.length ? task.assignees.map((assignment) => assignment.user.id) : task.assignedTo ? [task.assignedTo.id] : []
  );
  const [taskPriority, setTaskPriority] = useState(task.priority || 'NORMAL');

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
          <h3>Edit task</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}>&times;</button>
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
            
            <div className="space-private-note"><strong>Add or remove members</strong><p>New assignees receive a notification and email when you save the changes.</p></div>
            <AssigneeSelector members={spaceMembers} selectedIds={taskAssigneeIds} onChange={setTaskAssigneeIds} />

          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={taskAssigneeIds.length === 0}>Save changes</button>
          </div>
        </form>
      </div>
    </div>
  );
}
