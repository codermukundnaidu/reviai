import { format } from 'date-fns';
import { Download, ExternalLink, Loader2, CircleAlert } from 'lucide-react';
import type { BuildArtifact, BuildEvent } from '@workspace/api-client-react';
import type { ConnState } from '@/hooks/use-project-events';

const card = 'rounded-2xl border bg-card p-5';
const connLabel: Record<ConnState, string> = {
  connecting: 'Connecting to live events', live: 'Live events connected', reconnecting: 'Reconnecting. Checking for updates periodically.', unsupported: 'Live events unavailable. Checking periodically.',
};

export function ConnectionBadge({ state }: { state: ConnState }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground" data-testid="status-connection" role="status">
      <span className={`size-2 rounded-full ${state === 'live' ? 'bg-primary' : 'bg-amber-600'}`} />{connLabel[state]}
    </span>
  );
}

export function BuildPreview({ projectId, build }: { projectId: string; build: BuildArtifact }) {
  const dl = (n: string) => `/api/projects/${projectId}/builds/${build.id}/files/${n}?download=1`;
  if (build.status === 'building') return <div className={`${card} border-dashed text-sm text-muted-foreground flex items-center gap-2`}><Loader2 className="size-4 animate-spin" />Build in progress. The preview appears when the server finishes it.</div>;
  if (build.status === 'failed') return <div className={`${card} text-sm text-destructive flex gap-2`} data-testid="text-build-failed"><CircleAlert className="size-4 mt-0.5 shrink-0" />This build failed. See the timeline in Activity.</div>;
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border overflow-hidden bg-card">
        {build.previewUrl
          ? <iframe title="Generated bakery order tracker" src={build.previewUrl} sandbox="allow-scripts allow-same-origin allow-forms" className="w-full h-[520px] bg-background" data-testid="frame-preview" />
          : <p className="p-5 text-sm text-muted-foreground">The build is ready but the server did not provide a preview address.</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {build.previewUrl && <a href={build.previewUrl} target="_blank" rel="noopener noreferrer" data-testid="link-open-preview" className="rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm inline-flex items-center gap-2"><ExternalLink className="size-4" />Open preview</a>}
      </div>
      <div className={card}>
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Generated source files</div>
        <ul className="space-y-2">{build.files.map((f) => (
          <li key={f.name} className="flex items-center gap-3 text-sm" data-testid={`file-${f.name}`}>
            <div className="min-w-0 flex-1"><div className="font-mono">{f.name}</div><div className="text-xs text-muted-foreground truncate">{f.bytes} bytes, sha256 {f.sha256.slice(0, 12)}</div></div>
            <a href={dl(f.name)} download data-testid={`link-download-${f.name}`} className="rounded-full border px-3 py-1.5 text-xs inline-flex items-center gap-1.5"><Download className="size-3.5" />Download</a>
          </li>))}</ul>
        <p className="text-xs text-muted-foreground mt-3">This is a fixed bakery order tracker template written by the server, not model-written code. Orders are stored in the database.</p>
      </div>
    </div>
  );
}

export function EventTimeline({ events }: { events: BuildEvent[] }) {
  if (!events.length) return null;
  return (
    <div className={card} data-testid="list-events">
      <div className="text-xs font-mono uppercase tracking-wider text-primary mb-3">Build timeline (server events)</div>
      <ol className="space-y-3">{events.map((e) => (
        <li key={e.id} className="text-sm" data-testid={`event-${e.id}`}>
          <div className="flex gap-2 items-baseline"><span className="font-mono text-xs">{e.type.replace(/_/g, ' ')}</span><span className="text-[11px] text-muted-foreground">{format(new Date(e.createdAt), 'HH:mm:ss')}</span></div>
          <p className="text-muted-foreground">{e.detail}</p>
        </li>))}</ol>
    </div>
  );
}
