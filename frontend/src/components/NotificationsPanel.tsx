import React, { useEffect, useState } from 'react';
import { Bell, Check, CheckCheck, ChevronRight, Inbox, LoaderCircle, X, XCircle } from 'lucide-react';
import { Notification } from '../types';

interface NotificationsPanelProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onOpenTask: (taskId: string, notificationId: string) => void;
  onRespondToSpaceInvite: (inviteId: string, action: 'accept' | 'reject', notificationId: string) => Promise<string>;
  isOpen: boolean;
  onClose: () => void;
}

function notificationText(notification: Notification): { title: string; message: string } {
  const titles: Record<string, string> = {
    TASK_ASSIGNED: 'New task',
    TASK_COMPLETED: 'Task completed',
    COMMENT_ADDED: 'New comment',
    ATTACHMENT_ADDED: 'New file',
    SPACE_INVITE: 'Workspace invitation',
    SPACE_INVITE_ACCEPTED: 'Invitation accepted',
    SPACE_INVITE_REJECTED: 'Invitation declined',
  };
  let message = notification.message;
  message = message.replace(/^Ju është caktuar detyra:\s*/i, 'You were assigned the task: ');
  message = message.replace(/^Detyra u përfundua:\s*/i, 'Task completed: ');
  message = message.replace(/^(.+) komentoi në detyrën:\s*/i, '$1 commented on the task: ');
  message = message.replace(/^(.+) bashkëngjiti një skedar në detyrën:\s*/i, '$1 attached a file to the task: ');
  message = message.replace(/^(.+) të ftoi në hapësirën:\s*/i, '$1 invited you to the workspace: ');
  message = message.replace(/^(.+) pranoi ftesën për:\s*/i, '$1 accepted the invitation to: ');
  message = message.replace(/^(.+) refuzoi ftesën për:\s*/i, '$1 declined the invitation to: ');
  return { title: titles[notification.type] || notification.title, message };
}

export default function NotificationsPanel({ notifications, onMarkAsRead, onMarkAllAsRead, onOpenTask, onRespondToSpaceInvite, isOpen, onClose }: NotificationsPanelProps) {
  const unreadCount = notifications.filter((notification) => !notification.isRead).length;
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const respondToInvite = async (notification: Notification, action: 'accept' | 'reject') => {
    const inviteId = notification.spaceInviteId || notification.resourceId;
    if (!inviteId || respondingId) return;
    setRespondingId(notification.id);
    setActionMessage(null);
    try {
      const message = await onRespondToSpaceInvite(inviteId, action, notification.id);
      setActionMessage({ type: 'success', text: message });
    } catch (error) {
      setActionMessage({ type: 'error', text: error instanceof Error ? error.message : 'The invitation could not be processed.' });
    } finally {
      setRespondingId(null);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="notification-drawer-layer" role="presentation">
      <button className="notification-drawer-backdrop" type="button" onClick={onClose} aria-label="Close notifications" />

      <aside className="notification-drawer" role="dialog" aria-modal="true" aria-label="Notifications">
        <header className="notification-drawer__header">
          <div className="notification-drawer__title">
            <span className="notification-drawer__title-icon"><Bell size={19} /></span>
            <div>
              <h3>Notifications</h3>
              <p>{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}</p>
            </div>
          </div>
          <button type="button" className="notification-drawer__close" onClick={onClose} aria-label="Close notifications">
            <X size={20} />
          </button>
        </header>

        {unreadCount > 0 && (
          <div className="notification-drawer__actions">
            <button onClick={onMarkAllAsRead} className="btn btn-secondary btn-sm">
              <CheckCheck size={15} /> Mark all as read
            </button>
          </div>
        )}

        <div className="notification-drawer__list">
          {actionMessage && <div className={`notification-invite-feedback ${actionMessage.type}`} role="status">{actionMessage.text}</div>}
          {notifications.length === 0 ? (
            <div className="notification-drawer__empty">
              <span><Inbox size={26} /></span>
              <strong>No notifications</strong>
              <p>New activity on your tasks will appear here.</p>
            </div>
          ) : (
            notifications.map((notification) => {
              const display = notificationText(notification);
              const isSpaceInvite = notification.type === 'SPACE_INVITE' && Boolean(notification.spaceInviteId || notification.resourceId);
              if (isSpaceInvite) {
                const isResponding = respondingId === notification.id;
                return (
                  <article key={notification.id} className={`notification-drawer__item notification-drawer__invite ${notification.isRead ? '' : 'unread'}`}>
                    <span className="notification-drawer__status" aria-hidden="true" />
                    <div className="notification-drawer__content">
                      <strong>{display.title}</strong>
                      <p>{display.message}</p>
                      <time dateTime={notification.createdAt}>{new Date(notification.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</time>
                      <div className="notification-invite-actions">
                        <button type="button" className="btn btn-primary btn-sm" disabled={isResponding} onClick={() => void respondToInvite(notification, 'accept')}>
                          {isResponding ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />} Accept
                        </button>
                        <button type="button" className="btn btn-secondary btn-sm" disabled={isResponding} onClick={() => void respondToInvite(notification, 'reject')}>
                          <XCircle size={15} /> Decline
                        </button>
                      </div>
                    </div>
                  </article>
                );
              }
              return (
                <button
                  type="button"
                  key={notification.id}
                  className={`notification-drawer__item ${notification.isRead ? '' : 'unread'}`}
                  onClick={() => {
                    if (!notification.isRead) onMarkAsRead(notification.id);
                    if (notification.taskId) onOpenTask(notification.taskId, notification.id);
                  }}
                  title={notification.taskId ? 'Open task' : 'Mark as read'}
                >
                  <span className="notification-drawer__status" aria-hidden="true" />
                  <div className="notification-drawer__content">
                    <strong>{display.title}</strong>
                    <p>{display.message}</p>
                    <time dateTime={notification.createdAt}>{new Date(notification.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</time>
                  </div>
                  {notification.taskId && <ChevronRight className="notification-drawer__open-icon" size={17} aria-hidden="true" />}
                </button>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
}
