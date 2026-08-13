type ErrorPayload = { error?: string };

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, { credentials: 'include', ...init });
  const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
  const isSessionEndpoint = url.includes('/api/auth/login')
    || url.includes('/api/auth/register')
    || url.includes('/api/auth/setup')
    || url.includes('/api/auth/forgot-password')
    || url.includes('/api/auth/reset-password')
    || url.includes('/api/auth/me');
  if (response.status === 401 && !isSessionEndpoint) {
    window.dispatchEvent(new CustomEvent('virtuo:unauthorized'));
  }
  return response;
}

/**
 * Reads an API response without exposing the technical “Unexpected token <” error.
 * A proxy can return HTML for a 502/504 response; users should receive a clear
 * message instead of HTML or a JSON parsing error.
 */
export async function readApiJson<T>(response: Response): Promise<T & ErrorPayload> {
  const body = await response.text();
  if (!body) return {} as T & ErrorPayload;

  try {
    return JSON.parse(body) as T & ErrorPayload;
  } catch {
    return {
      error: response.status === 401
        ? 'The email or password is incorrect.'
        : 'The service is temporarily unavailable. Please try again shortly.',
    } as T & ErrorPayload;
  }
}

export function apiErrorMessage(response: Response, data: ErrorPayload, fallback: string): string {
  if (response.status === 401) return 'The email or password is incorrect.';
  if (response.status >= 500) return 'The server is temporarily unavailable. Please try again shortly.';
  return data.error || fallback;
}
