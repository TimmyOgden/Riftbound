import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { RiftSigil } from './RuneIcon.tsx';
import { riftboundCardById as cards, displayName } from '../../../packages/riftbound-content/src/index.ts';
export function cardName(cardId: string) { return cards[cardId] ? displayName(cards[cardId]) : cardId === 'recruit' ? 'Recruit' : cardId === 'sprite' ? 'Sprite' : 'Card'; }
type Placement = { left: number; top: number; width: number };
// Places a readable enlargement beside the hovered element, kept inside the viewport.
function previewPlacement(event: React.PointerEvent<HTMLElement>, landscape: boolean): Placement | undefined {
  if (event.pointerType !== 'mouse' || event.buttons || event.currentTarget.closest('.card-zoom, .card-flights, .drag-card-ghost')) return undefined;
  const rect = event.currentTarget.getBoundingClientRect();
  const width = Math.min(landscape ? 520 : 360, window.innerWidth - 24, (window.innerHeight - 24) * (landscape ? 1038 / 744 : 744 / 1039));
  const height = width * (landscape ? 744 / 1038 : 1039 / 744);
  const beside = rect.right + 16 + width <= window.innerWidth - 12 ? rect.right + 16 : rect.left - width - 16;
  return { width, left: Math.max(12, Math.min(beside, window.innerWidth - width - 12)), top: Math.max(12, Math.min(rect.top + rect.height / 2 - height / 2, window.innerHeight - height - 12)) };
}
function HoverPreview({ cardId, landscape, place }: { cardId: string; landscape: boolean; place: Placement }) {
  return createPortal(<div className="card-hover-preview" aria-hidden="true" style={place}><CardArt cardId={cardId} landscape={landscape} preview /></div>, document.body);
}
// Wraps any element (a card name, a list row) so hovering it shows the card enlarged.
export function CardHover({ cardId, className = '', children }: { cardId: string; className?: string; children: React.ReactNode }) {
  const [place, setPlace] = useState<Placement>();
  const landscape = !!cards[cardId]?.types.includes('battlefield');
  return <span className={className} onPointerEnter={e => setPlace(previewPlacement(e, landscape))} onPointerLeave={() => setPlace(undefined)} onPointerDown={() => setPlace(undefined)}>{children}{place && <HoverPreview cardId={cardId} landscape={landscape} place={place} />}</span>;
}
export function CardArt({ cardId, className = '', landscape = false, preview = false }: { cardId: string; className?: string; landscape?: boolean; preview?: boolean }) {
  const [failed, setFailed] = useState(false), card = cards[cardId];
  const [hover, setHover] = useState<Placement>();
  useEffect(() => { setFailed(false); setHover(undefined); }, [cardId]);
  function showPreview(event: React.PointerEvent<HTMLDivElement>) { if (!preview) setHover(previewPlacement(event, landscape)); }
  return <><div onPointerEnter={showPreview} onPointerLeave={() => setHover(undefined)} onPointerDown={() => setHover(undefined)} className={`card-art ${landscape ? 'landscape' : ''} ${className}`}><div className="art-fallback" aria-hidden="true"><span className="rift-sigil"><RiftSigil /></span><strong>{cardName(cardId)}</strong>{card && <small>{card.domains.join(' / ')}</small>}</div>{card?.image && !failed && <img src={`${card.image}&w=${landscape ? 900 : preview ? 744 : 360}&auto=format`} alt={cardName(cardId)} loading={preview ? 'eager' : 'lazy'} draggable={false} onError={() => { setFailed(true); console.warn('card_art_failed', { cardId }); }} />}</div>{hover && <HoverPreview cardId={cardId} landscape={landscape} place={hover} />}</>;
}
export function CardBack({ small = false }: { small?: boolean }) { return <div className={`card-back ${small ? 'small' : ''}`} aria-label="Face-down card"><div className="back-diamond"><RiftSigil /></div><span>RIFTBOUND</span></div>; }
export function RulesText({ text }: { text: string }) { return <p className="rules-text">{text.replace(/:rb_might:/g, 'Might').replace(/:rb_exhaust:/g, 'Exhaust').replace(/:rb_energy_(\d+):/g, '$1 energy').replace(/:rb_rune_(\w+):/g, '$1 power').replace(/:rb_\w+:/g, '◆')}</p>; }
