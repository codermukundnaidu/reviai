import { useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowUp, Loader2, Mic } from 'lucide-react';
import { useCreateProject, getListProjectsQueryKey, type ProjectInputLevel } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { LEVELS, getLevel, setLevel, errMsg, initialKey } from '@/lib/bb';

export default function Home() {
  const [, nav] = useLocation();
  const qc = useQueryClient();
  const create = useCreateProject();
  const [level, setL] = useState(getLevel());
  const [text, setText] = useState('');
  const [err, setErr] = useState('');

  const submit = async () => {
    const content = text.trim();
    if (!content || create.isPending) return;
    setErr('');
    try {
      const p = await create.mutateAsync({ data: { level: level as ProjectInputLevel } });
      sessionStorage.setItem(initialKey(p.id), content);
      qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      nav(`/project/${p.id}`);
    } catch (e) {
      setErr(errMsg(e));
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-5 py-10 md:py-20 bb-in">
      <p className="text-xs font-mono uppercase tracking-widest text-primary mb-4">For people who have never coded</p>
      <h1 className="font-display font-bold text-4xl sm:text-5xl leading-[1.05] mb-4">What are you trying to get done?</h1>
      <p className="text-muted-foreground text-base sm:text-lg mb-8 max-w-xl">
        Describe it however you like. I will ask what I need to understand your real goal before I suggest anything to build.
      </p>

      <div className="mb-3 text-sm font-medium">How much technical detail do you want?</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2" role="radiogroup">
        {LEVELS.map((l) => (
          <button key={l.id} role="radio" aria-checked={level === l.id} data-testid={`button-level-${l.id.toLowerCase()}`}
            onClick={() => { setL(l.id); setLevel(l.id); }}
            className={`rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-colors ${level === l.id ? 'bg-sidebar text-sidebar-foreground border-sidebar' : 'bg-card hover:bg-muted'}`}>
            {l.id}
          </button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground mb-6 min-h-5" data-testid="text-level-blurb">{LEVELS.find((l) => l.id === level)?.blurb}</p>

      <div className="rounded-3xl border bg-card p-3 shadow-sm focus-within:ring-2 focus-within:ring-ring/25">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={10000} data-testid="input-message"
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); }}
          placeholder="For example: I run a small bakery and keep losing track of which orders are paid."
          className="w-full resize-none bg-transparent px-3 py-2 text-base outline-none placeholder:text-muted-foreground/70" />
        <div className="flex items-center justify-between px-1 pt-1">
          <button disabled title="Voice is not connected" data-testid="button-voice" className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs text-muted-foreground opacity-70 cursor-not-allowed">
            <Mic className="size-4" /> Voice not connected
          </button>
          <button onClick={submit} disabled={!text.trim() || create.isPending} data-testid="button-start"
            className="rounded-full bg-primary text-primary-foreground pl-5 pr-4 py-2.5 text-sm font-medium flex items-center gap-2 disabled:opacity-40">
            {create.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Start talking <ArrowUp className="size-4" />
          </button>
        </div>
      </div>
      {err && <p role="alert" data-testid="text-error" className="mt-3 text-sm text-destructive">{err} Your text is still here.</p>}
      <p className="mt-4 text-xs text-muted-foreground">Nothing is created until you press start. Ctrl or Cmd + Enter also sends.</p>
    </div>
  );
}
