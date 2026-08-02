'use client';

import { NavLink } from './NavLink';
import { NAV_ITEMS } from './nav-items';

/*
 * The list is rendered client-side rather than mapped in the server `Sidebar`.
 * Each nav item carries a lucide `icon`, which is a React component — i.e. a
 * function — and functions cannot cross the server→client boundary. Mapping
 * here keeps NAV_ITEMS entirely within client code.
 *
 * This failure does not show up in `next build`: the shell only renders for a
 * signed-in request, so build-time prerendering never reaches it.
 */
export function NavList({
  collapsible = false,
  onNavigate,
}: {
  collapsible?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <>
      {NAV_ITEMS.map((item) => (
        <NavLink key={item.href} item={item} collapsible={collapsible} onNavigate={onNavigate} />
      ))}
    </>
  );
}
