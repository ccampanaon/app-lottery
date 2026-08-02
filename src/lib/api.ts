import { NextResponse } from 'next/server';
import type { ZodError } from 'zod';
import type { ApiError } from '@/types';
import { auth } from './auth';

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(status: number, error: string, fields?: ApiError['fields']) {
  return NextResponse.json<ApiError>({ error, ...(fields ? { fields } : {}) }, { status });
}

/** Turn a Zod failure into a 422 with per-field messages the form can render. */
export function failValidation(error: ZodError) {
  const fields: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    (fields[key] ??= []).push(issue.message);
  }

  return fail(422, 'Validation failed', fields);
}

export class UnauthorizedError extends Error {}

/**
 * Session check for route handlers.
 *
 * Middleware already redirects unauthenticated *page* requests, but middleware
 * can be bypassed — an API route is reachable directly. Every handler calls this
 * so the session is verified server-side on the request that actually reads or
 * writes data.
 */
export async function requireUser() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new UnauthorizedError('You must be signed in');
  }

  return session.user;
}

/**
 * Wrap a route handler so thrown auth/validation errors become proper responses
 * instead of a 500, and unexpected errors never leak internals to the client.
 */
export async function handleRoute<T>(
  // The handler may return either the success payload or a validation failure,
  // so the union is part of the contract rather than something to cast away.
  fn: () => Promise<NextResponse<T | ApiError>>,
): Promise<NextResponse<T | ApiError>> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return fail(401, error.message);
    }

    console.error('[api]', error);
    return fail(500, 'Something went wrong');
  }
}
