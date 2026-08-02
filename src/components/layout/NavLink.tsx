'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isActivePath, type NavItem } from './nav-items';
import { cn } from '@/lib/utils';

type NavLinkProps = {
  item: NavItem;
  /** Hide the text label at the icon-rail breakpoint. */
  collapsible?: boolean;
  onNavigate?: () => void;
};

export function NavLink({ item, collapsible = false, onNavigate }: NavLinkProps) {
  const pathname = usePathname();
  const active = isActivePath(pathname, item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      // Screen readers announce the current page; colour alone is not enough.
      aria-current={active ? 'page' : undefined}
      title={collapsible ? item.label : undefined}
      className={cn(
        'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        'focus-visible:ring-ring focus-visible:ring-offset-background outline-none',
        'focus-visible:ring-2 focus-visible:ring-offset-2',
        active
          ? 'bg-primary/10 text-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        collapsible && 'md:justify-center lg:justify-start',
      )}
    >
      {/* Accent bar makes the active item legible even in the icon-only rail. */}
      {active && <span className="bg-primary absolute inset-y-1 left-0 w-0.5 rounded-full" />}
      <Icon className="size-5 shrink-0" aria-hidden />
      <span className={cn(collapsible && 'md:hidden lg:inline')}>{item.label}</span>
    </Link>
  );
}
