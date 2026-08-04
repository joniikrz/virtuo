import React from 'react';
import { Clock, Play, CheckCircle2 } from 'lucide-react';
import { Task } from '../types';
import TaskCard from './TaskCard';

interface TaskBoardProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

export default function TaskBoard({ tasks, onTaskClick }: TaskBoardProps) {
  const getTasksByStatus = (status: string) => tasks.filter(t => t.status === status);

  return (
    <div className="tasks-layout">
      {/* TODO */}
      <div className="task-column">
        <div className="column-header">
          <span className="column-title" style={{ color: 'hsl(var(--accent-warning))' }}>
            <Clock size={16} />
            <span>Për t'u bërë</span>
          </span>
          <span className="column-count">{getTasksByStatus('TODO').length}</span>
        </div>
        <div className="task-card-list">
          {getTasksByStatus('TODO').map(t => (
            <TaskCard key={t.id} task={t} onClick={onTaskClick} />
          ))}
        </div>
      </div>

      {/* IN_PROGRESS */}
      <div className="task-column">
        <div className="column-header">
          <span className="column-title" style={{ color: 'hsl(var(--primary))' }}>
            <Play size={16} />
            <span>Në proces</span>
          </span>
          <span className="column-count">{getTasksByStatus('IN_PROGRESS').length}</span>
        </div>
        <div className="task-card-list">
          {getTasksByStatus('IN_PROGRESS').map(t => (
            <TaskCard key={t.id} task={t} onClick={onTaskClick} />
          ))}
        </div>
      </div>

      {/* COMPLETED */}
      <div className="task-column">
        <div className="column-header">
          <span className="column-title" style={{ color: 'hsl(var(--accent-success))' }}>
            <CheckCircle2 size={16} />
            <span>E përfunduar</span>
          </span>
          <span className="column-count">{getTasksByStatus('COMPLETED').length}</span>
        </div>
        <div className="task-card-list">
          {getTasksByStatus('COMPLETED').map(t => (
            <TaskCard key={t.id} task={t} onClick={onTaskClick} />
          ))}
        </div>
      </div>
    </div>
  );
}
