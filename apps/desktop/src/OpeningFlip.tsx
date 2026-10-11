import React, { useEffect, useState } from 'react';
import { RiftSigil, RuneIcon } from './RuneIcon.tsx';
export function OpeningFlip({ firstPlayer, onComplete }: { firstPlayer: number; onComplete: () => void }) {
  const [revealed, setRevealed] = useState(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const focus = document.activeElement as HTMLElement | null;
    const trap = (event: KeyboardEvent) => {
      if (event.key === 'Tab') { event.preventDefault(); document.querySelector<HTMLButtonElement>('.skip-intro')?.focus(); }
      if (event.key === 'Escape') onComplete();
    };
    window.addEventListener('keydown', trap);
    const show = window.setTimeout(() => setRevealed(true), 1300);
    const finish = window.setTimeout(onComplete, 2600);
    return () => { window.clearTimeout(show); window.clearTimeout(finish); window.removeEventListener('keydown', trap); focus?.focus(); };
  }, [onComplete]);
  return <div className="opening-overlay" role="dialog" aria-modal="true" aria-label="First player coin flip"><div className="opening-vignette" /><span className="overline">LET FATE SET THE TABLE</span><div className={`coin-scene ${revealed ? 'settled' : ''}`}><div className={`rift-coin ${firstPlayer === 1 ? 'coin-ai' : ''}`}><div className="coin-face coin-front"><RiftSigil /><span>YOU</span></div><div className="coin-face coin-back"><RuneIcon domain="chaos" /><span>RIVAL</span></div></div><div className="coin-shadow" /></div><div className="coin-result" role="status"><h2>{revealed ? firstPlayer === 0 ? 'You go first.' : 'Your rival goes first.' : 'The coin is in the air…'}</h2><p>{revealed ? firstPlayer === 0 ? 'Your opening hand is ready. Take the initiative.' : 'You go second: channel an extra rune on your first turn.' : 'A fair toss. A fresh battle.'}</p></div><button autoFocus className="text-button skip-intro" onClick={onComplete}>{revealed ? 'Take your seat →' : 'Skip intro →'}</button></div>;
}
