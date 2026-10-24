import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetProjectQueryKey, getListProjectsQueryKey, type Project, type BuildEvent } from '@workspace/api-client-react';

export type ConnState = 'connecting' | 'live' | 'reconnecting' | 'unsupported';

const NAMED = ['plan_ready', 'approval_required', 'build_started', 'file_changed', 'preview_ready', 'test_started', 'test_passed', 'test_failed', 'build_completed', 'build_failed'];

/** Subscribes to the server event stream and writes real data into the query cache. */
export function useProjectEvents(id: string): ConnState {
  const qc = useQueryClient();
  const [state, setState] = useState<ConnState>('connecting');

  useEffect(() => {
    if (!id) return;
    if (typeof EventSource === 'undefined') { setState('unsupported'); return; }
    setState('connecting');
    const es = new EventSource(`/api/projects/${encodeURIComponent(id)}/events`, { withCredentials: true });
    const key = getGetProjectQueryKey(id);
    es.onopen = () => setState('live');
    es.onerror = () => setState(es.readyState === EventSource.CLOSED ? 'reconnecting' : 'reconnecting');
    es.addEventListener('snapshot', (e) => {
      try {
        qc.setQueryData(key, JSON.parse((e as MessageEvent).data) as Project);
        qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        setState('live');
      } catch { /* ignore malformed frame */ }
    });
    const onEvent = (e: Event) => {
      let ev: BuildEvent | null = null;
      try { ev = JSON.parse((e as MessageEvent).data) as BuildEvent; } catch { /* ignore */ }
      if (ev) {
        const bev = ev;
        qc.setQueryData<Project | undefined>(key, (old) =>
          old && !(old.events ?? []).some((x) => x.id === bev.id) ? { ...old, events: [...(old.events ?? []), bev] } : old);
      }
      // authoritative state comes from the server, so refetch the project
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
    };
    NAMED.forEach((n) => es.addEventListener(n, onEvent));
    return () => es.close();
  }, [id, qc]);

  return state;
}
