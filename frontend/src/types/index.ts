export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface Space {
  id: string;
  name: string;
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
  author: { firstName: string; lastName: string; role: string; };
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string; // LOW, NORMAL, HIGH, URGENT
  deadline: string;
  assignedTo: { id: string; email: string; firstName: string; lastName: string; } | null;
  assignedToId?: string | null;
  assignees: { id: string; user: { id: string; email: string; firstName: string; lastName: string; } }[];
  createdBy: { id?: string; firstName: string; lastName: string; };
  attachments: Attachment[];
  comments: Comment[];
  tags: { id: string; tag: { id: string; name: string; color: string; } }[];
  _count?: { comments: number; };
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  taskId: string | null;
  createdAt: string;
}
