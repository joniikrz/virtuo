import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, Trash2 } from 'lucide-react';
import { Comment } from '../types';

interface CommentsSectionProps {
  comments: Comment[];
  onAddComment: (content: string) => Promise<void>;
  canDeleteComment: (comment: Comment) => boolean;
  onDeleteComment: (commentId: string) => Promise<void>;
}

export default function CommentsSection({ comments, onAddComment, canDeleteComment, onDeleteComment }: CommentsSectionProps) {
  const [newComment, setNewComment] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
  }, [comments.length, comments[comments.length - 1]?.id]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const content = newComment.trim();
    if (!content || sending) return;
    setSending(true);
    setError('');
    try {
      await onAddComment(content);
      setNewComment('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The comment could not be saved. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (deletingId) return;
    setDeletingId(commentId);
    setError('');
    try {
      await onDeleteComment(commentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The comment could not be deleted. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="comments-section" aria-labelledby="comments-heading">
      <header className="comments-header">
        <span className="comments-header__icon"><MessageCircle size={17} /></span>
        <div><h4 id="comments-heading">Conversation</h4><p>{comments.length} {comments.length === 1 ? 'comment' : 'comments'}</p></div>
        <span className="comments-live"><i /> Live</span>
      </header>

      <div ref={listRef} className="comments-list" aria-live="polite">
        {comments.map((comment) => {
          const roleName = typeof comment.author.role === 'string' ? comment.author.role : comment.author.role?.name || 'USER';
          return <article key={comment.id} className="comment-item">
            <span className="comment-avatar" aria-hidden="true">{comment.author.firstName.charAt(0)}{comment.author.lastName.charAt(0)}</span>
            <div className="comment-body">
              <div className="comment-meta">
                <strong>{comment.author.firstName} {comment.author.lastName}</strong>
                <span className="comment-role">{roleName}</span>
                <time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</time>
                {canDeleteComment(comment) && (
                  <button
                    type="button"
                    className="comment-delete-btn"
                    onClick={() => handleDelete(comment.id)}
                    disabled={deletingId === comment.id}
                    aria-label="Delete comment"
                    title="Delete comment"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <p className="comment-text">{comment.content}</p>
            </div>
          </article>;
        })}
        {comments.length === 0 && (
          <div className="comments-empty"><MessageCircle size={24} /><strong>No comments yet</strong><span>Start the conversation about this task.</span></div>
        )}
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="comment-composer">
        <textarea
          className="input-field"
          value={newComment}
          onChange={(event) => setNewComment(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
          placeholder="Write a comment..."
          rows={3}
          maxLength={2000}
          disabled={sending}
        />
        <div className="comment-composer__footer">
          <span className={error ? 'error' : ''}>{error || `${newComment.length}/2000 · Enter to send, Shift+Enter for a new line`}</span>
          <button type="submit" className="btn btn-primary btn-sm" disabled={!newComment.trim() || sending}>
            <Send size={15} /> {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </form>
    </section>
  );
}
