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
  onDeleteComment: (taskId: string, commentId: string) => Promise<void>;
  onDeleteAttachment: (taskId: string, attachmentId: string) => Promise<void>;
  currentUserId: string;
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
  onDeleteComment,
  onDeleteAttachment,
  currentUserId,
  canDelete,
  onDelete
}: TaskDetailModalProps) {
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState('');
  const assignedUsers = task.assignees?.length ? task.assignees.map((assignment) => assignment.user) : task.assignedTo ? [task.assignedTo] : [];
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await onFileUpload(task.id, e.target.files[0]);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (deletingAttachmentId) return;
    setDeletingAttachmentId(attachmentId);
    setAttachmentError('');
    try {
      await onDeleteAttachment(task.id, attachmentId);
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : 'Skedari nuk u fshi. Provo përsëri.');
    } finally {
      setDeletingAttachmentId(null);
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
              <span className="task-detail-label">Statusi i detyrës</span>
              <div style={{ marginTop: '6px' }}>
                <select
                  className="input-field"
                  value={task.status}
                  onChange={e => onStatusChange(task.id, e.target.value)}
                  style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                >
                  <option value="TODO">Për t'u bërë</option>
                  <option value="IN_PROGRESS">Në proces</option>
                  <option value="COMPLETED">E përfunduar</option>
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <span className="task-detail-label">Anëtarët e caktuar</span>
                {canEdit && <button type="button" onClick={onEditClick} className="btn btn-secondary btn-sm" style={{ padding: '4px 8px' }}><Edit size={14} /> Shto/hiq</button>}
              </div>
              <p style={{ marginTop: '6px', fontSize: '0.95rem' }}>
                {assignedUsers.length ? assignedUsers.map((user) => `${user.firstName} ${user.lastName}`).join(', ') : 'I pacaktuar'}
              </p>
            </div>
            <div>
              <span className="task-detail-label">Prioriteti</span>
              <p style={{ marginTop: '6px', fontSize: '0.95rem' }}>
                {task.priority || 'NORMAL'}
              </p>
            </div>
          </div>

          {task.description?.trim() && <div className="task-detail-section" style={{ marginBottom: '20px' }}><span className="task-detail-label">Përshkrimi</span><p style={{ marginTop: '6px', fontSize: '0.95rem', color: 'hsl(var(--text-secondary))', whiteSpace: 'pre-line' }}>{task.description}</p></div>}

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
                    <div className="attachment-actions">
                      <a
                        href={`/api/tasks/${task.id}/attachments/${att.id}`}
                        download
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 8px' }}
                        aria-label={`Shkarko ${att.fileName}`}
                        title="Shkarko"
                      >
                        <Download size={14} />
                      </a>
                      {(att.uploadedById === currentUserId || canEdit) && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm attachment-delete-btn"
                          style={{ padding: '4px 8px' }}
                          onClick={() => handleDeleteAttachment(att.id)}
                          disabled={deletingAttachmentId === att.id}
                          aria-label={`Fshij ${att.fileName}`}
                          title="Fshij skedarin"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>Nuk ka skedarë të bashkëngjitur.</span>
              )}
              {attachmentError && <span className="attachment-error" role="alert">{attachmentError}</span>}
            </div>
          </div>

          <CommentsSection
            comments={task.comments || []}
            onAddComment={(content) => onAddComment(task.id, content)}
            canDeleteComment={(comment) => comment.author.id === currentUserId || canEdit}
            onDeleteComment={(commentId) => onDeleteComment(task.id, commentId)}
          />

        </div>
        <div className="modal-footer">
          {canDelete && <button type="button" className="btn btn-secondary" style={{ color: 'hsl(var(--accent-danger))' }} onClick={() => onDelete(task.id)}><Trash2 size={16} /> Fshij Detyrën</button>}
          <button type="button" className="btn btn-secondary" onClick={onClose}>Mbyll</button>
        </div>
      </div>
    </div>
  );
}
