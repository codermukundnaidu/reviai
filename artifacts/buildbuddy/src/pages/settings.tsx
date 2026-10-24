import { useGetIntegrations } from '@workspace/api-client-react';

export default function Settings() {
  const { data, isLoading, isError, refetch } = useGetIntegrations();
  const rows = [
    { id: 'ai', name: 'AI model', on: data?.ai, yes: 'Connected. Conversation and planning use the real model.', no: 'Not configured on the server. Messages cannot be answered until it is.' },
    { id: 'agenticorg', name: 'AgenticOrg backend', on: data?.agenticOrg, yes: 'Credentials are present on the server. Build activity reflects what the backend reports.', no: 'Not connected. Builds are not delegated to AgenticOrg, and nothing here pretends otherwise.' },
    { id: 'voice', name: 'Voice', on: data?.voice, yes: 'Server reports voice as available, but this interface has no voice controls yet.', no: 'Not connected. Voice is a placeholder: the microphone button is disabled and nothing is recorded.' },
  ];
  return (
    <div className="max-w-3xl mx-auto px-5 py-10 md:py-14">
      <h1 className="font-display font-bold text-3xl mb-1">Settings</h1>
      <p className="text-sm text-muted-foreground mb-8">Integration status, read live from the server.</p>
      {isError && <div className="rounded-2xl border border-destructive/40 p-5 text-sm mb-6" data-testid="text-error">Could not read status. <button className="underline" onClick={() => refetch()}>Retry</button></div>}
      <div className="space-y-3 mb-10">
        {rows.map((r) => (
          <div key={r.id} className="rounded-2xl border bg-card p-5 flex gap-4" data-testid={`card-integration-${r.id}`}>
            <span className={`mt-1.5 size-2.5 rounded-full shrink-0 ${isLoading ? 'bg-muted animate-pulse' : r.on ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
            <div>
              <div className="font-medium flex items-center gap-2">{r.name}
                <span className="text-xs font-normal text-muted-foreground" data-testid={`status-${r.id}`}>{isLoading ? 'checking' : r.on ? 'connected' : 'not connected'}</span></div>
              <p className="text-sm text-muted-foreground mt-1">{isLoading ? 'Checking...' : r.on ? r.yes : r.no}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-sidebar text-sidebar-foreground p-6 space-y-3 text-sm leading-relaxed">
        <h2 className="font-display font-bold text-lg">How this is handled</h2>
        <p>AgenticOrg credentials are configured on the server only. They are never entered, stored or shown in this browser.</p>
        <p>There are no accounts. Your projects are tied to an anonymous cookie in this browser, so clearing it or switching browsers means you will not see them.</p>
        <p>Prototypes come in four safe kinds: tracker, checklist, calculator and information. They are prebuilt screens that only display the data returned to them. Code or HTML written by the model is never run.</p>
      </div>
    </div>
  );
}
