import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ArrowUp, Check, CircleAlert, Loader2, X } from 'lucide-react';
import { VoiceButton } from '@/components/voice-agent';
import {
  useGetProject, getGetProjectQueryKey, getListProjectsQueryKey, useSendMessage, useApprovePlan, useReviewProject, type Project,
} from '@workspace/api-client-react';
import { PrototypeView } from '@/components/prototype';
import { errMsg, initialKey } from '@/lib/bb';
import { statusStyle } from './projects';
import { useProjectEvents } from '@/hooks/use-project-events';
import { BuildPreview, ConnectionBadge, EventTimeline } from '@/components/build-panel';

const TABS = ['Understanding', 'Plan', 'Activity', 'Preview', 'Review'] as const;
type Tab = (typeof TABS)[number];
const card = 'rounded-2xl border bg-card p-5';

export default function ProjectPage() {
  const { id = '' } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { data: project, isLoading, isError, refetch } = useGetProject(id, { query: { enabled: !!id, queryKey: getGetProjectQueryKey(id), refetchInterval: 20000 } });
  const conn = useProjectEvents(id);
  const send = useSendMessage();
  const approve = useApprovePlan();
  const review = useReviewProject();
  const [tab, setTab] = useState<Tab>('Understanding');
  const [pane, setPane] = useState<'chat' | 'work'>('chat');
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [actErr, setActErr] = useState('');
  const sentInitial = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);

  const apply = (p: Project) => {
    qc.setQueryData(getGetProjectQueryKey(id), p);
    qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
  };

  const doSend = async (content: string, fromDraft: boolean) => {
    setErr('');
    setPending(content);
    if (fromDraft) setDraft('');
    try {
      apply(await send.mutateAsync({ id, data: { content } }));
    } catch (e) {
      setErr(errMsg(e));
      setDraft((d) => d || content);
    } finally {
      setPending(null);
    }
  };
  const sendRef = useRef(doSend);
  sendRef.current = doSend;

  useEffect(() => {
    if (!id || sentInitial.current) return;
    const first = sessionStorage.getItem(initialKey(id));
    if (first) {
      sentInitial.current = true;
      sessionStorage.removeItem(initialKey(id));
      sendRef.current(first, false);
    }
  }, [id]);

  const status = project?.status;
  const prevStatus = useRef(status);
  useEffect(() => {
    if (status && prevStatus.current !== status) {
      if (status === 'awaiting-approval') setTab('Plan');
      if (status === 'building') { setTab('Activity'); setPane('work'); }
      if (status === 'ready') { setTab('Preview'); setPane('work'); }
    }
    prevStatus.current = status;
  }, [status]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [project?.messages.length, pending]);

  if (isLoading) return <div className="p-8 space-y-3 max-w-5xl mx-auto">{[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />)}</div>;
  if (isError || !project) return (
    <div className="max-w-md mx-auto p-10 text-center" data-testid="text-error">
      <p className="font-display font-bold text-xl mb-2">This project could not be loaded</p>
      <p className="text-sm text-muted-foreground mb-4">It may belong to a different browser, or the server is unreachable.</p>
      <button onClick={() => refetch()} className="rounded-full bg-primary text-primary-foreground px-5 py-2 text-sm" data-testid="button-retry">Retry</button>
      <Link href="/projects" className="block mt-3 text-sm underline">Back to projects</Link>
    </div>
  );

  const run = async (fn: () => Promise<Project>) => {
    setActErr('');
    try { apply(await fn()); } catch (e) { setActErr(errMsg(e)); }
  };
  const req = project.requirements;
  const msgs = project.messages;
  const busy = !!pending || project.status === 'building';

  const chat = (
    <section className="flex flex-col min-h-0 h-full">
      <div className="flex-1 overflow-y-auto space-y-4 p-4 sm:p-6" data-testid="list-messages">
        {msgs.length === 0 && !pending && <p className="text-sm text-muted-foreground">Tell me what you want to get done. I will ask questions before suggesting anything.</p>}
        {msgs.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : ''}`} data-testid={`message-${m.id}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${m.role === 'user' ? 'bg-sidebar text-sidebar-foreground rounded-br-md' : 'bg-card border rounded-bl-md'}`}>{m.content}</div>
          </div>
        ))}
        {pending && (
          <>
            {!msgs.some((m) => m.role === 'user' && m.content === pending) && (
              <div className="flex justify-end"><div className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-3 text-sm bg-sidebar/80 text-sidebar-foreground whitespace-pre-wrap">{pending}</div></div>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="status-thinking"><Loader2 className="size-4 animate-spin" />Thinking. This can take a little while.</div>
          </>
        )}
        <div ref={endRef} />
      </div>
      <div className="p-3 sm:p-4 border-t bg-background">
        {err && <p role="alert" data-testid="text-send-error" className="text-sm text-destructive mb-2">
          {err} {/(?:rate[ -]?limit|quota)/i.test(err)
            ? 'Wait for the provider limit to reset before trying again; another immediate request may fail too.'
            : 'Your message is kept below so you can resend.'}
        </p>}
        <div className="rounded-2xl border bg-card p-2 flex items-end gap-2 focus-within:ring-2 focus-within:ring-ring/25">
          <VoiceButton />
          <textarea rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={10000} data-testid="input-message" placeholder="Reply to BuildBuddy"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (draft.trim() && !busy) doSend(draft.trim(), true); } }}
            className="flex-1 resize-none bg-transparent text-sm outline-none py-2" />
          <button disabled={!draft.trim() || busy} onClick={() => doSend(draft.trim(), true)} data-testid="button-send" aria-label="Send"
            className="size-9 rounded-full bg-primary text-primary-foreground grid place-items-center disabled:opacity-40"><ArrowUp className="size-4" /></button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5 px-1">Voice opens the ElevenLabs agent. Voice calls are separate from this saved project chat.</p>
      </div>
    </section>
  );

  const work = (
    <section className="p-4 sm:p-6 overflow-y-auto h-full">
      <div className="flex gap-1 overflow-x-auto mb-5 bg-muted rounded-2xl p-1">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} data-testid={`tab-${t.toLowerCase()}`}
            className={`flex-1 whitespace-nowrap rounded-xl px-3 py-1.5 text-sm transition-colors ${tab === t ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground'}`}>{t}</button>
        ))}
      </div>
      {actErr && <p role="alert" data-testid="text-action-error" className="text-sm text-destructive mb-3">{actErr}</p>}
      <div className="bb-in space-y-4" key={tab}>
        {tab === 'Understanding' && (
          <>
            {!req.goal ? (
              <div className={`${card} border-dashed text-sm text-muted-foreground`}>Nothing understood yet. Once you describe what you want, the goal, audience and constraints I pick up will appear here.</div>
            ) : (
              <div className={card}>
                <div className="text-xs font-mono uppercase tracking-wider text-primary mb-1">Goal</div>
                <p className="font-display text-xl font-bold mb-4" data-testid="text-goal">{req.goal}</p>
                <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">Audience</div>
                <p className="text-sm mb-4">{req.audience || 'Not clear yet.'}</p>
                <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">Constraints</div>
                {req.constraints.length ? <ul className="text-sm list-disc pl-5 space-y-1">{req.constraints.map((c, i) => <li key={i}>{c}</li>)}</ul> : <p className="text-sm">None mentioned.</p>}
              </div>
            )}
            {req.questions.length > 0 && (
              <div className={card}>
                <div className="font-medium mb-2 text-sm">Still open</div>
                <ul className="space-y-2 text-sm">{req.questions.map((q, i) => <li key={i} className="flex gap-2"><CircleAlert className="size-4 mt-0.5 text-primary shrink-0" />{q}</li>)}</ul>
              </div>
            )}
          </>
        )}
        {tab === 'Plan' && (project.plan ? (
          <div className={card}>
            <div className="text-xs font-mono uppercase tracking-wider text-primary mb-1">{project.plan.kind} prototype</div>
            <h3 className="font-display font-bold text-2xl mb-2" data-testid="text-plan-title">{project.plan.title}</h3>
            <p className="text-sm text-muted-foreground mb-4">{project.plan.rationale}</p>
            <ol className="space-y-2 mb-5">{project.plan.steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm"><span className="size-6 rounded-full bg-accent text-accent-foreground grid place-items-center text-xs shrink-0">{i + 1}</span>{s}</li>))}</ol>
            <p className="text-xs text-muted-foreground mb-4">A complete plan automatically starts Revi's controlled build. Revi currently builds a bakery order tracker from a fixed template, with orders saved in a database. This does not publish or deploy the app; AgenticOrg may still pause its own run for review.</p>
            {project.status === 'failed' && project.plan ? (
              <button onClick={() => run(() => approve.mutateAsync({ id }))} disabled={approve.isPending} data-testid="button-retry-build"
                className="rounded-full bg-primary text-primary-foreground px-6 py-2.5 text-sm font-medium flex items-center gap-2 disabled:opacity-60">
                {approve.isPending && <Loader2 className="size-4 animate-spin" />}Retry build</button>
            ) : <p className="text-sm font-medium" data-testid="text-plan-state">{project.status === 'building' ? 'Plan validated. Building automatically.' : project.status === 'ready' ? 'Build complete. Review the preview and checks.' : project.status === 'awaiting-approval' ? 'Starting the automatic build…' : 'Plan recorded.'}</p>}
          </div>
        ) : <div className={`${card} border-dashed text-sm text-muted-foreground`}>No plan yet. I only build after AgenticOrg returns a complete, valid plan; AgenticOrg may pause a run for its own review.</div>)}
        {tab === 'Activity' && <EventTimeline events={project.events ?? []} />}
        {tab === 'Activity' && (project.activities.length ? (
          <ol className="space-y-3">{project.activities.map((a) => (
            <li key={a.id} className={`${card} flex gap-3`} data-testid={`activity-${a.id}`}>
              <span className="mt-0.5 shrink-0">{a.status === 'running' ? <Loader2 className="size-4 animate-spin text-primary" /> : a.status === 'completed' ? <Check className="size-4 text-primary" /> : a.status === 'failed' ? <X className="size-4 text-destructive" /> : <CircleAlert className="size-4 text-amber-700" />}</span>
              <div className="min-w-0"><div className="text-sm font-medium">{a.title} <span className="text-xs font-normal text-muted-foreground">{a.status.replace('-', ' ')}</span></div>
                <p className="text-sm text-muted-foreground">{a.detail}</p>
                <p className="text-xs text-muted-foreground/70 mt-1">{formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}</p></div>
            </li>))}</ol>
        ) : <div className={`${card} border-dashed text-sm text-muted-foreground`}>No activity yet. Real steps show up here as they happen.</div>)}
        {tab === 'Preview' && (project.build ? <BuildPreview projectId={project.id} build={project.build} /> : project.prototype ? <PrototypeView projectId={project.id} prototype={project.prototype} />
          : <div className={`${card} border-dashed text-sm text-muted-foreground`}>{project.status === 'building' ? <span className="flex items-center gap-2"><Loader2 className="size-4 animate-spin" />Building your prototype...</span> : 'No prototype yet. A complete, validated plan starts the build automatically.'}</div>)}
        {tab === 'Review' && (
          <div className={card}>
            {!project.reviewApproved && project.activities.some(a => a.title === 'Changes requested') && <p className="text-sm font-medium mb-3">Changes requested. Continue the conversation to explain what should change.</p>}
            {project.tests.length ? (
              <>
                <p className="text-xs text-muted-foreground mb-3">These checks are run by the server on the generated files. They are not browser tests, and no browser checks have been recorded.</p>
                <ul className="space-y-2 mb-5">{project.tests.map((t, i) => (
                  <li key={i} className="flex gap-3 text-sm" data-testid={`test-${i}`}>
                    {t.passed ? <Check className="size-4 mt-0.5 text-primary shrink-0" /> : <X className="size-4 mt-0.5 text-destructive shrink-0" />}
                    <div><div className="font-medium">{t.name}</div><div className="text-muted-foreground">{t.detail}</div></div></li>))}</ul>
              </>
            ) : <p className="text-sm text-muted-foreground mb-4">No checks have run yet. They appear after a build finishes.</p>}
            {project.reviewApproved ? <p className="text-sm font-medium text-primary" data-testid="text-accepted">You accepted this prototype.</p>
              : project.status === 'ready' ? (
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => run(() => review.mutateAsync({ id, data: { approved: true } }))} disabled={review.isPending} data-testid="button-accept" className="rounded-full bg-primary text-primary-foreground px-5 py-2 text-sm disabled:opacity-60">Accept</button>
                  <button onClick={() => run(() => review.mutateAsync({ id, data: { approved: false } }))} disabled={review.isPending} data-testid="button-reject" className="rounded-full border px-5 py-2 text-sm disabled:opacity-60">Reject</button>
                </div>
              ) : <p className="text-sm text-muted-foreground">Review opens when the prototype is ready.</p>}
          </div>
        )}
      </div>
    </section>
  );

  return (
    <div className="h-[calc(100dvh-57px)] md:h-[100dvh] flex flex-col">
      <header className="px-4 sm:px-6 py-3 border-b flex items-center gap-3">
        <h1 className="font-display font-bold text-lg truncate flex-1" data-testid="text-project-title">{project.title || 'New project'}</h1>
        <span className="hidden sm:inline"><ConnectionBadge state={conn} /></span>
        <span className="text-xs text-muted-foreground hidden sm:inline">{project.level}</span>
        <span className={`text-xs rounded-full px-2.5 py-1 ${statusStyle[project.status]}`} data-testid="status-project">{project.status.replace('-', ' ')}</span>
      </header>
      {project.status === 'failed' && <div className="px-6 py-2 text-sm bg-destructive/10 text-destructive" data-testid="text-failed">The build failed. Check Activity for details, or send a message to adjust the plan.</div>}
      <div className="md:hidden flex p-2 gap-1 border-b">
        {(['chat', 'work'] as const).map((p) => <button key={p} onClick={() => setPane(p)} data-testid={`button-pane-${p}`} className={`flex-1 rounded-xl py-1.5 text-sm ${pane === p ? 'bg-sidebar text-sidebar-foreground' : 'text-muted-foreground'}`}>{p === 'chat' ? 'Conversation' : 'Workspace'}</button>)}
      </div>
      <div className="flex-1 min-h-0 md:grid md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className={`${pane === 'chat' ? 'block' : 'hidden'} md:block h-full min-h-0 md:border-r`}>{chat}</div>
        <div className={`${pane === 'work' ? 'block' : 'hidden'} md:block h-full min-h-0`}>{work}</div>
      </div>
    </div>
  );
}
