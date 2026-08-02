import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';

/*
 * Next 16 renamed the `middleware` file convention to `proxy`; the old name
 * still works but warns on every build.
 *
 * Two things here are load-bearing and easy to get wrong:
 *
 *   1. This file must live in `src/` alongside `app/`. At the project root it is
 *      still reported as "ƒ Proxy" by `next build` yet never runs, leaving every
 *      protected page reachable while signed out.
 *   2. It imports only the edge-safe half of the Auth.js config — no database
 *      code, since Mongoose cannot run on the Edge runtime.
 *
 * This is a redirect convenience, NOT the security boundary: the `(app)` layout
 * re-checks the session server-side, and every route handler calls
 * `requireUser()`.
 */
export default NextAuth(authConfig).auth;

export const config = {
  /*
   * Match everything except static assets and the Auth.js endpoints, then let
   * the `authorized` callback decide per path. Listing protected prefixes here
   * instead (`/dashboard/:path*`) silently fails to match the bare `/dashboard`,
   * which leaves the page reachable while signed out.
   */
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};
