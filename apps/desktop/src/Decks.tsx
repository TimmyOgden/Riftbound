import React, { useState } from 'react';
import type { Socket } from 'socket.io-client';
import { cards, starterDeck } from '../../../packages/game-content/src/index.ts';
import { originalModule } from '../../../packages/game-rules/src/index.ts';
import type { Deck } from '../../../packages/shared/src/index.ts';
import type { AccountReply, SavedDeck } from '../../server/src/accounts.ts';
export function Decks({ socket, onSelect }: { socket: Socket; onSelect: (deck: Deck | undefined) => void }) {
  const [username, setUsername] = useState(''), [password, setPassword] = useState('');
  const [token, setToken] = useState(''), [signedIn, setSignedIn] = useState('');
  const [saved, setSaved] = useState<SavedDeck[]>([]), [id, setId] = useState<string>();
  const [deck, setDeck] = useState<Deck>(structuredClone(starterDeck));
  const [message, setMessage] = useState('Sign in to save decks on this server.');
  function request(command: object) {
    socket.timeout(5000).emit('account', command, (error: Error | null, reply: AccountReply) => {
      if (error) return setMessage('Server did not respond.');
      if (!reply.ok) return setMessage(reply.error ?? 'Request failed.');
      if (reply.token) { setToken(reply.token); setPassword(''); }
      if (reply.username) setSignedIn(reply.username);
      if (reply.decks) setSaved(reply.decks);
      setMessage('Account updated.');
    });
  }
  const errors = originalModule.validateDeck(deck);
  if (!signedIn) return <section><h2>Your account</h2><label>Username<input autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} /></label><label>Password · at least 10 characters<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></label><button onClick={() => request({ type: 'login', username, password })}>Sign in</button>{' '}<button onClick={() => request({ type: 'register', username, password })}>Create account</button><p role="status">{message}</p></section>;
  return <section><h2>{signedIn}’s decks</h2><p role="status">{message}</p><label>Saved decks<select value={id ?? ''} onChange={e => { const found = saved.find(d => d.id === e.target.value); setId(found?.id); setDeck(structuredClone(found?.deck ?? starterDeck)); }}><option value="">New deck · First Light template</option>{saved.map(d => <option key={d.id} value={d.id}>{d.deck.name}</option>)}</select></label><label>Deck name<input value={deck.name} maxLength={60} onChange={e => setDeck({ ...deck, name: e.target.value })} /></label><p>{deck.cards.length} / 30 cards · maximum 3 of each · at least 8 resources</p><div className="card-list">{cards.map(card => { const count = deck.cards.filter(c => c === card.id).length; return <div key={card.id}><span>{card.name} · {card.type} · cost {card.cost}</span><button aria-label={`Remove ${card.name}`} disabled={!count} onClick={() => { const next = [...deck.cards]; next.splice(next.indexOf(card.id), 1); setDeck({ ...deck, cards: next }); }}>−</button><span>{count}</span><button aria-label={`Add ${card.name}`} disabled={count >= 3 || deck.cards.length >= 30} onClick={() => setDeck({ ...deck, cards: [...deck.cards, card.id] })}>+</button></div>; })}</div><p>{errors.join(' ')}</p><button disabled={!!errors.length || !deck.name.trim()} onClick={() => request({ type: 'save', token, id, deck })}>Save deck</button>{' '}<button disabled={!!errors.length} onClick={() => { onSelect(structuredClone(deck)); setMessage(`${deck.name} selected for the lobby.`); }}>Use in lobby</button>{' '}<button disabled={!id} onClick={() => { request({ type: 'delete', token, id }); setId(undefined); }}>Delete saved deck</button>{' '}<button onClick={() => { request({ type: 'logout', token }); setToken(''); setSignedIn(''); setSaved([]); onSelect(undefined); }}>Sign out</button></section>;
}
