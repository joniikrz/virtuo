import React from 'react';
import { Activity, Users, CheckCircle2, Clock } from 'lucide-react';
import { Task, User } from '../types';

interface StatsPanelProps {
  tasks: Task[];
  membersCount: number;
}

export default function StatsPanel({ tasks, membersCount }: StatsPanelProps) {
  const completedTasks = tasks.filter(t => t.status === 'COMPLETED').length;
  const pendingTasks = tasks.filter(t => t.status !== 'COMPLETED').length;
  const totalTasks = tasks.length;
  const completionRate = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  return (
    <div className="stats-panel" style={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
      gap: '16px', 
      marginBottom: '24px' 
    }}>
      
      <div className="stat-card" style={{ backgroundColor: 'hsl(var(--bg-secondary))', padding: '16px', borderRadius: 'var(--border-radius-md)', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ padding: '12px', backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))', borderRadius: '50%' }}>
          <Activity size={24} />
        </div>
        <div>
          <div style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>Progresi</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{completionRate}%</div>
        </div>
      </div>

      <div className="stat-card" style={{ backgroundColor: 'hsl(var(--bg-secondary))', padding: '16px', borderRadius: 'var(--border-radius-md)', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ padding: '12px', backgroundColor: 'hsl(var(--accent-success) / 0.1)', color: 'hsl(var(--accent-success))', borderRadius: '50%' }}>
          <CheckCircle2 size={24} />
        </div>
        <div>
          <div style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>Të Përfunduara</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{completedTasks}</div>
        </div>
      </div>

      <div className="stat-card" style={{ backgroundColor: 'hsl(var(--bg-secondary))', padding: '16px', borderRadius: 'var(--border-radius-md)', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ padding: '12px', backgroundColor: 'hsl(var(--accent-warning) / 0.1)', color: 'hsl(var(--accent-warning))', borderRadius: '50%' }}>
          <Clock size={24} />
        </div>
        <div>
          <div style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>Në Pritje</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{pendingTasks}</div>
        </div>
      </div>

      <div className="stat-card" style={{ backgroundColor: 'hsl(var(--bg-secondary))', padding: '16px', borderRadius: 'var(--border-radius-md)', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ padding: '12px', backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))', borderRadius: '50%' }}>
          <Users size={24} />
        </div>
        <div>
          <div style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>Anëtarë</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{membersCount}</div>
        </div>
      </div>

    </div>
  );
}
