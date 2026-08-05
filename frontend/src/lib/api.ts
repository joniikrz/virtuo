type ErrorPayload = { error?: string };

/**
 * Lexon përgjigje API pa nxjerrë gabimin teknik “Unexpected token <”.
 * Proxy/NGINX mund të kthejë HTML për 502/504; përdoruesi duhet të marrë
 * një mesazh të kuptueshëm, jo HTML ose gabim JSON.
 */
export async function readApiJson<T>(response: Response): Promise<T & ErrorPayload> {
  const body = await response.text();
  if (!body) return {} as T & ErrorPayload;

  try {
    return JSON.parse(body) as T & ErrorPayload;
  } catch {
    return {
      error: response.status === 401
        ? 'Email-i ose fjalëkalimi janë të gabuar.'
        : 'Shërbimi nuk është i disponueshëm për momentin. Provo përsëri pas pak.',
    } as T & ErrorPayload;
  }
}

export function apiErrorMessage(response: Response, data: ErrorPayload, fallback: string): string {
  if (response.status === 401) return 'Email-i ose fjalëkalimi janë të gabuar.';
  if (response.status >= 500) return 'Serveri ka një problem të përkohshëm. Provo përsëri pas pak.';
  return data.error || fallback;
}
