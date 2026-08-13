export interface TaskListRequest {
  userId: string;
  spaceId?: string;
  assignedOnly: boolean;
  limit: number;
}

export interface TaskListRevision {
  count: number;
  updatedAt: Date | null;
}

export interface TaskQueryRepositoryPort {
  canViewSpace(spaceId: string, userId: string): Promise<boolean>;
  revision(request: TaskListRequest): Promise<TaskListRevision>;
  list(request: TaskListRequest): Promise<unknown[]>;
}

