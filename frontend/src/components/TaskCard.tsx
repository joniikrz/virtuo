import React from 'react';
import { Calendar, CheckCircle2 } from 'lucide-react';
import { Task } from '../types';

interface TaskCardProps {
  task: Task;
  onClick: (task: Task) => void;
}

export default function TaskCard({ task, onClick }: TaskCardProps) {
  const isCompleted = task.status === 'COMPLETED';
  const isOverdue = new Date(task.deadline) < new Date() && !isCompleted;
  const assignedUsers = task.assignees?.length ? task.assignees.map((assignment) => assignment.user) : task.assignedTo ? [task.assignedTo] : [];
  const assigneeLabel = assignedUsers.length > 2
    ? `${assignedUsers[0].firstName}, ${assignedUsers[1].firstName} +${assignedUsers.length - 2}`
    : assignedUsers.map((user) => `${user.firstName} ${user.lastName[0]}.`).join(', ');

  return (
    <div 
      className="task-card" 
      onClick={() => onClick(task)}
      style={{ opacity: isCompleted ? 0.8 : 1 }}
    >
      <h4 className="task-card-title" style={{ textDecoration: isCompleted ? 'line-through' : 'none' }}>
        {task.title}
      </h4>
      {task.description && <p className="task-card-description">{task.description}</p>}
      
      {/* Priority & Tags can go here later */}
      
      <div className="task-card-footer">
        <span className="task-card-assignee">
          {assigneeLabel || 'I pacaktuar'}
        </span>
        <span className={`task-card-deadline ${isOverdue ? 'danger' : 'normal'}`}>
          {isCompleted ? (
            <><CheckCircle2 size={12} style={{ color: 'hsl(var(--accent-success))' }} /> Kryer</>
          ) : (
            <><Calendar size={12} /> {new Date(task.deadline).toLocaleDateString('sq-AL', { month: 'short', day: 'numeric' })}</>
          )}
        </span>
      </div>
    </div>
  );
}
