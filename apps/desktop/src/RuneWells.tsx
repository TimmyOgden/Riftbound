import React from 'react';
import { riftboundCardById as cards } from '../../../packages/riftbound-content/src/index.ts';
import { RuneIcon } from './RuneIcon.tsx';
type Rune = { cardId: string; ready: boolean };
// Large, animated rune pools at the table's edges: one flaming orb per domain, with a pip for every channelled rune.
export function RuneWell({ runes, label, side, channelled }: { runes: Rune[]; label: string; side: 'left' | 'right'; channelled: string[] }) {
  const domains = [...new Set(runes.map(r => cards[r.cardId]?.domains[0] ?? 'mind'))];
  const ready = runes.filter(r => r.ready).length;
  return <aside className={`rune-well rune-well-${side}`} aria-label={`${label} rune pool: ${ready} of ${runes.length} ready`}>
    <span className="rune-well-label">{label}</span>
    {domains.map(domain => {
      const pool = runes.filter(r => (cards[r.cardId]?.domains[0] ?? 'mind') === domain), live = pool.filter(r => r.ready).length;
      const flare = pool.some(r => channelled.includes(r.cardId));
      return <div key={domain} className={`rune-orb ${domain} ${live ? 'lit' : 'dark'} ${flare ? 'flare' : ''}`} style={{ '--heat': Math.min(1, live / 6) } as React.CSSProperties} title={`${domain} runes: ${live} ready of ${pool.length}`}>
        <div className="rune-orb-core"><span className="rune-flame" /><span className="rune-flame second" /><RuneIcon domain={domain} /></div>
        <b>{live}<small>/{pool.length}</small></b>
        <div className="rune-orb-pips">{pool.map((r, i) => <i key={i} className={r.ready ? 'on' : ''} />)}</div>
      </div>;
    })}
    {!runes.length && <span className="rune-well-empty">No runes yet</span>}
    <span className="rune-well-total">{ready} READY</span>
  </aside>;
}
