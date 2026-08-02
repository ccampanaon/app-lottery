import type { NextAuthConfig } from 'next-auth';

/** Route prefixes that require a session. */
export const PROTECTED_PREFIXES = ['/dashboard', '/results', '/predictions'] as const;

export const LOGIN_PATH = '/login';

/*
 * The half of the Auth.js config that is safe to run on the Edge runtime, where
 * middleware executes. It deliberately imports no database code — Mongoose
 * cannot run on Edge. The credentials provider, which does hit Mongo, is added
 * in `auth.ts` for the Node-runtime route handlers.
 *
 * This split is why the session strategy must be JWT: middleware verifies a
 * signed cookie rather than looking a session up in the database.
 */
export const authConfig = {
  pages: { signIn: LOGIN_PATH },
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours
  },
  // Populated in auth.ts. Middleware only ever verifies an existing token.
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      // `user` is only present on the sign-in pass; afterwards the token is reused.
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },

    session({ session, token }) {
      if (token.id) session.user.id = token.id;
      if (token.role) session.user.role = token.role;
      return session;
    },

    authorized({ auth, request }) {
      const isLoggedIn = Boolean(auth?.user);
      const { pathname } = request.nextUrl;

      // A signed-in user landing on /login has nothing to do there.
      if (pathname.startsWith(LOGIN_PATH)) {
        if (isLoggedIn) return Response.redirect(new URL('/dashboard', request.nextUrl));
        return true;
      }

      const isProtected = PROTECTED_PREFIXES.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
      );

      // Returning false makes Auth.js redirect to `pages.signIn` with a
      // callbackUrl, so the user lands back where they were headed.
      return isProtected ? isLoggedIn : true;
    },
  },
} satisfies NextAuthConfig;
