import React from 'react';
import type { Deck } from '../../../packages/shared/src/index.ts';
import { riftboundCardById as cards, displayName } from '../../../packages/riftbound-content/src/index.ts';
import { CardArt, CardHover } from './CardArt.tsx';
import { RuneIcon } from './RuneIcon.tsx';
const groups = [['unit', 'Units'], ['spell', 'Spells'], ['gear', 'Gear']] as const;
function counted(ids: string[]) { const counts = new Map<string, number>(); for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1); return [...counts]; }
// Read-only breakdown of a deck, shown under the play lounge so players can compare decks while cycling.
export function DeckContents({ deck, product }: { deck: Deck; product?: string }) {
  const main = counted(deck.cards).sort(([a], [b]) => (cards[a]?.energy ?? 0) - (cards[b]?.energy ?? 0) || (cards[a] ? displayName(cards[a]) : a).localeCompare(cards[b] ? displayName(cards[b]) : b));
  const runes = counted(deck.runes ?? []);
  return <section className="deck-contents" aria-label={`${deck.name} deck contents`}>
    <header><div><span className="overline">DECK CONTENTS</span><h3>{deck.name}</h3></div><p>{product ? `${product} starter · ` : ''}{deck.cards.length} main cards · {deck.runes?.length ?? 0} runes · {deck.battlefields?.length ?? 0} battlefields</p></header>
    <div className="deck-contents-key">
      {deck.legend && <CardHover cardId={deck.legend} className="deck-key-card"><CardArt cardId={deck.legend} preview /><span>LEGEND<b>{cards[deck.legend] ? displayName(cards[deck.legend]) : deck.legend}</b></span></CardHover>}
      {deck.champion && <CardHover cardId={deck.champion} className="deck-key-card"><CardArt cardId={deck.champion} preview /><span>CHAMPION<b>{cards[deck.champion] ? displayName(cards[deck.champion]) : deck.champion}</b></span></CardHover>}
      <div className="deck-key-list"><span className="overline">BATTLEFIELDS</span>{(deck.battlefields ?? []).map(id => <CardHover key={id} cardId={id} className="deck-hover-name">{cards[id] ? displayName(cards[id]) : id}</CardHover>)}</div>
      <div className="deck-key-list"><span className="overline">RUNES</span>{runes.map(([id, n]) => <span key={id} className={`deck-rune ${cards[id]?.domains[0] ?? ''}`}><RuneIcon domain={cards[id]?.domains[0]} />{n}× {cards[id]?.name ?? id}</span>)}</div>
    </div>
    <div className="deck-contents-groups">{groups.map(([type, label]) => {
      const entries = main.filter(([id]) => cards[id]?.types.includes(type));
      if (!entries.length) return null;
      return <div key={type} className="deck-group"><h4>{label}<small>{entries.reduce((n, [, c]) => n + c, 0)}</small></h4><ul>{entries.map(([id, n]) => <li key={id}><CardHover cardId={id} className="deck-row"><CardArt cardId={id} preview className="deck-thumb" /><span className="deck-count">{n}×</span><span className="deck-name">{cards[id] ? displayName(cards[id]) : id}</span><span className="deck-cost" title="Energy cost">{cards[id]?.energy ?? 0}</span></CardHover></li>)}</ul></div>;
    })}</div>
  </section>;
}
