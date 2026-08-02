import { Brand } from './Brand';
import { MobileNav } from './MobileNav';
import { UserMenu } from './UserMenu';

type TopbarProps = {
  name: string;
  email: string;
  role: string;
};

export function Topbar({ name, email, role }: TopbarProps) {
  return (
    <header className="bg-card/80 border-border sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b px-4 backdrop-blur">
      <MobileNav />
      {/* The sidebar carries the brand from `md` up; below that it is hidden. */}
      <div className="md:hidden">
        <Brand />
      </div>

      <div className="ml-auto">
        <UserMenu name={name} email={email} role={role} />
      </div>
    </header>
  );
}
