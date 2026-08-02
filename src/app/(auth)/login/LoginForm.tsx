'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { loginSchema, type LoginValues } from '@/lib/validation/auth';

/*
 * Client bundles only receive NEXT_PUBLIC_* variables, so this is a separate
 * switch from the server's AUTH_DEBUG. Inlined at build time — flipping it in
 * Vercel requires a redeploy.
 */
const DEBUG = process.env.NEXT_PUBLIC_AUTH_DEBUG === '1';

/*
 * Module scope, not inline in the handler: `react-hooks/purity` rejects a
 * `Date.now()` call written inside a component body, even in an async event
 * handler where it is harmless.
 */
function stopwatch(): () => number {
  const started = Date.now();
  return () => Date.now() - started;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: LoginValues) {
    setFormError(null);

    // redirect:false so a failure re-renders this form with a message instead of
    // bouncing to Auth.js's default error page.
    const elapsedMs = stopwatch();
    const result = await signIn('credentials', { ...values, redirect: false });
    const elapsed = elapsedMs();

    if (DEBUG) {
      /*
       * The error code is the diagnosis, and it is already in the response — the
       * generic message below is what hides it:
       *   "CredentialsSignin" → authorize() returned null: wrong password, no
       *                         such account, or rate-limited.
       *   "Configuration"     → authorize() threw, or AUTH_SECRET is missing.
       *                         An unreachable database lands here, ~10s in.
       * Elapsed time separates those two: a 10s wait is the Mongo server
       * selection timeout from db.ts.
       */
      console.log('[debug:login] signIn result', { ...result, elapsedMs: elapsed });
    }

    if (!result || result.error) {
      /*
       * Deliberately vague. The server cannot distinguish "no such account" from
       * "wrong password" in its response without telling an attacker which email
       * addresses are registered — so neither can this message.
       *
       * The appended code is safe to show: it reports how the request failed,
       * never whether the account exists. Both null-return paths share one code.
       */
      setFormError(
        DEBUG
          ? `Incorrect email or password. [${result?.error ?? 'no response'} · ${elapsed}ms]`
          : 'Incorrect email or password.',
      );
      return;
    }

    // Honour where the user was originally headed, but only for same-site paths:
    // an attacker-supplied absolute URL here would be an open redirect.
    const callbackUrl = searchParams.get('callbackUrl');
    const destination =
      callbackUrl && callbackUrl.startsWith('/') && !callbackUrl.startsWith('//')
        ? callbackUrl
        : '/dashboard';

    router.push(destination);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Field label="Email" htmlFor="email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          autoFocus
          placeholder="you@example.com"
          invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'email-error' : undefined}
          {...register('email')}
        />
      </Field>

      <Field label="Password" htmlFor="password" error={errors.password?.message}>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? 'password-error' : undefined}
          {...register('password')}
        />
      </Field>

      {formError && (
        <div
          role="alert"
          className="border-danger/40 bg-danger/10 text-danger rounded-md border px-3 py-2 text-sm"
        >
          {formError}
        </div>
      )}

      <Button type="submit" loading={isSubmitting} className="w-full">
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
