import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

export interface DragCard { kind: 'card' | 'unit'; id: string; cardId: string }
export interface DropZone { unit?: string; field?: number }
interface Options {
  revision?: number;
  onStart: (card: DragCard) => void;
  onDrop: (card: DragCard, zone: DropZone, accelerate: boolean) => void;
  onCancel: () => void;
}
export function useCardDrag(options: Options) {
  const current = useRef(options); current.current = options;
  const pending = useRef<{ card: DragCard; x: number; y: number; pointer: number; revision?: number; active: boolean; source: HTMLElement } | undefined>(undefined);
  const suppressUntil = useRef(0);
  const suppressedCard = useRef('');
  const [drag, setDrag] = useState<{ card: DragCard; x: number; y: number; zone: DropZone }>();
  function zoneAt(x: number, y: number): DropZone {
    const element = document.elementFromPoint(x, y);
    const unit = element?.closest<HTMLElement>('[data-drop-unit]')?.dataset.dropUnit;
    const field = element?.closest<HTMLElement>('[data-drop-field]')?.dataset.dropField;
    return { unit, field: field === undefined ? undefined : Number(field) };
  }
  useEffect(() => {
    function finish(cancelled: boolean, e?: PointerEvent) {
      const p = pending.current; if (!p || (e && p.pointer !== e.pointerId)) return;
      pending.current = undefined; setDrag(undefined);
      if (p.source.hasPointerCapture(p.pointer)) p.source.releasePointerCapture(p.pointer);
      if (!p.active) return;
      suppressUntil.current = Date.now() + 350;
      suppressedCard.current = p.card.id;
      if (cancelled || p.revision !== current.current.revision || !e) current.current.onCancel();
      else current.current.onDrop(p.card, zoneAt(e.clientX, e.clientY), e.shiftKey);
    }
    function move(e: PointerEvent) {
      const p = pending.current; if (!p || p.pointer !== e.pointerId) return;
      if (p.revision !== current.current.revision) { finish(true, e); return; }
      if (!p.active && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 7) return;
      e.preventDefault();
      if (!p.active) { p.active = true; current.current.onStart(p.card); }
      setDrag({ card: p.card, x: e.clientX, y: e.clientY, zone: zoneAt(e.clientX, e.clientY) });
    }
    const up = (e: PointerEvent) => finish(false, e), cancel = (e: PointerEvent) => finish(true, e);
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') finish(true); };
    const blur = () => finish(true);
    window.addEventListener('pointermove', move, { passive: false }); window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel); window.addEventListener('keydown', escape); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel); window.removeEventListener('keydown', escape); window.removeEventListener('blur', blur); };
  }, []);
  useEffect(() => {
    if (pending.current && pending.current.revision !== options.revision) { pending.current = undefined; setDrag(undefined); }
  }, [options.revision]);
  function begin(e: ReactPointerEvent<HTMLElement>, card: DragCard, enabled: boolean) {
    if (!enabled || e.button !== 0 || !e.isPrimary) return;
    pending.current = { card, pointer: e.pointerId, x: e.clientX, y: e.clientY, revision: current.current.revision, active: false, source: e.currentTarget };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  return { drag, begin, allowClick: (id: string) => id !== suppressedCard.current || Date.now() > suppressUntil.current };
}
