export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  emailNotifications?: boolean;
  inAppNotifications?: boolean;
  hasRecoveryCode?: boolean;
}

export interface Space {
  id: string;
  name: string;
  color?: string;
  isPrivate: boolean;
  createdBy: {
    id?: string;
    firstName: string;
    lastName: string;
  };
  _count?: {
    members: number;
    tasks: number;
  };
}

export interface Attachment {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedById?: string;
  uploadedAt: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface Comment {
  id: string;
  content: string;
  author: { id?: string; firstName: string; lastName: string; role: string | { name: string }; };
  createdAt: string;
}

export interface Task {
  id: string;
  spaceId: string;
  space?: { id: string; name: string; color?: string };
  title: string;
  description: string;
  status: string;
  priority: string; // LOW, NORMAL, HIGH, URGENT
  deadline: string;
  createdAt?: string;
  updatedAt?: string;
  assignedTo: { id: string; email: string; firstName: string; lastName: string; } | null;
  assignedToId?: string | null;
  assignees: { id: string; user: { id: string; email: string; firstName: string; lastName: string; } }[];
  createdBy: { id?: string; firstName: string; lastName: string; };
  attachments: Attachment[];
  comments: Comment[];
  tags: { id: string; tag: { id: string; name: string; color: string; } }[];
  _count?: { comments: number; attachments?: number; };
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  taskId: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  spaceInviteId?: string | null;
  createdAt: string;
}
