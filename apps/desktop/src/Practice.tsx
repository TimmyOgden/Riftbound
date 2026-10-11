import React, { useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { Deck } from '../../../packages/shared/src/index.ts';
import { riftboundStarters, riftboundCardById as cards, displayName } from '../../../packages/riftbound-content/src/index.ts';
import { practiceLimitations, practiceCardNote, practiceMight, type PracticeAction, type PracticeState, type PracticeView } from '../../../packages/game-engine/src/practice.ts';
import type { PracticeReply } from '../../server/src/practice.ts';
const name = (cardId: string) => cards[cardId] ? displayName(cards[cardId]) : cardId === 'recruit' ? 'Recruit token' : 'Sprite token';
export function Practice({ socket, selectedDeck }: { socket?: Socket; selectedDeck?: Deck }) {
  const [starterId, setStarterId] = useState(riftboundStarters[0].id), [opponent, setOpponent] = useState(riftboundStarters[2].id);
  const [custom, setCustom] = useState(false), [view, setView] = useState<PracticeView>();
  const [message, setMessage] = useState('Choose your deck and the AI opponent.');
  const [busy, setBusy] = useState(false);
  function request(input: unknown) {
    if (!socket?.connected) return setMessage('Connect to the server first.');
    setBusy(true);
    socket.timeout(8000).emit('practice', input, (error: Error | null, reply: PracticeReply) => {
      setBusy(false);
      if (error) return setMessage('Server did not respond. Refresh the board before trying again.');
      if (reply.view) setView(reply.view);
      setMessage(reply.ok ? 'Board updated.' : `${reply.error ?? 'Practice failed.'}${reply.requestId ? ` Reference: ${reply.requestId}` : ''}`);
    });
  }
  const deck = custom ? selectedDeck : riftboundStarters.find(s => s.id === starterId)?.deck;
  function actionLabel(action: PracticeAction) {
    if (action.type === 'end') return 'End turn';
    if (action.type === 'activate') return `Activate ${action.source}${action.target ? ` on ${action.target}` : ''}`;
    const unitName = (id?: string) => { const unit = view?.units.find(u => u.id === id); return unit ? `${unit.owner === 0 ? 'your' : 'AI'} ${name(unit.cardId)} (${unit.id})` : ''; };
    if (action.type === 'move') return `Move ${unitName(action.unit)} to ${action.field < 0 ? 'base' : name(view!.fields[action.field].cardId)}`;
    const instance = [...(view?.players[0].hand ?? []), ...(view?.players[0].champion ? [view.players[0].champion] : [])].find(c => c.id === action.card);
    return `Play ${instance ? name(instance.cardId) : action.card}${action.target ? ` → ${unitName(action.target)}` : ''}${action.other ? ` & ${unitName(action.other)}` : ''}`;
  }
  return <section className="practice"><h2>Play against AI <small className="badge">Practice beta</small></h2><p className="validation">{practiceLimitations}</p><div className="setup-grid"><label>Your starter deck<select value={starterId} disabled={custom} onChange={e => setStarterId(e.target.value)}>{riftboundStarters.map(s => <option key={s.id} value={s.id}>{s.deck.name}</option>)}</select></label><label>AI starter deck<select value={opponent} onChange={e => setOpponent(e.target.value)}>{riftboundStarters.map(s => <option key={s.id} value={s.id}>{s.deck.name}</option>)}</select></label></div>
    <label className="checkbox"><input type="checkbox" checked={custom} disabled={!selectedDeck} onChange={e => setCustom(e.target.checked)} /> Use selected account deck{selectedDeck ? `: ${selectedDeck.name}` : ' (choose one in the builder)'}</label>
    <div className="button-row"><button disabled={busy || !socket?.connected || !deck} onClick={() => request({ type: 'start', deck, opponent })}>{view ? 'Start new practice match' : 'Start practice match'}</button>{view && <button disabled={busy} onClick={() => request({ type: 'view' })}>Refresh board</button>}</div><p role="status">{message}</p>
    {view && <><h3>{view.winner !== undefined ? view.winner === 0 ? 'You win!' : 'AI wins' : `Turn ${view.turn} — ${view.active === 0 ? 'Your turn' : 'AI turn'}`}</h3><div className="scoreboard">{view.players.map((p, i) => <div key={i}><strong>{p.name}: {p.score} / 8 points</strong><small>{p.runes.filter(r => r.ready).length} ready / {p.runes.length} runes · {p.handCount} in hand · {p.deckCount} in deck</small></div>)}</div>
    <div className="battlefield-grid">{[-1, ...view.fields.map((_, i) => i)].map(field => <div className="battlefield" key={field}><h4>{field < 0 ? 'Bases' : name(view.fields[field].cardId)}</h4>{field >= 0 && <p>Control: {view.fields[field].controller === undefined ? 'unclaimed' : view.fields[field].controller === 0 ? 'you' : 'AI'}</p>}{view.units.filter(u => u.location === field).map(u => <p key={u.id}><strong>{u.owner === 0 ? 'You' : 'AI'} · {name(u.cardId)}</strong><small>{u.id} · Might {practiceMight(view as unknown as PracticeState, u)} · {u.ready ? 'ready' : 'exhausted'}</small></p>)}</div>)}</div>
    <h3>Your hand and chosen champion</h3><div className="hand-grid">{[...(view.players[0].champion ? [view.players[0].champion] : []), ...(view.players[0].hand ?? [])].map(c => <div className="hand-card" key={c.id}><strong>{name(c.cardId)}</strong><small>{view.players[0].champion?.id === c.id ? 'Chosen champion' : 'Hand'} · Energy {cards[c.cardId].energy} · Power {cards[c.cardId].power}</small><details><summary>Ability and beta support</summary><p className="rules-text">{cards[c.cardId].text}</p><p>{practiceCardNote(c.cardId)}</p></details></div>)}</div>
    <h3>Available actions</h3><div className="action-list">{view.legal.map((a, i) => <button key={i} disabled={busy} onClick={() => request({ type: 'action', revision: view.revision, action: a })}>{actionLabel(a)}</button>)}</div>
    <details><summary>Match history</summary><ol>{view.log.filter(line => !line.startsWith('confront:')).map((line, i) => <li key={i}>{line}</li>)}</ol></details></>}
  </section>;
}
