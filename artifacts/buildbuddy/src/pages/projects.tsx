import { Link } from 'wouter';
import { formatDistanceToNow } from 'date-fns';
import { useListProjects } from '@workspace/api-client-react';
import { ArrowRight } from 'lucide-react';

export const statusStyle: Record<string, string> = {
  discovering: 'bg-muted text-foreground',
  'awaiting-approval': 'bg-amber-100 text-amber-900',
  building: 'bg-accent text-accent-foreground',
  ready: 'bg-primary text-primary-foreground',
  failed: 'bg-destructive text-destructive-foreground',
};

export default function Projects() {
  const { data, isLoading, isError, refetch } = useListProjects();
  return (
    <div className="max-w-3xl mx-auto px-5 py-10 md:py-14">
      <h1 className="font-display font-bold text-3xl mb-1">Projects</h1>
      <p className="text-sm text-muted-foreground mb-8">Everything started in this browser.</p>
      {isLoading && <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)}</div>}
      {isError && (
        <div className="rounded-2xl border border-destructive/40 p-5 text-sm" data-testid="text-error">
          Could not load your projects. <button className="underline" onClick={() => refetch()} data-testid="button-retry">Retry</button>
        </div>
      )}
      {data && data.length === 0 && (
        <div className="rounded-3xl border border-dashed p-10 text-center" data-testid="text-empty">
          <p className="font-display font-bold text-xl mb-1">No projects yet</p>
          <p className="text-sm text-muted-foreground mb-4">Tell me what you want to get done and the first one will appear here.</p>
          <Link href="/" className="inline-block rounded-full bg-primary text-primary-foreground px-5 py-2 text-sm" data-testid="link-start">Start one</Link>
        </div>
      )}
      <ul className="space-y-3">
        {[...(data ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((p) => (
          <li key={p.id}>
            <Link href={`/project/${p.id}`} data-testid={`card-project-${p.id}`} className="group flex items-center gap-4 rounded-2xl border bg-card p-4 hover:border-primary/50 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{p.title || 'Untitled project'}</div>
                <div className="text-xs text-muted-foreground mt-1">{p.level} · updated {formatDistanceToNow(new Date(p.updatedAt), { addSuffix: true })}</div>
              </div>
              <span className={`text-xs rounded-full px-2.5 py-1 ${statusStyle[p.status]}`}>{p.status.replace('-', ' ')}</span>
              <ArrowRight className="size-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
