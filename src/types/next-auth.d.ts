import type { DefaultSession } from 'next-auth';
import type { UserRole } from '@/types';

/*
 * Auth.js ships a minimal user shape. The app needs the Mongo id and the role on
 * every session so route handlers can authorise without a second DB round-trip.
 *
 * Note the two different augmentation targets below — this is not arbitrary:
 *
 *   `next-auth` re-exports Session and User by name
 *   (`export type { Session, User } from "@auth/core/types"`), and TypeScript
 *   merges an interface augmentation into a named re-export. So augmenting
 *   `next-auth` reaches the type `NextAuthConfig` actually uses.
 *
 *   `next-auth/jwt` is a bare star re-export (`export * from "@auth/core/jwt"`),
 *   which creates no local declaration to merge with. Augmenting it would define
 *   a *second*, unrelated JWT interface: `import type { JWT } from
 *   'next-auth/jwt'` would look correct while `token` inside the callbacks
 *   stayed `Record<string, unknown>`, making every `token.id` silently
 *   `unknown`. The JWT augmentation therefore targets `@auth/core/jwt` — the
 *   module where the interface is really declared.
 */
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession['user'];
  }

  interface User {
    role: UserRole;
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    id?: string;
    role?: UserRole;
  }
}
