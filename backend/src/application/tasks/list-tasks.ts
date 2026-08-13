import { AccessDeniedError } from '../shared/errors';
import { TaskListRequest, TaskQueryRepositoryPort } from './ports';

export interface ListTasksInput extends Omit<TaskListRequest, 'limit'> {
  ifNoneMatch?: string;
}

export interface ListTasksOutput {
  etag: string;
  notModified: boolean;
  resultLimit: number;
  tasks: unknown[];
}

export class ListTasks {
  constructor(
    private readonly repository: TaskQueryRepositoryPort,
    private readonly resultLimit: number,
  ) {}

  async execute(input: ListTasksInput): Promise<ListTasksOutput> {
    if (input.spaceId && !await this.repository.canViewSpace(input.spaceId, input.userId)) {
      throw new AccessDeniedError('Nuk keni leje për këtë hapësirë');
    }

    const request: TaskListRequest = { ...input, limit: this.resultLimit };
    const revision = await this.repository.revision(request);
    const etag = `W/"tasks-${revision.count}-${revision.updatedAt?.getTime() || 0}"`;
    if (input.ifNoneMatch === etag) {
      return { etag, notModified: true, resultLimit: this.resultLimit, tasks: [] };
    }

    return {
      etag,
      notModified: false,
      resultLimit: this.resultLimit,
      tasks: await this.repository.list(request),
    };
  }
}

