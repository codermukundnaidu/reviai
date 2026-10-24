import { useGetIntegrations } from '@workspace/api-client-react';

export default function Settings() {
  const { data, isLoading, isError, refetch } = useGetIntegrations();
  const rows = [
    { id: 'ai', name: 'AgenticOrg planning', on: data?.agenticOrg, yes: 'AgenticOrg is configured for text planning and the voice planning webhook. Each response must pass strict validation. Configuration is not a live health check; no OpenAI planning fallback is used.', no: 'AgenticOrg planning needs a server-only key, planner UUID, and supported instance URL.' },
    { id: 'voice', name: 'ElevenLabs voice', on: data?.voice, yes: 'Public agent linked. Choose Talk with voice, then start a call in the ElevenLabs panel. Microphone permission is required. Calls are separate from saved project chat; this status indicates configuration, not a live call health check.', no: 'Voice agent is not configured.' },
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
                <span className="text-xs font-normal text-muted-foreground" data-testid={`status-${r.id}`}>{isLoading ? 'checking' : r.on ? 'configured' : 'not configured'}</span></div>
              <p className="text-sm text-muted-foreground mt-1">{isLoading ? 'Checking...' : r.on ? r.yes : r.no}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-sidebar text-sidebar-foreground p-6 space-y-3 text-sm leading-relaxed">
        <h2 className="font-display font-bold text-lg">How this is handled</h2>
        <p>AgenticOrg and webhook credentials stay on the server. Revi automatically starts building after AgenticOrg returns a complete plan that passes strict validation. AgenticOrg's own human review is unchanged; pending or invalid provider results never authorize a build.</p>
        <p>A controlled compiler generates real bakery-tracker HTML, CSS and JavaScript, stores the source privately, and runs source/database checks. This setting does not publish or deploy the app. AgenticOrg is the planner, not a coding agent.</p>
        <p>Your projects belong to your account and are private to it. Sign in on any browser to see them. Projects you started before accounts existed are moved into your account the first time you sign in; nothing is deleted.</p>
        <p>The bakery app supports saved orders with add, edit, status changes and delete. Other project kinds still use the older data-only prototypes through OpenAI. Arbitrary model-generated code is never executed.</p>
      </div>
    </div>
  );
}
