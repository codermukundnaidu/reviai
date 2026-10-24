import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from 'react';
import { Mic, Loader2, X } from 'lucide-react';

const AGENT_ID = 'agent_5401m5pfy3nxezer03ar2rp5926v';
const TAG = 'elevenlabs-convai';
const VoiceContext = createContext({ open: () => {}, loading: false });
let widgetLoader: Promise<void> | undefined;

function loadWidget() {
  if (customElements.get(TAG)) return Promise.resolve();
  if (widgetLoader) return widgetLoader;
  widgetLoader = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    const timeout = window.setTimeout(() => fail(), 20000);
    const fail = () => {
      clearTimeout(timeout);
      script.remove();
      widgetLoader = undefined;
      reject(new Error('Could not load ElevenLabs. Check your connection or content blocker and try again.'));
    };
    script.src = 'https://unpkg.com/@elevenlabs/convai-widget-embed';
    script.async = true;
    script.onerror = fail;
    script.onload = () => {
      customElements.whenDefined(TAG).then(() => {
        clearTimeout(timeout);
        resolve();
      });
    };
    document.head.appendChild(script);
  });
  return widgetLoader;
}

export function VoiceAgentProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const open = async () => {
    if (loading) return;
    setLoading(true);
    setError(false);
    setNotice('Loading ElevenLabs voice…');
    try {
      await loadWidget();
      setVisible(true);
      setExpanded(false);
      setNotice('Use the ElevenLabs panel to start or end a call. Allow microphone access when prompted. Voice conversations are separate from saved project chat.');
    } catch (e) {
      setError(true);
      setNotice(e instanceof Error ? e.message : 'Could not load ElevenLabs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && !expanded) {
      const frame = requestAnimationFrame(() => setExpanded(true));
      return () => cancelAnimationFrame(frame);
    }
    return undefined;
  }, [visible, expanded]);

  return (
    <VoiceContext.Provider value={{ open, loading }}>
      {children}
      {notice && (
        <div role={error ? 'alert' : 'status'} className="fixed z-[100] left-4 right-4 top-20 md:left-auto md:top-5 md:w-96 rounded-2xl border bg-card p-4 shadow-lg text-sm">
          <button aria-label="Dismiss voice notice" className="float-right ml-2 p-1" onClick={() => setNotice('')}><X className="size-4" /></button>
          <p>{notice}</p>
          {error && <button onClick={open} className="mt-2 underline">Retry loading voice</button>}
        </div>
      )}
      {visible && createElement(TAG, {
        'agent-id': AGENT_ID,
        variant: expanded ? 'expanded' : 'compact',
        dismissible: 'true',
        'action-text': 'Talk to BuildBuddy',
        'start-call-text': 'Start voice call',
        'end-call-text': 'End call',
        'avatar-orb-color-1': '#6B8D70',
        'avatar-orb-color-2': '#E8EDE6',
      })}
    </VoiceContext.Provider>
  );
}

export function VoiceButton() {
  const { open, loading } = useContext(VoiceContext);
  return (
    <button type="button" onClick={open} disabled={loading} title="Open ElevenLabs voice agent"
      data-testid="button-voice" className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs text-primary hover:bg-muted disabled:opacity-60">
      {loading ? <Loader2 className="size-4 animate-spin" /> : <Mic className="size-4" />}
      {loading ? 'Loading voice…' : 'Talk with voice'}
    </button>
  );
}
