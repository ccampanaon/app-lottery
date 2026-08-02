import type { ApiError } from '@/types';

export class ApiRequestError extends Error {
  readonly status: number;
  readonly fields?: ApiError['fields'];

  constructor(status: number, message: string, fields?: ApiError['fields']) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.fields = fields;
  }
}

/**
 * Typed fetch for the app's own route handlers. Turns a non-2xx into a thrown
 * `ApiRequestError` so React Query treats it as an error rather than caching a
 * failure payload as if it were data.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let message = response.statusText || 'Request failed';
    let fields: ApiError['fields'];

    try {
      const body = (await response.json()) as ApiError;
      if (body.error) message = body.error;
      fields = body.fields;
    } catch {
      // Non-JSON error body (a proxy timeout, an HTML error page) — keep the
      // status text rather than masking the real failure with a parse error.
    }

    throw new ApiRequestError(response.status, message, fields);
  }

  return (await response.json()) as T;
}

/** Build a query string, omitting empty values so URLs stay clean and cacheable. */
export function queryString(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }

  const qs = search.toString();
  return qs ? `?${qs}` : '';
}
