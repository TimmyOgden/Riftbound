import React, { useEffect, useRef, useState } from 'react';
import type { PracticeEvent, PracticeView } from '../../../packages/game-engine/src/practice.ts';
import { CardArt } from './CardArt.tsx';

export function useBattleEvents(view?: PracticeView, paused = false, skipped?: number) {
  const last = useRef({ matchId: '', id: 0 });
  const [events, setEvents] = useState<PracticeEvent[]>([]);
  useEffect(() => {
    if (!view || paused) { setEvents([]); return; }
    if (last.current.matchId !== view.matchId) last.current = { matchId: view.matchId, id: 0 };
    const fresh = view.events.filter(e => e.id > last.current.id && (view.revision !== skipped || e.type === 'turn' && e.player === 0));
    last.current.id = view.nextEvent - 1;
    if (!fresh.length) { setEvents([]); return; }
    setEvents(fresh);
    const timer = window.setTimeout(() => setEvents([]), 3400);
    return () => window.clearTimeout(timer);
  }, [view?.nextEvent, view?.matchId, paused, skipped]);
  return events;
}
export function BattleEffects({ events }: { events: PracticeEvent[] }) {
  const cards = events.filter(e => e.cardId && ['activate', 'kill'].includes(e.type)).slice(-3);
  return <div className="battle-effects" aria-hidden="true">
    {cards.map((e, i) => <div key={e.id} className={`effect-card effect-${e.type} effect-player-${e.player}`} style={{ '--effect-offset': `${(i - (cards.length - 1) / 2) * 110}px`, animationDelay: `${i * 160}ms` } as React.CSSProperties}><CardArt cardId={e.cardId!} /><span>{e.type === 'kill' ? 'DEFEATED' : e.type === 'activate' ? 'ABILITY' : 'PLAYED'}</span></div>)}
    {events.some(e => e.type === 'turn' && e.player === 0) && <div className="turn-flourish">YOUR TURN<small>Ready your next move</small></div>}
  </div>;
}
export function BattleFeed({ events }: { events: PracticeEvent[] }) {
  return <div className="battle-feed" role="status" aria-live="polite" aria-atomic="true">{events.slice(-3).map(e => <span key={e.id} className={`feed-${e.type}`}><i>{e.type === 'score' ? '◆' : e.type === 'combat' ? '⚔' : e.type === 'activate' ? '✧' : '◇'}</i>{e.text}</span>)}</div>;
}
