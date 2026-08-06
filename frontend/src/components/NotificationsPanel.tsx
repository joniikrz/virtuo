import React, { useEffect } from 'react';
import { Bell, CheckCheck, ChevronRight, Inbox, X } from 'lucide-react';
import { Notification } from '../types';

interface NotificationsPanelProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onOpenTask: (taskId: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationsPanel({ notifications, onMarkAsRead, onMarkAllAsRead, onOpenTask, isOpen, onClose }: NotificationsPanelProps) {
  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

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
      <button className="notification-drawer-backdrop" type="button" onClick={onClose} aria-label="Mbyll njoftimet" />

      <aside className="notification-drawer" role="dialog" aria-modal="true" aria-label="Njoftimet">
        <header className="notification-drawer__header">
          <div className="notification-drawer__title">
            <span className="notification-drawer__title-icon"><Bell size={19} /></span>
            <div>
              <h3>Njoftimet</h3>
              <p>{unreadCount > 0 ? `${unreadCount} të palexuara` : 'Të gjitha janë lexuar'}</p>
            </div>
          </div>
          <button type="button" className="notification-drawer__close" onClick={onClose} aria-label="Mbyll njoftimet">
            <X size={20} />
          </button>
        </header>

        {unreadCount > 0 && (
          <div className="notification-drawer__actions">
            <button onClick={onMarkAllAsRead} className="btn btn-secondary btn-sm">
              <CheckCheck size={15} /> Shënoji të gjitha si të lexuara
            </button>
          </div>
        )}

        <div className="notification-drawer__list">
          {notifications.length === 0 ? (
            <div className="notification-drawer__empty">
              <span><Inbox size={26} /></span>
              <strong>Nuk ka njoftime</strong>
              <p>Kur të ketë aktivitet të ri në detyrat e tua, do të shfaqet këtu.</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <button
                type="button"
                key={notification.id}
                className={`notification-drawer__item ${notification.isRead ? '' : 'unread'}`}
                onClick={() => {
                  if (!notification.isRead) onMarkAsRead(notification.id);
                  if (notification.taskId) onOpenTask(notification.taskId);
                }}
                title={notification.taskId ? 'Hap detyrën' : 'Shëno si të lexuar'}
              >
                <span className="notification-drawer__status" aria-hidden="true" />
                <div className="notification-drawer__content">
                  <strong>{notification.title}</strong>
                  <p>{notification.message}</p>
                  <time dateTime={notification.createdAt}>
                    {new Date(notification.createdAt).toLocaleString('sq-AL', { dateStyle: 'medium', timeStyle: 'short' })}
                  </time>
                </div>
                {notification.taskId && <ChevronRight className="notification-drawer__open-icon" size={17} aria-hidden="true" />}
              </button>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
