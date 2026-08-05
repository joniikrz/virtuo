import React from 'react';
import { CheckCircle2, Clock, Inbox, Play } from 'lucide-react';
import { Task } from '../types';
import TaskCard from './TaskCard';

interface TaskBoardProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  statusFilter?: string;
}

const columns = [
  { status: 'TODO', label: "Për t'u bërë", icon: Clock, className: 'task-column--todo' },
  { status: 'IN_PROGRESS', label: 'Në proces', icon: Play, className: 'task-column--progress' },
  { status: 'COMPLETED', label: 'Të përfunduara', icon: CheckCircle2, className: 'task-column--completed' },
];

export default function TaskBoard({ tasks, onTaskClick, statusFilter = 'ALL' }: TaskBoardProps) {
  const visibleColumns = statusFilter === 'ALL'
    ? columns
    : columns.filter((column) => column.status === statusFilter);

  return (
    <div className={`tasks-layout ${visibleColumns.length === 1 ? 'tasks-layout--single' : ''}`}>
      {visibleColumns.map((column) => {
        const columnTasks = tasks.filter((task) => task.status === column.status);
        const Icon = column.icon;
        return (
          <section className={`task-column ${column.className}`} key={column.status}>
            <div className="column-header">
              <span className="column-title"><Icon size={16} /><span>{column.label}</span></span>
              <span className="column-count">{columnTasks.length}</span>
            </div>
            <div className="task-card-list">
              {columnTasks.map((task) => <TaskCard key={task.id} task={task} onClick={onTaskClick} />)}
              {columnTasks.length === 0 && (
                <div className="task-column__empty">
                  <Inbox size={20} />
                  <span>Nuk u gjet asnjë detyrë</span>
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
