'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Input';
import { loginSchema, type LoginValues } from '@/lib/validation/auth';

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
    const result = await signIn('credentials', { ...values, redirect: false });

    if (!result || result.error) {
      /*
       * Deliberately vague. The server cannot distinguish "no such account" from
       * "wrong password" in its response without telling an attacker which email
       * addresses are registered — so neither can this message.
       */
      setFormError('Incorrect email or password.');
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
