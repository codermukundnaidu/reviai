import { useEffect, useState } from 'react';

export const LEVELS = [
  { id: 'Beginner', blurb: 'Plain words, no jargon. I explain everything.' },
  { id: 'Intermediate', blurb: 'Some technical terms are fine. Fewer explanations.' },
  { id: 'Advanced', blurb: 'Concise, technical. Shows reasoning and trade-offs.' },
  { id: 'Pro', blurb: 'Terse and direct. Assumes you know the territory.' },
] as const;
export type Level = (typeof LEVELS)[number]['id'];

const LK = 'bb-level';
export function getLevel(): Level {
  const v = localStorage.getItem(LK);
  return (LEVELS.find((l) => l.id === v)?.id ?? 'Beginner') as Level;
}
export function setLevel(l: Level) {
  localStorage.setItem(LK, l);
}

export function useLocalState<T>(key: string, initial: T) {
  const [v, setV] = useState<T>(() => {
    try {
      const r = localStorage.getItem(key);
      return r ? (JSON.parse(r) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {
      /* storage unavailable */
    }
  }, [key, v]);
  return [v, setV] as const;
}

export const initialKey = (id: string) => `bb-initial-${id}`;
export function errMsg(e: unknown): string {
  const x = e as { message?: string; data?: { error?: string } } | undefined;
  return x?.data?.error || x?.message || 'Something went wrong. Please try again.';
}
