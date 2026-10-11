import React, { useEffect, useRef } from 'react';
import { riftboundCardById as cards } from '../../../packages/riftbound-content/src/index.ts';
import { CardArt, cardName, RulesText } from './CardArt.tsx';
export function CardZoom({ cardId, onClose }: { cardId: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), card = cards[cardId];
  useEffect(() => { const el = dialog.current!; el.showModal(); return () => el.close(); }, []);
  return <dialog ref={dialog} className="card-zoom" aria-labelledby="zoom-title" onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="zoom-layout"><CardArt cardId={cardId} /><div className="zoom-details"><span className="overline">CARD DETAIL</span><h2 id="zoom-title">{cardName(cardId)}</h2>{card && <><p className="zoom-domains">{card.domains.join(' / ')} · {card.types.join(' / ')}</p><div className="zoom-stats"><span><b>{card.energy}</b> energy</span><span><b>{card.power}</b> power</span>{card.types.includes('unit') && <span><b>{card.might}</b> might</span>}</div><RulesText text={card.text} /></>}<button autoFocus className="primary-button" onClick={onClose}>Back to the table · Esc</button></div></div>
  </dialog>;
}
