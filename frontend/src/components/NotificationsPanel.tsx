import React, { useState } from 'react';
import { Bell, Check } from 'lucide-react';
import { Notification } from '../types';

interface NotificationsPanelProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationsPanel({ notifications, onMarkAsRead, onMarkAllAsRead, isOpen, onClose }: NotificationsPanelProps) {
  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="notifications-dropdown" style={{
      position: 'absolute',
      top: '50px',
      right: '20px',
      width: '320px',
      backgroundColor: 'hsl(var(--bg-primary))',
      border: '1px solid hsl(var(--border))',
      borderRadius: 'var(--border-radius-md)',
      boxShadow: 'var(--shadow-lg)',
      zIndex: 1000,
      overflow: 'hidden'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid hsl(var(--border))' }}>
        <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bell size={16} /> Njoftimet
        </h4>
        {unreadCount > 0 && (
          <button onClick={onMarkAllAsRead} className="btn btn-secondary btn-sm" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
            <Check size={12} /> Lexo të gjitha
          </button>
        )}
      </div>

      <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
        {notifications.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: '0.85rem' }}>
            Nuk keni njoftime të reja.
          </div>
        ) : (
          notifications.map(n => (
            <div 
              key={n.id} 
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid hsl(var(--border))',
                backgroundColor: n.isRead ? 'transparent' : 'hsl(var(--primary) / 0.05)',
                cursor: 'pointer'
              }}
              onClick={() => {
                if (!n.isRead) onMarkAsRead(n.id);
              }}
            >
              <div style={{ fontWeight: n.isRead ? 400 : 600, fontSize: '0.9rem', marginBottom: '4px' }}>
                {n.title}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>
                {n.message}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))', marginTop: '6px' }}>
                {new Date(n.createdAt).toLocaleString('sq-AL', { dateStyle: 'short', timeStyle: 'short' })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
