'use client';

import { LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';

type UserMenuProps = {
  email: string;
  name: string;
  role: string;
};

export function UserMenu({ email, name, role }: UserMenuProps) {
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    // Let Auth.js perform the redirect so the session cookie is cleared before
    // the next page loads; a client-side push would race it.
    await signOut({ redirectTo: '/login' });
  }

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-sm leading-tight font-medium">{name}</p>
        <p className="text-muted-foreground text-xs leading-tight">
          {email}
          {role === 'admin' && <span className="text-primary ml-1.5">admin</span>}
        </p>
      </div>

      <Button variant="ghost" size="sm" onClick={handleSignOut} loading={signingOut}>
        <LogOut className="size-4" aria-hidden />
        <span className="sr-only sm:not-sr-only">Sign out</span>
      </Button>
    </div>
  );
}
