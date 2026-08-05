import React, { useState } from 'react';
import { Calendar, Paperclip, FileUp, FileText, Download, Edit, Trash2 } from 'lucide-react';
import { Task } from '../types';
import CommentsSection from './CommentsSection';

interface TaskDetailModalProps {
  task: Task;
  canEdit: boolean;
  onClose: () => void;
  onStatusChange: (taskId: string, newStatus: string) => void;
  onFileUpload: (taskId: string, file: File) => Promise<void>;
  uploadingFile: boolean;
  onEditClick: () => void;
  onAddComment: (taskId: string, content: string) => Promise<void>;
  canDelete: boolean;
  onDelete: (taskId: string) => Promise<void>;
}

export default function TaskDetailModal({ 
  task, 
  canEdit,
  onClose, 
  onStatusChange, 
  onFileUpload, 
  uploadingFile,
  onEditClick,
  onAddComment,
  canDelete,
  onDelete
}: TaskDetailModalProps) {
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await onFileUpload(task.id, e.target.files[0]);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h3 style={{ textDecoration: task.status === 'COMPLETED' ? 'line-through' : 'none' }}>
            {task.title}
          </h3>
          <button type="button" className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div>
              <span className="task-detail-label">Statusi i Detyrës</span>
              <div style={{ marginTop: '6px' }}>
                <select
                  className="input-field"
                  value={task.status}
                  onChange={e => onStatusChange(task.id, e.target.value)}
                  style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                >
                  <option value="TODO">Për t'u bërë (TODO)</option>
                  <option value="IN_PROGRESS">Në proces (IN PROGRESS)</option>
                  <option value="COMPLETED">E përfunduar (COMPLETED)</option>
                </select>
              </div>
            </div>

            <div>
              <span className="task-detail-label">Afati i fundit</span>
              <div className="task-detail-val" style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={16} />
                <span>
                  {new Date(task.deadline).toLocaleString('sq-AL', {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  })}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div>
              <span className="task-detail-label">I Caktuar</span>
              <p style={{ marginTop: '6px', fontSize: '0.95rem' }}>
                {task.assignedTo ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}` : 'I pacaktuar'}
              </p>
            </div>
            <div>
              <span className="task-detail-label">Prioriteti</span>
              <p style={{ marginTop: '6px', fontSize: '0.95rem' }}>
                {task.priority || 'NORMAL'}
              </p>
            </div>
          </div>

          <div className="task-detail-section" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="task-detail-label">Përshkrimi</span>
              {canEdit && (
                <button 
                  onClick={onEditClick}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '4px 8px' }}
                >
                  <Edit size={14} /> Ndrysho
                </button>
              )}
            </div>
            <p style={{ marginTop: '6px', fontSize: '0.95rem', color: 'hsl(var(--text-secondary))', whiteSpace: 'pre-line' }}>
              {task.description || 'Nuk ka përshkrim për këtë detyrë.'}
            </p>
          </div>

          {/* Shtojcat (Attachments) */}
          <div className="task-detail-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span className="task-detail-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Paperclip size={16} />
                <span>Skedarët e bashkëngjitur ({task.attachments?.length || 0})</span>
              </span>
              
              <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', padding: '4px 10px' }}>
                <FileUp size={14} />
                <span>{uploadingFile ? 'Po ngarkohet...' : 'Ngarko Skedar'}</span>
                <input type="file" onChange={handleFileChange} disabled={uploadingFile} style={{ display: 'none' }} />
              </label>
            </div>

            <div className="attachments-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {task.attachments && task.attachments.length > 0 ? (
                task.attachments.map(att => (
                  <div 
                    key={att.id} 
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      backgroundColor: 'hsl(var(--bg-secondary))',
                      borderRadius: 'var(--border-radius-sm)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      <FileText size={16} />
                      <span style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {att.fileName}
                      </span>
                    </div>
                    <a 
                      href={`/api/tasks/${task.id}/attachments/${att.id}`} 
                      download 
                      className="btn btn-secondary btn-sm" 
                      style={{ padding: '4px 8px' }}
                    >
                      <Download size={14} />
                    </a>
                  </div>
                ))
              ) : (
                <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>Nuk ka skedarë të bashkëngjitur.</span>
              )}
            </div>
          </div>

          <CommentsSection comments={task.comments || []} onAddComment={(content) => onAddComment(task.id, content)} />

        </div>
        <div className="modal-footer">
          {canDelete && <button type="button" className="btn btn-secondary" style={{ color: 'hsl(var(--accent-danger))' }} onClick={() => onDelete(task.id)}><Trash2 size={16} /> Fshij Detyrën</button>}
          <button type="button" className="btn btn-secondary" onClick={onClose}>Mbyll</button>
        </div>
      </div>
    </div>
  );
}
