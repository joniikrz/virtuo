import React, { useEffect, useRef, useState } from 'react';
import { Check, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import { Task, User } from '../types';

export interface TaskFiltersState {
  query: string;
  status: string;
  priority: string;
  assignee: string;
  deadline: string;
  tag: string;
  relationship: string;
  sort: string;
}

export const DEFAULT_TASK_FILTERS: TaskFiltersState = {
  query: '',
  status: 'ALL',
  priority: 'ALL',
  assignee: 'ALL',
  deadline: 'ALL',
  tag: 'ALL',
  relationship: 'ALL',
  sort: 'DEFAULT',
};

interface TaskFiltersProps {
  tasks: Task[];
  members: User[];
  filters: TaskFiltersState;
  resultCount: number;
  onChange: (filters: TaskFiltersState) => void;
}

const statusChoices = [
  { value: 'ALL', label: 'All' },
  { value: 'TODO', label: 'To do' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'COMPLETED', label: 'Completed' },
];

const priorityChoices = [
  { value: 'ALL', label: 'All' },
  { value: 'URGENT', label: 'Urgent' },
  { value: 'HIGH', label: 'High' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'LOW', label: 'Low' },
];

export default function TaskFilters({ tasks, members, filters, resultCount, onChange }: TaskFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLElement>(null);
  const tags = Array.from(
    new Map(tasks.flatMap((task) => task.tags || []).map(({ tag }) => [tag.id, tag])).values()
  ).sort((first, second) => first.name.localeCompare(second.name, 'en'));

  const updateFilter = (key: keyof TaskFiltersState, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  const advancedFilterCount = Object.entries(filters).filter(([key, value]) => {
    if (key === 'query') return false;
    return value !== 'ALL' && value !== 'DEFAULT';
  }).length;

  const clearAdvancedFilters = () => onChange({ ...DEFAULT_TASK_FILTERS, query: filters.query });

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  return (
    <section ref={containerRef} className="task-filter-shell" aria-label="Task search and filters">
      <div className="task-filter-toolbar">
        <label className="task-search task-search--compact">
          <Search size={18} />
          <input
            type="search"
            value={filters.query}
            onChange={(event) => updateFilter('query', event.target.value)}
            placeholder="Search tasks..."
            aria-label="Search tasks"
          />
          {filters.query && (
            <button type="button" onClick={() => updateFilter('query', '')} aria-label="Clear search">
              <X size={16} />
            </button>
          )}
        </label>

        <button
          type="button"
          className={`task-filter-trigger ${isOpen || advancedFilterCount > 0 ? 'active' : ''}`}
          onClick={() => setIsOpen((current) => !current)}
          aria-label="Open filters"
          aria-expanded={isOpen}
        >
          <SlidersHorizontal size={19} />
          <span>Filter</span>
          {advancedFilterCount > 0 && <strong>{advancedFilterCount}</strong>}
        </button>
      </div>

      {isOpen && (
        <div className="task-filter-popover" role="dialog" aria-label="Choose filters">
          <div className="task-filter-popover__header">
            <span className="task-filter-popover__icon"><SlidersHorizontal size={18} /></span>
            <div>
              <strong>Filter tasks</strong>
              <span>Select only the criteria you need</span>
            </div>
            <span className="task-filter-popover__results">{resultCount}/{tasks.length}</span>
            <button type="button" onClick={() => setIsOpen(false)} aria-label="Close filters"><X size={18} /></button>
          </div>

          <div className="filter-choice-panels">
            <div className="filter-choice-group">
              <span>Status</span>
              <div className="filter-choice-row">
                {statusChoices.map((choice) => (
                  <button
                    type="button"
                    key={choice.value}
                    className={filters.status === choice.value ? 'selected' : ''}
                    onClick={() => updateFilter('status', choice.value)}
                    aria-pressed={filters.status === choice.value}
                  >
                    {filters.status === choice.value && <Check size={13} />}{choice.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-choice-group">
              <span>Priority</span>
              <div className="filter-choice-row">
                {priorityChoices.map((choice) => (
                  <button
                    type="button"
                    key={choice.value}
                    className={filters.priority === choice.value ? 'selected' : ''}
                    onClick={() => updateFilter('priority', choice.value)}
                    aria-pressed={filters.priority === choice.value}
                  >
                    {filters.priority === choice.value && <Check size={13} />}{choice.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="task-filter-popover__section-title"><span>More filters</span><small>Combine them as needed</small></div>
          <div className="task-filter-popover__grid">
            <label>
              <span>Member</span>
              <select value={filters.assignee} onChange={(event) => updateFilter('assignee', event.target.value)}>
                <option value="ALL">All members</option>
                <option value="UNASSIGNED">Unassigned</option>
                {members.map((member) => <option key={member.id} value={member.id}>{member.firstName} {member.lastName}</option>)}
              </select>
            </label>

            <label>
              <span>Deadline</span>
              <select value={filters.deadline} onChange={(event) => updateFilter('deadline', event.target.value)}>
                <option value="ALL">Any deadline</option>
                <option value="OVERDUE">Overdue</option>
                <option value="TODAY">Due today</option>
                <option value="NEXT_7_DAYS">Next 7 days</option>
                <option value="NO_DEADLINE">No deadline</option>
              </select>
            </label>

            <label>
              <span>Tag</span>
              <select value={filters.tag} onChange={(event) => updateFilter('tag', event.target.value)}>
                <option value="ALL">All tags</option>
                {tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
              </select>
            </label>

            <label>
              <span>My relationship</span>
              <select value={filters.relationship} onChange={(event) => updateFilter('relationship', event.target.value)}>
                <option value="ALL">All my tasks</option>
                <option value="ASSIGNED_TO_ME">Assigned to me</option>
                <option value="CREATED_BY_ME">Created by me</option>
              </select>
            </label>

            <label className="task-filter-popover__sort">
              <span>Sort</span>
              <select value={filters.sort} onChange={(event) => updateFilter('sort', event.target.value)}>
                <option value="DEFAULT">Default order</option>
                <option value="DEADLINE_ASC">Nearest deadline</option>
                <option value="DEADLINE_DESC">Latest deadline</option>
                <option value="PRIORITY_DESC">Highest priority</option>
                <option value="TITLE_ASC">Title A–Z</option>
                <option value="CREATED_DESC">Newest first</option>
              </select>
            </label>
          </div>

          <div className="task-filter-popover__footer">
            <button type="button" className="btn btn-secondary btn-sm" onClick={clearAdvancedFilters} disabled={advancedFilterCount === 0}>
              <RotateCcw size={14} /> Clear filters
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setIsOpen(false)}>
              Show {resultCount} {resultCount === 1 ? 'task' : 'tasks'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
