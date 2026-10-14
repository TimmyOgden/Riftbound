import React, { useEffect, useId, useRef, useState } from 'react';
import { riftboundCardById as cards } from '../../../packages/riftbound-content/src/index.ts';
import { CardArt, RulesText } from './CardArt.tsx';
export type PickerOption = { id: string; label: string; detail?: string };
// A scrollable card chooser: hovering, focusing or arrowing through options shows a full-size, readable copy of that card.
export function CardPicker({ label, options, value, onChange, empty = 'Nothing to choose yet.' }: { label: string; options: PickerOption[]; value?: string; onChange: (id: string) => void; empty?: string }) {
  const [highlight, setHighlight] = useState<string>();
  const list = useRef<HTMLDivElement>(null), labelId = useId();
  const shown = highlight ?? value ?? options[0]?.id, card = shown ? cards[shown] : undefined;
  useEffect(() => { list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' }); }, [value]);
  function move(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === 'ArrowDown' ? index + 1 : event.key === 'ArrowUp' ? index - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : -1;
    if (next < 0 || next >= options.length) return;
    event.preventDefault();
    (list.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')[next])?.focus();
  }
  return <div className="card-picker">
    <div className="card-picker-list"><span className="card-picker-label" id={labelId}>{label}</span>
      <div ref={list} role="listbox" aria-labelledby={labelId} className="card-picker-options" onMouseLeave={() => setHighlight(undefined)}>
        {options.map((option, i) => <button type="button" role="option" aria-selected={option.id === value} key={option.id} className={`card-picker-option ${option.id === value ? 'chosen' : ''} ${option.id === shown ? 'shown' : ''}`} onMouseEnter={() => setHighlight(option.id)} onFocus={() => setHighlight(option.id)} onKeyDown={e => move(e, i)} onClick={() => onChange(option.id)}>
          <CardArt cardId={option.id} preview className="card-picker-thumb" /><span><b>{option.label}</b>{option.detail && <small>{option.detail}</small>}</span>{option.id === value && <i aria-hidden="true">✓</i>}
        </button>)}
        {!options.length && <p className="card-picker-empty">{empty}</p>}
      </div>
    </div>
    <div className="card-picker-preview" aria-live="polite">{shown && <><CardArt key={shown} cardId={shown} preview /><div className="card-picker-text"><strong>{options.find(o => o.id === shown)?.label}</strong>{card && <small>{card.domains.join(' / ') || 'Colorless'} · Energy {card.energy}{card.types.includes('unit') ? ` · Might ${card.might}` : ''}</small>}{card?.text && <RulesText text={card.text} />}{shown !== value && <span className="card-picker-hint">Click to choose</span>}</div></>}</div>
  </div>;
}
