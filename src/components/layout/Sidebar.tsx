import { Brand } from './Brand';
import { NavList } from './NavList';

/**
 * Desktop navigation. Hidden below `md`, an icon-only rail at `md`, and a full
 * labelled sidebar from `lg` up. Below `md` the same links are reached through
 * `MobileNav`'s drawer.
 */
export function Sidebar() {
  return (
    <aside className="bg-card border-border hidden shrink-0 border-r md:flex md:w-16 md:flex-col lg:w-60">
      <div className="border-border flex h-14 items-center border-b px-4">
        <Brand collapsible />
      </div>

      <nav aria-label="Main" className="flex-1 space-y-1 p-2">
        <NavList collapsible />
      </nav>
    </aside>
  );
}
