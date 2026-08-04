import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { Comment } from '../types';

interface CommentsSectionProps {
  comments: Comment[];
  onAddComment: (content: string) => Promise<void>;
}

export default function CommentsSection({ comments, onAddComment }: CommentsSectionProps) {
  const [newComment, setNewComment] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    await onAddComment(newComment);
    setNewComment('');
  };

  return (
    <div className="comments-section" style={{ marginTop: '20px', borderTop: '1px solid hsl(var(--border))', paddingTop: '20px' }}>
      <h4 style={{ marginBottom: '15px' }}>Komentet</h4>
      
      <div className="comments-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px', maxHeight: '300px', overflowY: 'auto' }}>
        {comments.map(c => (
          <div key={c.id} className="comment-item" style={{ backgroundColor: 'hsl(var(--bg-secondary))', padding: '10px 14px', borderRadius: 'var(--border-radius-md)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{c.author.firstName} {c.author.lastName}</span>
              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>
                {new Date(c.createdAt).toLocaleString('sq-AL', { dateStyle: 'short', timeStyle: 'short' })}
              </span>
            </div>
            <p style={{ fontSize: '0.9rem', margin: 0, whiteSpace: 'pre-wrap' }}>{c.content}</p>
          </div>
        ))}
        {comments.length === 0 && (
          <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))' }}>Nuk ka komente. Bëhu i pari që komenton!</p>
        )}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '10px' }}>
        <input 
          type="text" 
          className="input-field" 
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          placeholder="Shkruaj një koment..."
          style={{ flex: 1 }}
        />
        <button type="submit" className="btn btn-primary" disabled={!newComment.trim()}>
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
