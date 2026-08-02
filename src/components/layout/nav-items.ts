import { History, LayoutDashboard, Sparkles, type LucideIcon } from 'lucide-react';

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/** Single source of truth for the sidebar and the mobile drawer. */
export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/results', label: 'Previous Results', icon: History },
  { href: '/predictions', label: 'Predictions', icon: Sparkles },
];

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
