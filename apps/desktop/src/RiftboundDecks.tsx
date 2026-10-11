import React, { useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { Deck } from '../../../packages/shared/src/index.ts';
import type { AccountReply, SavedDeck } from '../../server/src/accounts.ts';
import { riftboundStarters, riftboundCards, riftboundCardById as byId, displayName } from '../../../packages/riftbound-content/src/index.ts';
import { validateRiftboundDeck } from '../../../packages/game-rules/src/riftbound.ts';
import { CardArt } from './CardArt.tsx';
export function Decks({ socket, onSelect }: { socket: Socket; onSelect: (deck: Deck | undefined) => void }) {
  const [username, setUsername] = useState(''), [password, setPassword] = useState('');
  const [token, setToken] = useState(''), [signedIn, setSignedIn] = useState('');
  const [saved, setSaved] = useState<SavedDeck[]>([]), [id, setId] = useState<string>();
  const [deck, setDeck] = useState<Deck>(structuredClone(riftboundStarters[0].deck));
  const [message, setMessage] = useState('New accounts receive all seven launch starter decks.');
  const [search, setSearch] = useState(''), [zone, setZone] = useState<'cards' | 'runes' | 'battlefields'>('cards');
  const [busy, setBusy] = useState(false);
  function load(found: SavedDeck) { setId(found.id); setDeck(structuredClone(found.deck)); }
  function request(command: { type: string; [key: string]: unknown }) {
    setBusy(true);
    socket.timeout(5000).emit('account', command, (error: Error | null, reply: AccountReply) => {
      setBusy(false);
      if (error) return setMessage('Server did not respond.');
      if (!reply.ok) return setMessage(`${reply.error ?? 'Request failed.'}${reply.requestId ? ` Reference: ${reply.requestId}` : ''}`);
      if (reply.token) { setToken(reply.token); setPassword(''); }
      if (reply.username) setSignedIn(reply.username);
      if (reply.decks) {
        setSaved(reply.decks);
        if (command.type === 'register' || command.type === 'login') { const first = reply.decks.find(d => d.deck.game === 'riftbound'); if (first) { load(first); onSelect(structuredClone(first.deck)); } }
        else if (command.type === 'save' && !id) { const last = reply.decks.at(-1); if (last) setId(last.id); }
        else if (command.type === 'delete') { setId(undefined); setDeck(structuredClone(riftboundStarters[0].deck)); }
      }
      if (command.type === 'logout') { setToken(''); setSignedIn(''); setSaved([]); setId(undefined); onSelect(undefined); }
      setMessage(command.type === 'save' ? 'Deck saved to your account.' : command.type === 'delete' ? 'Deck deleted.' : 'Signed in. Your starter decks are ready.');
    });
  }
  const errors = validateRiftboundDeck(deck), legend = byId[deck.legend ?? ''];
  const champions = riftboundCards.filter(c => c.types.includes('unit') && c.superTypes.includes('champion') && c.tags.some(t => legend?.tags.includes(t)) && c.domains.every(d => legend?.domains.includes(d)));
  const pool = riftboundCards.filter(c => !c.superTypes.includes('token') && c.domains.every(d => legend?.domains.includes(d)) && (zone === 'cards' ? c.types.some(t => ['unit', 'gear', 'spell'].includes(t)) : c.types.includes(zone === 'runes' ? 'rune' : 'battlefield')) && `${displayName(c)} ${c.text}`.toLowerCase().includes(search.toLowerCase()));
  function changeCount(cardId: string, delta: number) { const next = [...(deck[zone] ?? [])]; if (delta > 0) next.push(cardId); else { const index = next.indexOf(cardId); if (index >= 0) next.splice(index, 1); } setDeck({ ...deck, [zone]: next }); }
  if (!signedIn) return <section><h2>Your account</h2><p>Sign in to build, save, and play with your decks.</p><label>Username<input autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} /></label><label>Password (at least 10 characters)<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></label><button disabled={busy || !socket.connected} onClick={() => request({ type: 'login', username, password })}>Sign in</button>{' '}<button disabled={busy || !socket.connected} onClick={() => request({ type: 'register', username, password })}>Create account</button><p role="status">{message}</p></section>;
  return <section><div className="section-heading"><h2>{signedIn}'s deck builder</h2><button disabled={busy} onClick={() => request({ type: 'logout', token })}>Sign out</button></div><p role="status">{message}</p>
    <label>Saved decks<select value={id ?? ''} onChange={e => { const found = saved.find(d => d.id === e.target.value); if (found) load(found); else { setId(undefined); setDeck(structuredClone(riftboundStarters[0].deck)); } }}><option value="">New deck</option>{saved.filter(d => d.deck.game === 'riftbound').map(d => <option key={d.id} value={d.id}>{d.deck.name}</option>)}</select></label>
    <div className="button-row"><button onClick={() => { setId(undefined); setDeck({ ...structuredClone(deck), name: `${deck.name} copy`.slice(0, 60) }); }}>Make a copy</button><button onClick={() => { setId(undefined); setDeck({ ...structuredClone(riftboundStarters[0].deck), name: 'My new deck', cards: ['OGN-030'] }); }}>Build from scratch</button></div>
    <label>Start from a retail deck<select value="" onChange={e => { const starter = riftboundStarters.find(s => s.id === e.target.value); if (starter) { setId(undefined); setDeck(structuredClone(starter.deck)); } }}><option value="" disabled>Choose a starter template</option>{riftboundStarters.map(s => <option key={s.id} value={s.id}>{s.deck.name}</option>)}</select></label>
    <label>Deck name<input value={deck.name} maxLength={60} onChange={e => setDeck({ ...deck, name: e.target.value })} /></label>
    <label>Champion legend<select value={deck.legend} onChange={e => { const selected = byId[e.target.value]; const starter = riftboundStarters.find(s => s.deck.legend === selected.id); setDeck({ ...deck, legend: selected.id, champion: starter?.deck.champion, cards: starter ? [starter.deck.champion] : [], runes: starter?.deck.runes ?? [], battlefields: starter?.deck.battlefields ?? [] }); }}>
      {riftboundCards.filter(c => c.types.includes('legend')).map(c => <option key={c.id} value={c.id}>{c.tags[0]} - {displayName(c)}</option>)}
    </select></label><label>Chosen champion<select value={deck.champion ?? ''} onChange={e => { const next = [...deck.cards]; const old = next.indexOf(deck.champion ?? ''); if (old >= 0) next.splice(old, 1); next.push(e.target.value); setDeck({ ...deck, champion: e.target.value, cards: next }); }}><option value="">Choose a champion</option>{champions.map(c => <option key={c.id} value={c.id}>{displayName(c)} - {c.id}</option>)}</select></label>
    <p>Main deck: {deck.cards.length} (minimum 40, chosen champion included) / Runes: {deck.runes?.length ?? 0} of 12 / Battlefields: {deck.battlefields?.length ?? 0}</p>
    <label>Edit zone<select value={zone} onChange={e => setZone(e.target.value as typeof zone)}><option value="cards">Main deck</option><option value="runes">Rune deck</option><option value="battlefields">Battlefields</option></select></label>
    <label>Search cards<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or ability" /></label>
    <div className="deck-summary">{[...new Set(deck[zone] ?? [])].map(cardId => <span key={cardId}>{deck[zone]?.filter(id => id === cardId).length}x {byId[cardId] ? displayName(byId[cardId]) : cardId} <button aria-label={`Remove selected ${cardId}`} onClick={() => changeCount(cardId, -1)}>−</button></span>)}</div>
    <div className="card-list">{pool.map(card => { const count = (deck[zone] ?? []).filter(id => id === card.id).length; const totalNamed = deck.cards.filter(id => byId[id] && displayName(byId[id]) === displayName(card)).length; const maxed = zone === 'cards' ? totalNamed >= 3 || deck.cards.length >= 100 : zone === 'runes' ? (deck.runes?.length ?? 0) >= 12 : count >= 1 || (deck.battlefields?.length ?? 0) >= 3;
      return <div className="builder-card" key={card.id}><CardArt cardId={card.id} className="builder-thumbnail" /><div><strong>{displayName(card)}</strong><small>{card.id} · {card.types.join('/')} · {card.domains.join('/')} · Energy {card.energy} · Power {card.power}{card.types.includes('unit') ? ` · Might ${card.might}` : ''}</small><details><summary>Card details</summary><p className="rules-text">{card.text}</p><img loading="lazy" src={card.image} alt={displayName(card)} width="180" /></details></div><div className="count-controls"><button aria-label={`Remove ${card.id}`} disabled={!count} onClick={() => changeCount(card.id, -1)}>−</button><span>{count}</span><button aria-label={`Add ${card.id}`} disabled={maxed} onClick={() => changeCount(card.id, 1)}>+</button></div></div>;
    })}</div>
    {!!errors.length && <ul className="validation" aria-label="Deck validation">{errors.map(error => <li key={error}>{error}</li>)}</ul>}
    <div className="button-row"><button disabled={busy || !!errors.length || !deck.name.trim()} onClick={() => request({ type: 'save', token, id, deck })}>Save deck</button><button disabled={!!errors.length} onClick={() => { onSelect(structuredClone(deck)); setMessage(`${deck.name} selected for play.`); }}>Use this deck</button><button disabled={busy || !id} onClick={() => request({ type: 'delete', token, id })}>Delete saved deck</button></div>
  </section>;
}
