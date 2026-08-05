import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { Comment } from '../types';

interface CommentsSectionProps {
  comments: Comment[];
  onAddComment: (content: string) => Promise<void>;
}

export default function CommentsSection({ comments, onAddComment }: CommentsSectionProps) {
  const [newComment, setNewComment] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
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
      setError(err instanceof Error ? err.message : 'Komenti nuk u ruajt. Provo përsëri.');
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="comments-section" aria-labelledby="comments-heading">
      <header className="comments-header">
        <span className="comments-header__icon"><MessageCircle size={17} /></span>
        <div><h4 id="comments-heading">Biseda</h4><p>{comments.length} {comments.length === 1 ? 'koment' : 'komente'}</p></div>
        <span className="comments-live"><i /> Live</span>
      </header>

      <div ref={listRef} className="comments-list" aria-live="polite">
        {comments.map((comment) => (
          <article key={comment.id} className="comment-item">
            <span className="comment-avatar" aria-hidden="true">{comment.author.firstName.charAt(0)}{comment.author.lastName.charAt(0)}</span>
            <div className="comment-body">
              <div className="comment-meta">
                <strong>{comment.author.firstName} {comment.author.lastName}</strong>
                <span className="comment-role">{comment.author.role}</span>
                <time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString('sq-AL', { dateStyle: 'short', timeStyle: 'short' })}</time>
              </div>
              <p className="comment-text">{comment.content}</p>
            </div>
          </article>
        ))}
        {comments.length === 0 && (
          <div className="comments-empty"><MessageCircle size={24} /><strong>Ende nuk ka komente</strong><span>Fillo bisedën për këtë detyrë.</span></div>
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
          placeholder="Shkruaj një koment..."
          rows={3}
          maxLength={2000}
          disabled={sending}
        />
        <div className="comment-composer__footer">
          <span className={error ? 'error' : ''}>{error || `${newComment.length}/2000 · Enter për dërgim, Shift+Enter për rresht të ri`}</span>
          <button type="submit" className="btn btn-primary btn-sm" disabled={!newComment.trim() || sending}>
            <Send size={15} /> {sending ? 'Duke dërguar...' : 'Dërgo'}
          </button>
        </div>
      </form>
    </section>
  );
}
