import React, { useLayoutEffect, useRef, useState } from 'react';
import type { PracticeEvent } from '../../../packages/game-engine/src/practice.ts';
import { CardArt, CardBack } from './CardArt.tsx';
type Point = { x: number; y: number };
type Flight = { event: PracticeEvent; from: Point; to: Point; delay: number };
function point(element?: Element | null): Point | undefined {
  if (!element) return;
  const r = element.getBoundingClientRect();
  if (r.width && r.height) return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}
function zone(name: string): Point | undefined { return Array.from(document.querySelectorAll(`[data-zone="${name}"]`)).map(point).find(Boolean); }
export function CardFlights({ events }: { events: PracticeEvent[] }) {
  const previous = useRef(new Map<string, Point>());
  const [flights, setFlights] = useState<Flight[]>([]);
  // Retain source coordinates after a played card leaves the DOM.
  useLayoutEffect(() => {
    document.querySelectorAll<HTMLElement>('[data-hand-card]').forEach(el => { const p = point(el); if (p) previous.current.set(el.dataset.handCard!, p); });
  });
  useLayoutEffect(() => {
    const next = events.filter(e => e.type === 'draw' || e.type === 'play').slice(-18).flatMap((e, i) => {
      const hand = zone(`hand-${e.player}`), deck = zone(`deck-${e.player}`);
      const target = e.unit ? point(document.querySelector(`[data-drop-unit="${e.unit}"]`)) : undefined;
      const destination = e.field !== undefined && e.field >= 0 ? zone(`field-${e.field}`) : zone(`base-${e.player}`);
      const from = e.type === 'draw' ? deck : e.player === 0 && e.unit ? previous.current.get(e.unit) ?? hand : hand;
      const to = e.type === 'draw' ? e.player === 0 && e.unit ? previous.current.get(e.unit) ?? hand : hand : target ?? destination;
      return from && to ? [{ event: e, from, to, delay: i * 110 }] : [];
    });
    setFlights(next);
  }, [events]);
  return <div className="card-flights" aria-hidden="true">{flights.map(f => <div key={f.event.id} data-flight-owner={f.event.player} className={`card-flight flight-${f.event.type} ${f.event.type === 'play' ? 'effect-play' : ''} ${!f.event.cardId ? 'flight-hidden' : ''}`} style={{ '--from-x': `${f.from.x - 38}px`, '--from-y': `${f.from.y - 53}px`, '--to-x': `${f.to.x - 38}px`, '--to-y': `${f.to.y - 53}px`, '--mid-x': `${(f.from.x + f.to.x) / 2 - 38}px`, '--mid-y': `${(f.from.y + f.to.y) / 2 - 140}px`, animationDelay: `${f.delay}ms` } as React.CSSProperties}><div className="flight-inner"><div className="flight-face flight-back"><CardBack /></div>{f.event.cardId && <div className="flight-face flight-front"><CardArt cardId={f.event.cardId} /></div>}</div></div>)}</div>;
}
