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
  { value: 'ALL', label: 'Të gjitha' },
  { value: 'TODO', label: "Për t'u bërë" },
  { value: 'IN_PROGRESS', label: 'Në proces' },
  { value: 'COMPLETED', label: 'Të përfunduara' },
];

const priorityChoices = [
  { value: 'ALL', label: 'Të gjitha' },
  { value: 'URGENT', label: 'Urgjent' },
  { value: 'HIGH', label: 'I lartë' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'LOW', label: 'I ulët' },
];

export default function TaskFilters({ tasks, members, filters, resultCount, onChange }: TaskFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLElement>(null);
  const tags = Array.from(
    new Map(tasks.flatMap((task) => task.tags || []).map(({ tag }) => [tag.id, tag])).values()
  ).sort((first, second) => first.name.localeCompare(second.name, 'sq'));

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
    <section ref={containerRef} className="task-filter-shell" aria-label="Kërkimi dhe filtrat e detyrave">
      <div className="task-filter-toolbar">
        <label className="task-search task-search--compact">
          <Search size={18} />
          <input
            type="search"
            value={filters.query}
            onChange={(event) => updateFilter('query', event.target.value)}
            placeholder="Kërko detyrat..."
            aria-label="Kërko detyrat"
          />
          {filters.query && (
            <button type="button" onClick={() => updateFilter('query', '')} aria-label="Pastro kërkimin">
              <X size={16} />
            </button>
          )}
        </label>

        <button
          type="button"
          className={`task-filter-trigger ${isOpen || advancedFilterCount > 0 ? 'active' : ''}`}
          onClick={() => setIsOpen((current) => !current)}
          aria-label="Hap filtrat"
          aria-expanded={isOpen}
        >
          <SlidersHorizontal size={19} />
          <span>Filtro</span>
          {advancedFilterCount > 0 && <strong>{advancedFilterCount}</strong>}
        </button>
      </div>

      {isOpen && (
        <div className="task-filter-popover" role="dialog" aria-label="Zgjidh filtrat">
          <div className="task-filter-popover__header">
            <div>
              <strong>Filtro detyrat</strong>
              <span>{resultCount} nga {tasks.length} detyra</span>
            </div>
            <button type="button" onClick={() => setIsOpen(false)} aria-label="Mbyll filtrat"><X size={18} /></button>
          </div>

          <div className="filter-choice-group">
            <span>Statusi</span>
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
            <span>Prioriteti</span>
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

          <div className="task-filter-popover__grid">
            <label>
              <span>Anëtari</span>
              <select value={filters.assignee} onChange={(event) => updateFilter('assignee', event.target.value)}>
                <option value="ALL">Të gjithë anëtarët</option>
                <option value="UNASSIGNED">Pa person të caktuar</option>
                {members.map((member) => <option key={member.id} value={member.id}>{member.firstName} {member.lastName}</option>)}
              </select>
            </label>

            <label>
              <span>Afati</span>
              <select value={filters.deadline} onChange={(event) => updateFilter('deadline', event.target.value)}>
                <option value="ALL">Çdo afat</option>
                <option value="OVERDUE">Me afat të kaluar</option>
                <option value="TODAY">Për sot</option>
                <option value="NEXT_7_DAYS">7 ditët e ardhshme</option>
                <option value="NO_DEADLINE">Pa afat</option>
              </select>
            </label>

            <label>
              <span>Etiketa</span>
              <select value={filters.tag} onChange={(event) => updateFilter('tag', event.target.value)}>
                <option value="ALL">Të gjitha etiketat</option>
                {tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
              </select>
            </label>

            <label>
              <span>Lidhja ime</span>
              <select value={filters.relationship} onChange={(event) => updateFilter('relationship', event.target.value)}>
                <option value="ALL">Të gjitha detyrat e mia</option>
                <option value="ASSIGNED_TO_ME">Të caktuara për mua</option>
                <option value="CREATED_BY_ME">Të krijuara nga unë</option>
              </select>
            </label>

            <label className="task-filter-popover__sort">
              <span>Renditja</span>
              <select value={filters.sort} onChange={(event) => updateFilter('sort', event.target.value)}>
                <option value="DEFAULT">Renditja standarde</option>
                <option value="DEADLINE_ASC">Afati më i afërt</option>
                <option value="DEADLINE_DESC">Afati më i largët</option>
                <option value="PRIORITY_DESC">Prioriteti më i lartë</option>
                <option value="TITLE_ASC">Titulli A–Z</option>
                <option value="CREATED_DESC">Më të rejat</option>
              </select>
            </label>
          </div>

          <div className="task-filter-popover__footer">
            <button type="button" className="btn btn-secondary btn-sm" onClick={clearAdvancedFilters} disabled={advancedFilterCount === 0}>
              <RotateCcw size={14} /> Pastro filtrat
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setIsOpen(false)}>
              Shfaq {resultCount} {resultCount === 1 ? 'detyrë' : 'detyra'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
