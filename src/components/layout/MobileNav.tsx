'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { Menu, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Brand } from './Brand';
import { NavList } from './NavList';

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [openedAt, setOpenedAt] = useState(pathname);

  /*
   * Close on navigation. The drawer's own links close it via `onNavigate`, but
   * browser back/forward changes the path without one — leaving the drawer open
   * over the new page. Adjusting state during render (rather than in an effect)
   * is React's documented pattern for deriving from a changed input: it
   * re-renders before paint instead of triggering a cascading second render.
   */
  if (openedAt !== pathname) {
    setOpenedAt(pathname);
    setOpen(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        aria-label="Open navigation"
        className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring focus-visible:ring-offset-background inline-flex size-9 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 md:hidden"
      >
        <Menu className="size-5" aria-hidden />
      </Dialog.Trigger>

      <Dialog.Portal>
        {/* Radix handles focus trapping, Escape and scroll locking. */}
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 md:hidden" />
        <Dialog.Content className="bg-card border-border fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r shadow-xl focus:outline-none md:hidden">
          <Dialog.Title className="sr-only">Navigation</Dialog.Title>

          <div className="border-border flex h-14 items-center justify-between border-b px-4">
            <Brand />
            <Dialog.Close
              aria-label="Close navigation"
              className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-8 items-center justify-center rounded-md transition-colors"
            >
              <X className="size-4" aria-hidden />
            </Dialog.Close>
          </div>

          <nav aria-label="Main" className="flex-1 space-y-1 p-2">
            <NavList onNavigate={() => setOpen(false)} />
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
