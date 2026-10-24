import { type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { useClerk, useUser } from '@clerk/react';
import { History, LogOut, Settings, Sparkles } from 'lucide-react';

const nav = [
  { href: '/new', label: 'New project', icon: Sparkles, id: 'new' },
  { href: '/projects', label: 'Projects', icon: History, id: 'projects' },
  { href: '/settings', label: 'Settings', icon: Settings, id: 'settings' },
];

export function Shell({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  const { signOut } = useClerk();
  const { user } = useUser();
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const who = user?.primaryEmailAddress?.emailAddress ?? user?.fullName ?? '';
  return (
    <div className="min-h-[100dvh] md:flex bg-background">
      <aside className="bg-sidebar text-sidebar-foreground md:w-64 md:sticky md:top-0 md:h-[100dvh] md:flex-col flex items-center md:items-stretch justify-between md:justify-start gap-2 px-4 py-3 md:p-5 shrink-0">
        <Link href="/projects" className="flex items-center gap-2.5 md:mb-8" data-testid="link-logo">
          <span className="size-8 rounded-xl bg-sidebar-primary text-sidebar-primary-foreground grid place-items-center font-display font-bold">B</span>
          <span className="font-display font-bold text-lg leading-none">BuildBuddy <span className="text-sidebar-primary">Voice</span></span>
        </Link>
        <nav className="flex md:flex-col gap-1">
          {nav.map((n) => {
            const on = loc.startsWith(n.href);
            return (
              <Link key={n.id} href={n.href} data-testid={`link-nav-${n.id}`}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors ${on ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60'}`}>
                <n.icon className="size-4" />
                <span className="hidden sm:inline">{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="hidden md:block mt-auto space-y-2">
          <p className="text-xs truncate text-sidebar-foreground/70" data-testid="text-user">{who}</p>
          <button type="button" data-testid="button-sign-out" onClick={() => signOut({ redirectUrl: base || '/' })}
            className="flex items-center gap-2 text-xs text-sidebar-foreground/70 hover:text-sidebar-foreground">
            <LogOut className="size-3.5" /> Sign out
          </button>
          <p className="text-xs leading-relaxed text-sidebar-foreground/50">Your projects are private to your account.</p>
        </div>
        <button type="button" aria-label="Sign out" className="md:hidden p-2" onClick={() => signOut({ redirectUrl: base || '/' })}>
          <LogOut className="size-4" />
        </button>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
