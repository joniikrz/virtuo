export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'COMPLETED'] as const;
export const TASK_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;

export type TaskStatus = typeof TASK_STATUSES[number];
export type TaskPriority = typeof TASK_PRIORITIES[number];

const taskStatuses = new Set<string>(TASK_STATUSES);
const taskPriorities = new Set<string>(TASK_PRIORITIES);

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && taskStatuses.has(value);
}

export function isTaskPriority(value: unknown): value is TaskPriority {
  return typeof value === 'string' && taskPriorities.has(value);
}

export function parseTaskDeadline(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseAssigneeIds(multipleValue: unknown, legacyValue: unknown): string[] {
  const candidates: unknown[] = Array.isArray(multipleValue) ? multipleValue : [legacyValue];
  return [...new Set(candidates.filter(
    (id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 100,
  ))];
}

