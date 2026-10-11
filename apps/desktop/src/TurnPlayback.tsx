import React from 'react';
import type { PracticeEvent } from '../../../packages/game-engine/src/practice.ts';
export function TurnPlayback({ events, completed, total, paused, suspended, speed, onPause, onSpeed, onStep, onSkip }: {
  events: PracticeEvent[]; completed: number; total: number; paused: boolean; suspended: boolean;
  speed: 'normal' | 'fast'; onPause: () => void; onSpeed: (speed: 'normal' | 'fast') => void; onStep: () => void; onSkip: () => void;
}) {
  const action = [...events].reverse().find(e => ['play', 'move', 'activate', 'combat', 'turn'].includes(e.type));
  return <section className="turn-playback" aria-label="AI turn playback">
    <div className="playback-description"><span className="overline">{paused || suspended ? 'AI TURN PAUSED' : 'WATCH YOUR RIVAL'}</span><strong role="status" aria-live="polite">{action?.text ?? 'The AI readies its next move.'}</strong><small>Step {completed + 1} of {total + 1}</small></div>
    <div className="playback-controls"><button onClick={onPause} aria-label={paused ? 'Resume AI turn' : 'Pause AI turn'}>{paused ? 'Resume' : 'Pause'}</button>{paused && <button onClick={onStep}>Next move</button>}<label>Speed<select value={speed} onChange={e => onSpeed(e.target.value as 'normal' | 'fast')}><option value="normal">Normal</option><option value="fast">Fast</option></select></label><button onClick={onSkip}>Skip AI turn</button></div>
  </section>;
}
