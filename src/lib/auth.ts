import bcrypt from 'bcryptjs';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { User } from '@/models/User';
import { authConfig } from './auth.config';
import { connectToDatabase } from './db';
import { checkRateLimit } from './rate-limit';
import { loginSchema } from './validation/auth';

/** Failed attempts allowed against a single account before it is throttled. */
const LOGIN_ACCOUNT_LIMIT = 5;
/** Higher, because a NAT or office egress legitimately shares one address. */
const LOGIN_IP_LIMIT = 20;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

/*
 * A real bcrypt digest of a random string. When no account matches the submitted
 * email we still run a comparison against this, so a non-existent account takes
 * the same time as a wrong password. Without it, response timing tells an
 * attacker which email addresses are registered.
 */
const DUMMY_HASH = '$2b$12$qkzIil.iZZvhZ.zr5jYbLOrz3l6Rm.hxPGKk45J38ehoPw3BlvTni';

/** Caller's address, or null when no proxy identified one. */
function clientIp(request: Request | undefined): string | null {
  const forwarded = request?.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return request?.headers.get('x-real-ip') ?? null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },

      async authorize(credentials, request) {
        const parsed = loginSchema.safeParse(credentials);
        // Returning null is the only signal Auth.js accepts; every failure path
        // below is deliberately indistinguishable to the caller.
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        /*
         * Throttle per account first, and per IP only when one is identifiable.
         * Keying on IP alone would collapse to a single shared bucket whenever
         * nothing sets a forwarding header — running without a proxy, or in
         * local dev — so five bad guesses would lock out every user at once.
         * Keying on the account is also the protection that actually matters:
         * it is what makes brute-forcing one password infeasible.
         */
        const byAccount = checkRateLimit(
          `login:acct:${email}`,
          LOGIN_ACCOUNT_LIMIT,
          LOGIN_WINDOW_MS,
        );
        if (!byAccount.allowed) return null;

        const ip = clientIp(request);
        if (ip) {
          const byIp = checkRateLimit(`login:ip:${ip}`, LOGIN_IP_LIMIT, LOGIN_WINDOW_MS);
          if (!byIp.allowed) return null;
        }

        await connectToDatabase();

        const user = await User.findOne({ email }).select('+passwordHash');

        if (!user) {
          await bcrypt.compare(password, DUMMY_HASH);
          return null;
        }

        const matches = await bcrypt.compare(password, user.passwordHash);
        if (!matches) return null;

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
});
