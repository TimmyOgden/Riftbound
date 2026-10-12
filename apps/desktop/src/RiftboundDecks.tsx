import React, { useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { Deck } from '../../../packages/shared/src/index.ts';
import type { AccountReply, SavedDeck } from '../../server/src/accounts.ts';
import { riftboundStarters, riftboundCards, riftboundCardById as byId, displayName } from '../../../packages/riftbound-content/src/index.ts';
import { validateRiftboundDeck } from '../../../packages/game-rules/src/riftbound.ts';
import { DeckLibrary } from './DeckLibrary.tsx';
import { Collection } from './Collection.tsx';
import { CardArt } from './CardArt.tsx';
export function Decks({ socket, onSelect, page = 'decks', serverKey = '', onNavigate }: { socket: Socket; onSelect: (deck: Deck | undefined) => void; page?: 'decks' | 'account' | 'collection'; serverKey?: string; onNavigate?: (page: 'account' | 'collection' | 'decks') => void }) {
  const [username, setUsername] = useState(''), [password, setPassword] = useState('');
  const [email, setEmail] = useState(''), [owned, setOwned] = useState<Record<string, number>>({});
  const [ownedOnly, setOwnedOnly] = useState(false), [cardType, setCardType] = useState('all'), [sort, setSort] = useState('name');
  const [token, setToken] = useState(''), [signedIn, setSignedIn] = useState('');
  const [saved, setSaved] = useState<SavedDeck[]>([]), [id, setId] = useState<string>();
  const [deck, setDeck] = useState<Deck>(structuredClone(riftboundStarters[0].deck));
  const [message, setMessage] = useState('New accounts receive all seven launch starter decks.');
  const [search, setSearch] = useState(''), [zone, setZone] = useState<'cards' | 'runes' | 'battlefields'>('cards');
  const [editing, setEditing] = useState(false), [hasDraft, setHasDraft] = useState(false), [selected, setSelected] = useState<string>();
  useEffect(() => { if (page === 'decks') setEditing(false); }, [page]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const restore = () => { const savedToken = sessionStorage.getItem(`account:${serverKey}`); if (savedToken) { setToken(savedToken); request({ type: 'list', token: savedToken }); } };
    socket.on('connect', restore); if (socket.connected) restore();
    return () => { socket.off('connect', restore); };
  }, [socket, serverKey]);
  function load(found: SavedDeck, open = true) { setId(found.id); setDeck(structuredClone(found.deck)); if (open) { setEditing(true); setHasDraft(true); } }
  function useDeck(next: Deck, selectedId?: string) { onSelect(structuredClone(next)); setSelected(selectedId); setMessage(`${next.name} selected for play.`); }
  function template(next: Deck) { setId(undefined); setDeck(structuredClone(next)); setEditing(true); setHasDraft(true); }
  function request(command: { type: string; [key: string]: unknown }) {
    setBusy(true);
    socket.timeout(5000).emit('account', command, (error: Error | null, reply: AccountReply) => {
      setBusy(false);
      if (error) return setMessage('Server did not respond.');
      if (!reply.ok) { if (reply.error === 'Sign in again.') { setToken(''); setSignedIn(''); setSaved([]); setOwned({}); sessionStorage.removeItem(`account:${serverKey}`); onSelect(undefined); } return setMessage(`${reply.error ?? 'Request failed.'}${reply.requestId ? ` Reference: ${reply.requestId}` : ''}`); }
      if (reply.token) { setToken(reply.token); sessionStorage.setItem(`account:${serverKey}`, reply.token); setPassword(''); }
      if (reply.email !== undefined) setEmail(reply.email);
      if (reply.collection) setOwned(reply.collection);
      if (reply.username) setSignedIn(reply.username);
      if (reply.decks) {
        setSaved(reply.decks);
        if (command.type === 'register' || command.type === 'login') { const first = reply.decks.find(d => d.deck.game === 'riftbound'); if (first) { load(first, false); setEditing(false); setSelected(first.id); onSelect(structuredClone(first.deck)); } }
        else if (command.type === 'save' && !id) { const last = reply.decks.at(-1); if (last) setId(last.id); }
        else if (command.type === 'delete') { setEditing(false); setHasDraft(false); setId(undefined); setDeck(structuredClone(riftboundStarters[0].deck)); }
      }
      if (command.type === 'logout') { setToken(''); setSignedIn(''); setSaved([]); setOwned({}); setEmail(''); sessionStorage.removeItem(`account:${serverKey}`); setId(undefined); setEditing(false); setHasDraft(false); setSelected(undefined); onSelect(undefined); }
      setMessage(command.type === 'profile' ? 'Email address saved.' : command.type === 'collection' ? 'Collection saved.' : command.type === 'logout' ? 'Signed out.' : command.type === 'save' ? 'Deck saved to your account.' : command.type === 'delete' ? 'Deck deleted.' : 'Signed in. Your starter decks are ready.');
    });
  }
  const errors = validateRiftboundDeck(deck), legend = byId[deck.legend ?? ''];
  const champions = riftboundCards.filter(c => c.types.includes('unit') && c.superTypes.includes('champion') && c.tags.some(t => legend?.tags.includes(t)) && c.domains.every(d => legend?.domains.includes(d)));
  const pool = riftboundCards.filter(c => (!ownedOnly || owned[c.id] > 0) && (cardType === 'all' || c.types.includes(cardType)) && !c.superTypes.includes('token') && c.domains.every(d => legend?.domains.includes(d)) && (zone === 'cards' ? c.types.some(t => ['unit', 'gear', 'spell'].includes(t)) : c.types.includes(zone === 'runes' ? 'rune' : 'battlefield')) && `${displayName(c)} ${c.text}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => sort === 'cost' ? a.energy - b.energy || displayName(a).localeCompare(displayName(b)) : displayName(a).localeCompare(displayName(b)));
  function changeCount(cardId: string, delta: number) { const next = [...(deck[zone] ?? [])]; if (delta > 0) next.push(cardId); else { const index = next.indexOf(cardId); if (index >= 0) next.splice(index, 1); } setDeck({ ...deck, [zone]: next }); }
  if (!signedIn) return <section><h2>Your account</h2><p>Sign in to save decks and track your owned cards. New accounts receive seven starter deck templates.</p><form onSubmit={e => { e.preventDefault(); request({ type: 'register', username, password, email }); }}><label>Username<input autoComplete="username" minLength={3} maxLength={24} required pattern="[a-zA-Z0-9_]{3,24}" value={username} onChange={e => setUsername(e.target.value)} /></label><label>Email address<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></label><label>Password (at least 6 characters)<input type="password" minLength={6} maxLength={128} required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></label><button type="button" disabled={busy || !socket.connected || !username || password.length < 6} onClick={() => request({ type: 'login', username, password })}>Sign in</button>{' '}<button type="submit" disabled={busy || !socket.connected}>Create account</button></form><p role="status">{message}</p></section>;
  if (page === 'account') return <section><h2>{signedIn}'s account</h2><p role="status">{message}</p><p>Username: {signedIn}</p><form onSubmit={e => { e.preventDefault(); request({ type: 'profile', token, email }); }}><label>Email address<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></label><button disabled={busy || !socket.connected}>Save email address</button></form><p>{saved.length} saved decks · {Object.values(owned).reduce((a, b) => a + b, 0)} owned cards</p><button disabled={busy} onClick={() => request({ type: 'logout', token })}>Sign out</button></section>;
  if (page === 'collection') return <section><p role="status">{message}</p><Collection owned={owned} busy={busy || !socket.connected} update={(cardId, count) => request({ type: 'collection', token, cardId, count })} /></section>;
  if (!editing) return <section className="deck-library-section"><p role="status">{message}</p><DeckLibrary saved={saved} owned={owned} busy={busy || !socket.connected} selected={selected} onEdit={load} onPlay={useDeck} onNew={() => template({ ...structuredClone(riftboundStarters[0].deck), name: 'My new deck', cards: [riftboundStarters[0].deck.champion] })} onTemplate={template} onCollection={() => onNavigate?.('collection')} onResume={hasDraft ? () => setEditing(true) : undefined} /></section>;
  const required = [...deck.cards, ...(deck.runes ?? []), ...(deck.battlefields ?? []), ...(deck.legend ? [deck.legend] : [])];
  const missing = [...new Set(required)].map(cardId => ({ cardId, count: required.filter(id => id === cardId).length - (owned[cardId] ?? 0) })).filter(entry => entry.count > 0);
  return <section className="deck-editor-section"><div className="section-heading"><button className="text-button" onClick={() => setEditing(false)}>← Back to my decks</button><span className="overline">DECK BUILDER</span></div><div className="editor-deck-header"><CardArt cardId={deck.champion ?? deck.legend ?? ''} /><div><h2>{deck.name}</h2><p>{legend?.domains.join(' / ')} · {deck.cards.length} main cards · {deck.runes?.length ?? 0} runes</p><p>{errors.length ? 'Finish the deck checklist below to get ready for play.' : 'Ready for practice. Save your changes and take it to the table.'}</p></div></div><p role="status">{message}</p>
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
    <div className="collection-filters"><label className="checkbox"><input type="checkbox" checked={ownedOnly} onChange={e => setOwnedOnly(e.target.checked)} />Only owned cards</label><label>Builder card type<select value={cardType} onChange={e => setCardType(e.target.value)}><option value="all">All types</option>{['unit','spell','gear'].map(t => <option key={t}>{t}</option>)}</select></label><label>Sort cards<select value={sort} onChange={e => setSort(e.target.value)}><option value="name">Name</option><option value="cost">Energy cost</option></select></label></div>
    <details className="missing-cards"><summary>{missing.length ? `${missing.reduce((n, entry) => n + entry.count, 0)} copies missing from your collection` : 'You own all cards in this deck'}</summary><p>Collection counts help plan your physical deck. You can still save and play practice decks.</p><ul>{missing.map(entry => <li key={entry.cardId}>{entry.count}× {byId[entry.cardId] ? displayName(byId[entry.cardId]) : entry.cardId}</li>)}</ul></details>
    <div className="deck-summary">{[...new Set(deck[zone] ?? [])].map(cardId => <span key={cardId}>{deck[zone]?.filter(id => id === cardId).length}x {byId[cardId] ? displayName(byId[cardId]) : cardId} <button aria-label={`Remove selected ${cardId}`} onClick={() => changeCount(cardId, -1)}>−</button></span>)}</div>
    <div className="card-list">{pool.map(card => { const count = (deck[zone] ?? []).filter(id => id === card.id).length; const totalNamed = deck.cards.filter(id => byId[id] && displayName(byId[id]) === displayName(card)).length; const maxed = zone === 'cards' ? totalNamed >= 3 || deck.cards.length >= 100 : zone === 'runes' ? (deck.runes?.length ?? 0) >= 12 : count >= 1 || (deck.battlefields?.length ?? 0) >= 3;
      return <div className="builder-card" key={card.id}><CardArt cardId={card.id} className="builder-thumbnail" /><div><strong>{displayName(card)}</strong><small>{card.id} · {card.types.join('/')} · {card.domains.join('/')} · Energy {card.energy} · Power {card.power}{card.types.includes('unit') ? ` · Might ${card.might}` : ''}</small><details><summary>Card details</summary><p className="rules-text">{card.text}</p><img loading="lazy" src={card.image} alt={displayName(card)} width="180" /></details></div><div className="count-controls"><button aria-label={`Remove ${card.id}`} disabled={!count} onClick={() => changeCount(card.id, -1)}>−</button><span>{count}<small>{owned[card.id] ?? 0} owned</small></span><button aria-label={`Add ${card.id}`} disabled={maxed} onClick={() => changeCount(card.id, 1)}>+</button></div></div>;
    })}</div>
    {!!errors.length && <ul className="validation" aria-label="Deck validation">{errors.map(error => <li key={error}>{error}</li>)}</ul>}
    <div className="button-row"><button disabled={busy || !!errors.length || !deck.name.trim()} onClick={() => request({ type: 'save', token, id, deck })}>Save deck</button><button disabled={!!errors.length} onClick={() => { useDeck(deck, id); }}>Use this deck</button><button disabled={busy || !id} onClick={() => request({ type: 'delete', token, id })}>Delete saved deck</button></div>
  </section>;
}
