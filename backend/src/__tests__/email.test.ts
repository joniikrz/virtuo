import { describe, expect, it } from 'vitest';
import { buildTaskUrl } from '../services/email';

describe('Email task links', () => {
  it('ndërton deep-link-un e taskut mbi FRONTEND_URL', () => {
    expect(buildTaskUrl('task_123-abc', 'https://virtuo-tasks.local')).toBe(
      'https://virtuo-tasks.local/?task=task_123-abc',
    );
  });

  it('përdor origin-in e parë kur CORS ka më shumë URL', () => {
    expect(buildTaskUrl('task-1', 'https://virtuo.example, http://localhost:5173')).toBe(
      'https://virtuo.example/?task=task-1',
    );
  });

  it('refuzon protokolle dhe task ID të pasigurta', () => {
    expect(buildTaskUrl('task-1', 'javascript:alert(1)')).toBe('');
    expect(buildTaskUrl('../task', 'https://virtuo.example')).toBe('');
  });
});
