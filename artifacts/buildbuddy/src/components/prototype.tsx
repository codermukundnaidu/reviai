import { useState } from 'react';
import { Plus, Check, Trash2 } from 'lucide-react';
import type { Prototype } from '@workspace/api-client-react';
import { useLocalState } from '@/lib/bb';

type Entry = { id: string; text: string; done: boolean };
const seed = (items: string[]): Entry[] => items.map((t, i) => ({ id: `s${i}`, text: t, done: false }));
const inp = 'w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/30';

function ListProto({ pid, p, tracker }: { pid: string; p: Prototype; tracker: boolean }) {
  const [list, setList] = useLocalState<Entry[]>(`bb-proto-${pid}-${p.kind}`, seed(p.items));
  const [t, setT] = useState('');
  const add = () => {
    const x = t.trim();
    if (!x) return;
    setList([...list, { id: `u${Date.now()}`, text: x, done: false }]);
    setT('');
  };
  const done = list.filter((l) => l.done).length;
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
        <span data-testid="text-proto-progress">{done} of {list.length} {tracker ? 'logged' : 'checked'}</span>
        <span>Saved in this browser</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted mb-4 overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${list.length ? (done / list.length) * 100 : 0}%` }} />
      </div>
      <ul className="space-y-2 mb-4">
        {list.map((l) => (
          <li key={l.id} className="flex items-center gap-3 rounded-xl border bg-card px-3.5 py-2.5">
            <button onClick={() => setList(list.map((x) => (x.id === l.id ? { ...x, done: !x.done } : x)))}
              data-testid={`button-toggle-${l.id}`} aria-label="Toggle"
              className={`size-5 rounded-md border grid place-items-center shrink-0 ${l.done ? 'bg-primary border-primary text-primary-foreground' : 'border-input'}`}>
              {l.done && <Check className="size-3.5" />}
            </button>
            <span className={`flex-1 text-sm ${l.done ? 'line-through text-muted-foreground' : ''}`}>{l.text}</span>
            <button onClick={() => setList(list.filter((x) => x.id !== l.id))} aria-label="Remove" data-testid={`button-remove-${l.id}`} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="text-sm text-muted-foreground rounded-xl border border-dashed p-4 text-center">Nothing here yet. Add the first one below.</li>}
      </ul>
      <div className="flex gap-2">
        <input className={inp} value={t} onChange={(e) => setT(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder={tracker ? 'Add an entry' : 'Add an item'} data-testid="input-proto-add" />
        <button onClick={add} data-testid="button-proto-add" className="rounded-xl bg-primary text-primary-foreground px-4 text-sm flex items-center gap-1.5"><Plus className="size-4" />Add</button>
      </div>
    </div>
  );
}

function Calc({ pid, p }: { pid: string; p: Prototype }) {
  const [vals, setVals] = useLocalState<Record<string, string>>(`bb-proto-${pid}-calc`, {});
  const nums = p.items.map((i) => parseFloat(vals[i] ?? ''));
  const filled = nums.filter((n) => Number.isFinite(n));
  const total = filled.reduce((a, b) => a + b, 0);
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 mb-4">
        {p.items.map((i, k) => (
          <label key={i + k} className="block text-sm">
            <span className="block mb-1.5 text-muted-foreground">{i}</span>
            <input type="number" inputMode="decimal" className={inp} value={vals[i] ?? ''} onChange={(e) => setVals({ ...vals, [i]: e.target.value })} data-testid={`input-calc-${k}`} />
          </label>
        ))}
      </div>
      <div className="rounded-2xl bg-sidebar text-sidebar-foreground p-5">
        <div className="text-xs uppercase tracking-wider text-sidebar-foreground/60 mb-1">Total of all inputs</div>
        <div className="font-display text-4xl font-bold" data-testid="text-calc-result">{filled.length ? +total.toFixed(4) : '—'}</div>
        {filled.length > 0 && <div className="text-xs text-sidebar-foreground/60 mt-1">Average {+(total / filled.length).toFixed(4)} across {filled.length} value{filled.length > 1 ? 's' : ''}</div>}
      </div>
    </div>
  );
}

function Info({ p }: { p: Prototype }) {
  const [i, setI] = useState(0);
  const secs = p.items.map((x) => {
    const c = x.indexOf(':');
    return c > 0 && c < 60 ? { t: x.slice(0, c).trim(), b: x.slice(c + 1).trim() } : { t: x, b: '' };
  });
  if (!secs.length) return <p className="text-sm text-muted-foreground">No sections were returned.</p>;
  const cur = secs[Math.min(i, secs.length - 1)];
  return (
    <div className="grid sm:grid-cols-[12rem_1fr] gap-4">
      <div className="flex sm:flex-col gap-1 overflow-x-auto">
        {secs.map((s, k) => (
          <button key={k} onClick={() => setI(k)} data-testid={`button-info-${k}`}
            className={`text-left text-sm rounded-xl px-3 py-2 whitespace-nowrap sm:whitespace-normal ${k === i ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground hover:bg-muted'}`}>{s.t}</button>
        ))}
      </div>
      <div className="rounded-2xl border bg-card p-5 bb-in" key={i}>
        <h4 className="font-display font-bold text-lg mb-2">{cur.t}</h4>
        <p className="text-sm leading-relaxed text-foreground/80">{cur.b || 'This section has a title only.'}</p>
        <div className="flex gap-2 mt-5">
          <button disabled={i === 0} onClick={() => setI(i - 1)} className="rounded-lg border px-3 py-1.5 text-xs disabled:opacity-40" data-testid="button-info-prev">Previous</button>
          <button disabled={i >= secs.length - 1} onClick={() => setI(i + 1)} className="rounded-lg border px-3 py-1.5 text-xs disabled:opacity-40" data-testid="button-info-next">Next</button>
        </div>
      </div>
    </div>
  );
}

export function PrototypeView({ projectId, prototype: p }: { projectId: string; prototype: Prototype }) {
  return (
    <div className="rounded-3xl border bg-secondary/50 p-4 sm:p-6">
      <div className="mb-5">
        <div className="text-xs font-mono uppercase tracking-wider text-primary mb-1">{p.kind} prototype</div>
        <h3 className="font-display font-bold text-2xl">{p.title}</h3>
        <p className="text-sm text-muted-foreground mt-1">{p.description}</p>
      </div>
      {p.kind === 'tracker' && <ListProto key={JSON.stringify(p)} pid={`${projectId}-${encodeURIComponent(JSON.stringify(p.items))}`} p={p} tracker />}
      {p.kind === 'checklist' && <ListProto key={JSON.stringify(p)} pid={`${projectId}-${encodeURIComponent(JSON.stringify(p.items))}`} p={p} tracker={false} />}
      {p.kind === 'calculator' && <Calc key={JSON.stringify(p)} pid={`${projectId}-${encodeURIComponent(JSON.stringify(p.items))}`} p={p} />}
      {p.kind === 'information' && <Info key={JSON.stringify(p)} p={p} />}
    </div>
  );
}
