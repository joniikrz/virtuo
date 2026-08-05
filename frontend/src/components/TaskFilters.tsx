import React from 'react';
import { Filter, RotateCcw, Search } from 'lucide-react';
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

export default function TaskFilters({ tasks, members, filters, resultCount, onChange }: TaskFiltersProps) {
  const tags = Array.from(
    new Map(
      tasks.flatMap((task) => task.tags || []).map(({ tag }) => [tag.id, tag])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name, 'sq'));

  const updateFilter = (key: keyof TaskFiltersState, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
    if (key === 'query') return Boolean(value.trim());
    return value !== 'ALL' && value !== 'DEFAULT';
  }).length;

  return (
    <section className="task-filters" aria-label="Filtrat e detyrave">
      <div className="task-filters__topbar">
        <div className="task-filters__heading">
          <span className="task-filters__icon"><Filter size={17} /></span>
          <div>
            <strong>Filtro detyrat</strong>
            <span>{resultCount} nga {tasks.length} detyra</span>
          </div>
        </div>

        <label className="task-search">
          <Search size={17} />
          <input
            type="search"
            value={filters.query}
            onChange={(event) => updateFilter('query', event.target.value)}
            placeholder="Kërko titullin ose përshkrimin..."
          />
        </label>

        <button
          type="button"
          className="btn btn-secondary btn-sm task-filters__reset"
          onClick={() => onChange(DEFAULT_TASK_FILTERS)}
          disabled={activeFilterCount === 0}
        >
          <RotateCcw size={15} />
          Pastro {activeFilterCount > 0 && `(${activeFilterCount})`}
        </button>
      </div>

      <div className="task-filters__grid">
        <label>
          <span>Statusi</span>
          <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
            <option value="ALL">Të gjitha</option>
            <option value="TODO">Për t'u bërë</option>
            <option value="IN_PROGRESS">Në proces</option>
            <option value="COMPLETED">Të përfunduara</option>
          </select>
        </label>

        <label>
          <span>Prioriteti</span>
          <select value={filters.priority} onChange={(event) => updateFilter('priority', event.target.value)}>
            <option value="ALL">Të gjitha</option>
            <option value="URGENT">Urgjent</option>
            <option value="HIGH">I lartë</option>
            <option value="NORMAL">Normal</option>
            <option value="LOW">I ulët</option>
          </select>
        </label>

        <label>
          <span>Anëtari</span>
          <select value={filters.assignee} onChange={(event) => updateFilter('assignee', event.target.value)}>
            <option value="ALL">Të gjithë anëtarët</option>
            <option value="UNASSIGNED">Pa person të caktuar</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>{member.firstName} {member.lastName}</option>
            ))}
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

        <label>
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
    </section>
  );
}
