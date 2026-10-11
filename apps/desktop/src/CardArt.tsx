import React, { useEffect, useState } from 'react';
import { RiftSigil } from './RuneIcon.tsx';
import { riftboundCardById as cards, displayName } from '../../../packages/riftbound-content/src/index.ts';
export function cardName(cardId: string) { return cards[cardId] ? displayName(cards[cardId]) : cardId === 'recruit' ? 'Recruit' : cardId === 'sprite' ? 'Sprite' : 'Card'; }
export function CardArt({ cardId, className = '', landscape = false }: { cardId: string; className?: string; landscape?: boolean }) {
  const [failed, setFailed] = useState(false), card = cards[cardId];
  useEffect(() => setFailed(false), [cardId]);
  return <div className={`card-art ${landscape ? 'landscape' : ''} ${className}`}><div className="art-fallback" aria-hidden="true"><span className="rift-sigil"><RiftSigil /></span><strong>{cardName(cardId)}</strong>{card && <small>{card.domains.join(' / ')}</small>}</div>{card?.image && !failed && <img src={`${card.image}&w=${landscape ? 900 : 360}&auto=format`} alt={cardName(cardId)} loading="lazy" draggable={false} onError={() => { setFailed(true); console.warn('card_art_failed', { cardId }); }} />}</div>;
}
export function CardBack({ small = false }: { small?: boolean }) { return <div className={`card-back ${small ? 'small' : ''}`} aria-label="Face-down card"><div className="back-diamond"><RiftSigil /></div><span>RIFTBOUND</span></div>; }
export function RulesText({ text }: { text: string }) { return <p className="rules-text">{text.replace(/:rb_might:/g, 'Might').replace(/:rb_exhaust:/g, 'Exhaust').replace(/:rb_energy_(\d+):/g, '$1 energy').replace(/:rb_rune_(\w+):/g, '$1 power').replace(/:rb_\w+:/g, '◆')}</p>; }
