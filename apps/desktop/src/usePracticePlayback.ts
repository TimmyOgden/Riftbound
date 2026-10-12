import { useCallback, useEffect, useState } from 'react';
import type { PracticeView } from '../../../packages/game-engine/src/practice.ts';
import type { PracticeReply } from '../../server/src/practice.ts';

type Playback = { view?: PracticeView; queue: PracticeView[]; completed: number; total: number; skipped?: number };
const empty: Playback = { queue: [], completed: 0, total: 0 };
export function usePracticePlayback(opening: boolean, suspended: boolean) {
  const [state, setState] = useState<Playback>(empty);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<'normal' | 'fast'>('normal');
  const accept = useCallback((reply: PracticeReply) => {
    if (!reply.view) return;
    const frames = reply.ok && reply.sequence?.length ? reply.sequence : [reply.view];
    setPaused(false);
    setState({ view: frames[0], queue: frames.slice(1), completed: 0, total: frames.length - 1, skipped: reply.restored ? reply.view.revision : undefined });
  }, []);
  const clear = useCallback(() => { setState(empty); setPaused(false); }, []);
  const skip = useCallback(() => {
    setState(s => ({ ...s, view: s.queue.at(-1) ?? s.view, queue: [], completed: s.total, skipped: (s.queue.at(-1) ?? s.view)?.revision }));
    setPaused(false);
  }, []);
  const step = useCallback(() => setState(s => s.queue.length ? { ...s, view: s.queue[0], queue: s.queue.slice(1), completed: s.completed + 1 } : s), []);
  useEffect(() => {
    if (!state.queue.length || opening || suspended || paused) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(step, speed === 'fast' ? 240 : reduced ? 500 : state.view?.revision === 0 ? 1900 : 1100);
    return () => window.clearTimeout(timer);
  }, [state.queue, opening, suspended, paused, speed, step]);
  return { view: state.view, playing: state.queue.length > 0, completed: state.completed, total: state.total, skipped: state.skipped, accept, clear, skip, step, paused, setPaused, speed, setSpeed };
}
