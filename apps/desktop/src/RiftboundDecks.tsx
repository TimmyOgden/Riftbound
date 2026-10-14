import React, { useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { Deck } from '../../../packages/shared/src/index.ts';
import type { AccountReply, SavedDeck } from '../../server/src/accounts.ts';
import { riftboundStarters, riftboundCards, riftboundCardById as byId, displayName } from '../../../packages/riftbound-content/src/index.ts';
import { validateRiftboundDeck } from '../../../packages/game-rules/src/riftbound.ts';
import { DeckLibrary } from './DeckLibrary.tsx';
import { Collection } from './Collection.tsx';
import { CardArt, CardHover } from './CardArt.tsx';
import { CardPicker } from './CardPicker.tsx';
import './card-picker.css';
import './deck-builder.css';
type Zone = 'cards' | 'runes' | 'battlefields';
const zones: [Zone, string, number][] = [['cards', 'Main deck', 40], ['runes', 'Runes', 12], ['battlefields', 'Battlefields', 3]];
const cardTypes = [['unit', 'Units'], ['spell', 'Spells'], ['gear', 'Gear']] as const;
function tally(ids: string[]) { const counts = new Map<string, number>(); for (const cardId of ids) counts.set(cardId, (counts.get(cardId) ?? 0) + 1); return [...counts].sort(([a], [b]) => (byId[a]?.energy ?? 0) - (byId[b]?.energy ?? 0) || (byId[a] ? displayName(byId[a]) : a).localeCompare(byId[b] ? displayName(byId[b]) : b)); }
// Overnumbered alt-art printings repeat a card; list each card once, keeping the one already chosen.
function firstPrintings<T extends { id: string; name: string; subtitle: string }>(list: T[], keep?: string) {
  const seen = new Set<string>();
  return list.filter(c => { const key = `${c.name}|${c.subtitle}`; if (seen.has(key) && c.id !== keep) return false; seen.add(key); return true; });
}
const legends = firstPrintings(riftboundCards.filter(c => c.types.includes('legend'))).sort((a, b) => a.tags[0]?.localeCompare(b.tags[0] ?? '') || a.id.localeCompare(b.id));
// Guests keep decks and collection counts in this browser only; starters granted once so deleted ones stay deleted.
const guestKey = 'riftbound:guest';
type GuestData = { decks: SavedDeck[]; collection: Record<string, number>; granted: string[] };
function readGuest(): GuestData {
  let data: Partial<GuestData> = {};
  try { data = JSON.parse(localStorage.getItem(guestKey) ?? '{}') ?? {}; } catch { /* storage unavailable */ }
  const decks = Array.isArray(data.decks) ? data.decks : [], granted = Array.isArray(data.granted) ? data.granted : [];
  const missing = riftboundStarters.filter(s => !granted.includes(s.id));
  return { decks: [...decks, ...missing.map(s => ({ id: `guest-${s.id}`, deck: structuredClone(s.deck) }))], collection: data.collection && typeof data.collection === 'object' ? data.collection : {}, granted: [...granted, ...missing.map(s => s.id)] };
}
function writeGuest(data: GuestData) { try { localStorage.setItem(guestKey, JSON.stringify(data)); } catch { /* storage unavailable */ } }
export function Decks({ socket, onSelect, page = 'decks', serverKey = '', onNavigate }: { socket: Socket; onSelect: (deck: Deck | undefined) => void; page?: 'decks' | 'account' | 'collection'; serverKey?: string; onNavigate?: (page: 'account' | 'collection' | 'decks') => void }) {
  const [username, setUsername] = useState(''), [password, setPassword] = useState('');
  const [email, setEmail] = useState(''), [owned, setOwned] = useState<Record<string, number>>({});
  const [ownedOnly, setOwnedOnly] = useState(false), [cardType, setCardType] = useState('all'), [sort, setSort] = useState('name');
  const [token, setToken] = useState(''), [signedIn, setSignedIn] = useState(''), [guest, setGuest] = useState(false);
  const [saved, setSaved] = useState<SavedDeck[]>([]), [id, setId] = useState<string>();
  const [deck, setDeck] = useState<Deck>(structuredClone(riftboundStarters[0].deck));
  const [message, setMessage] = useState(`New accounts receive all ${riftboundStarters.length} starter decks.`);
  const [search, setSearch] = useState(''), [zone, setZone] = useState<Zone>('cards'), [limit, setLimit] = useState(48);
  useEffect(() => { setLimit(48); }, [zone, search, cardType, sort, ownedOnly, deck.legend]);
  useEffect(() => { if (!message) return; const timer = setTimeout(() => setMessage(''), 6000); return () => clearTimeout(timer); }, [message]);
  const [editing, setEditing] = useState(false), [hasDraft, setHasDraft] = useState(false), [selected, setSelected] = useState<string>();
  useEffect(() => { if (page === 'decks') setEditing(false); }, [page]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const restore = () => { const savedToken = sessionStorage.getItem(`account:${serverKey}`); if (savedToken) { setToken(savedToken); request({ type: 'list', token: savedToken }); } };
    socket.on('connect', restore); if (socket.connected) restore();
    return () => { socket.off('connect', restore); };
  }, [socket, serverKey]);
  useEffect(() => { if (sessionStorage.getItem(guestKey)) enterGuest(false); }, []);
  function enterGuest(announce = true) {
    const data = readGuest(); writeGuest(data); sessionStorage.setItem(guestKey, '1');
    setGuest(true); setSaved(data.decks); setOwned(data.collection);
    const first = data.decks.find(d => d.deck.game === 'riftbound'); if (first) { load(first, false); setEditing(false); setSelected(first.id); onSelect(structuredClone(first.deck)); }
    if (announce) setMessage('Playing as a guest. Your decks and cards are saved on this device only.');
  }
  function guestRequest(command: { type: string; [key: string]: unknown }) {
    const data = readGuest();
    if (command.type === 'logout') { sessionStorage.removeItem(guestKey); setGuest(false); setSaved([]); setOwned({}); setId(undefined); setEditing(false); setHasDraft(false); setSelected(undefined); onSelect(undefined); return setMessage('Guest session ended. Your guest decks stay on this device.'); }
    if (command.type === 'collection') {
      const cardId = String(command.cardId), count = Number(command.count);
      if (!byId[cardId] || !Number.isInteger(count) || count < 0 || count > 999) return setMessage('Enter a whole number from 0 to 999.');
      if (count === 0) delete data.collection[cardId]; else data.collection[cardId] = count;
      setOwned({ ...data.collection }); setMessage('Collection saved on this device.');
    }
    if (command.type === 'save') {
      const next = structuredClone(command.deck as Deck), existing = data.decks.findIndex(d => d.id === command.id);
      if (existing >= 0) data.decks[existing] = { id: data.decks[existing].id, deck: next }; else { const newId = `guest-${Date.now().toString(36)}`; data.decks.push({ id: newId, deck: next }); setId(newId); }
      setSaved(data.decks); setMessage('Deck saved on this device.');
    }
    if (command.type === 'delete') { data.decks = data.decks.filter(d => d.id !== command.id); setSaved(data.decks); setEditing(false); setHasDraft(false); setId(undefined); setDeck(structuredClone(riftboundStarters[0].deck)); setMessage('Deck deleted.'); }
    writeGuest(data);
  }
  function load(found: SavedDeck, open = true) { setId(found.id); setDeck(structuredClone(found.deck)); if (open) { setEditing(true); setHasDraft(true); window.scrollTo?.({ top: 0 }); } }
  function useDeck(next: Deck, selectedId?: string) { onSelect(structuredClone(next)); setSelected(selectedId); setMessage(`${next.name} selected for play.`); }
  function template(next: Deck) { setId(undefined); setDeck(structuredClone(next)); setEditing(true); setHasDraft(true); window.scrollTo?.({ top: 0 }); }
  function request(command: { type: string; [key: string]: unknown }) {
    if (guest) return guestRequest(command);
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
  const champions = firstPrintings(riftboundCards.filter(c => c.types.includes('unit') && c.superTypes.includes('champion') && c.tags.some(t => legend?.tags.includes(t)) && c.domains.every(d => legend?.domains.includes(d))), deck.champion);
  const pool = riftboundCards.filter(c => (!ownedOnly || owned[c.id] > 0) && (cardType === 'all' || c.types.includes(cardType)) && !c.superTypes.includes('token') && c.domains.every(d => legend?.domains.includes(d)) && (zone === 'cards' ? c.types.some(t => ['unit', 'gear', 'spell'].includes(t)) : c.types.includes(zone === 'runes' ? 'rune' : 'battlefield')) && `${displayName(c)} ${c.text}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => sort === 'cost' ? a.energy - b.energy || displayName(a).localeCompare(displayName(b)) : displayName(a).localeCompare(displayName(b)));
  function maxed(target: Zone, cardId: string) {
    const card = byId[cardId]; if (!card) return true;
    if (target === 'cards') return deck.cards.filter(id => byId[id] && displayName(byId[id]) === displayName(card)).length >= 3 || deck.cards.length >= 100;
    if (target === 'runes') return (deck.runes?.length ?? 0) >= 12;
    return (deck.battlefields ?? []).includes(cardId) || (deck.battlefields?.length ?? 0) >= 3;
  }
  function changeCount(cardId: string, delta: number, target: Zone = zone) { const next = [...(deck[target] ?? [])]; if (delta > 0) { if (maxed(target, cardId)) return; next.push(cardId); } else { const index = next.lastIndexOf(cardId); if (index >= 0) next.splice(index, 1); } setDeck({ ...deck, [target]: next }); }
  if (!signedIn && !guest) return <section><h2>Your account</h2><p>Sign in to save decks and track your owned cards. New accounts receive {riftboundStarters.length} starter deck templates.</p><form onSubmit={e => { e.preventDefault(); request({ type: 'register', username, password, email }); }}><label>Username<input autoComplete="username" minLength={3} maxLength={24} required pattern="[a-zA-Z0-9_]{3,24}" value={username} onChange={e => setUsername(e.target.value)} /></label><label>Email address<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></label><label>Password (at least 6 characters)<input type="password" minLength={6} maxLength={128} required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></label><button type="button" disabled={busy || !socket.connected || !username || password.length < 6} onClick={() => request({ type: 'login', username, password })}>Sign in</button>{' '}<button type="submit" disabled={busy || !socket.connected}>Create account</button></form><div className="form-divider">OR</div><button type="button" onClick={() => enterGuest()}>Continue as guest</button><p>Guests get every starter deck and can build, play and track cards. Everything is saved on this device only.</p><p role="status">{message}</p></section>;
  if (guest && page === 'account') return <section><h2>Guest account</h2><p role="status">{message}</p><p>You are playing as a guest. Your decks and owned cards are saved on this device only, and are not shared with an account.</p><p>{saved.length} saved decks · {Object.values(owned).reduce((a, b) => a + b, 0)} owned cards</p><button className="primary-button" onClick={() => request({ type: 'logout' })}>Sign in or create an account</button></section>;
  if (page === 'account') return <section><h2>{signedIn}'s account</h2><p role="status">{message}</p><p>Username: {signedIn}</p><form onSubmit={e => { e.preventDefault(); request({ type: 'profile', token, email }); }}><label>Email address<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></label><button disabled={busy || !socket.connected}>Save email address</button></form><p>{saved.length} saved decks · {Object.values(owned).reduce((a, b) => a + b, 0)} owned cards</p><button disabled={busy} onClick={() => request({ type: 'logout', token })}>Sign out</button></section>;
  if (page === 'collection') return <section><p role="status">{message}</p><Collection owned={owned} busy={busy || (!guest && !socket.connected)} update={(cardId, count) => request({ type: 'collection', token, cardId, count })} /></section>;
  if (!editing) return <section className="deck-library-section"><p role="status">{message}</p><DeckLibrary saved={saved} owned={owned} busy={busy || (!guest && !socket.connected)} selected={selected} onEdit={load} onPlay={useDeck} onNew={() => template({ ...structuredClone(riftboundStarters[0].deck), name: 'My new deck', cards: [riftboundStarters[0].deck.champion] })} onTemplate={template} onCollection={() => onNavigate?.('collection')} onResume={hasDraft ? () => setEditing(true) : undefined} /></section>;
  const required = [...deck.cards, ...(deck.runes ?? []), ...(deck.battlefields ?? []), ...(deck.legend ? [deck.legend] : [])];
  const missing = [...new Set(required)].map(cardId => ({ cardId, count: required.filter(id => id === cardId).length - (owned[cardId] ?? 0) })).filter(entry => entry.count > 0);
  const counts = { cards: deck.cards.length, runes: deck.runes?.length ?? 0, battlefields: deck.battlefields?.length ?? 0 };
  const champion = byId[deck.champion ?? ''];
  const row = (target: Zone, cardId: string, n: number) => <li key={cardId}><CardHover cardId={cardId} className="deck-list-row"><CardArt cardId={cardId} preview className="deck-list-thumb" /><span className="deck-list-name">{byId[cardId] ? displayName(byId[cardId]) : cardId}</span>{target === 'cards' && <span className="deck-list-cost">{byId[cardId]?.energy ?? 0}</span>}</CardHover><span className="deck-list-count"><button aria-label={`Remove selected ${cardId}`} disabled={target === 'cards' && cardId === deck.champion && n === 1} onClick={() => changeCount(cardId, -1, target)}>−</button><b>{n}</b><button aria-label={`Add another ${cardId}`} disabled={maxed(target, cardId)} onClick={() => changeCount(cardId, 1, target)}>+</button></span></li>;
  return <section className="deck-editor-section builder">
    <div className="builder-topbar">
      <button className="text-button" onClick={() => setEditing(false)}>← Back to my decks</button>
      <label className="builder-name">Deck name<input value={deck.name} maxLength={60} onChange={e => setDeck({ ...deck, name: e.target.value })} /></label>
      <span className={`builder-status ${errors.length ? 'todo' : 'ready'}`}>{errors.length ? `${errors.length} ${errors.length === 1 ? 'thing' : 'things'} to fix` : '✓ Ready to play'}</span>
      <div className="builder-actions"><button className="primary-button" disabled={busy || !!errors.length || !deck.name.trim()} onClick={() => request({ type: 'save', token, id, deck })}>Save deck</button><button disabled={!!errors.length} onClick={() => { useDeck(deck, id); }}>Use this deck</button><button onClick={() => { setId(undefined); setDeck({ ...structuredClone(deck), name: `${deck.name} copy`.slice(0, 60) }); }}>Make a copy</button></div>
    </div>
    <p role="status" className="builder-message">{message}</p>
    <div className="builder-grid">
      <div className="builder-main">
        <details className="builder-setup" open={!id} key={id ?? 'new'}>
          <summary>{deck.legend && <CardArt cardId={deck.legend} preview className="setup-thumb" />}{deck.champion && <CardArt cardId={deck.champion} preview className="setup-thumb" />}<span><small>LEGEND &amp; CHAMPION</small><b>{legend ? `${legend.tags[0]} - ${displayName(legend)}` : 'Choose a legend'}{champion ? ` · ${displayName(champion)}` : ''}</b></span><em>Change</em></summary>
          <div className="builder-source">
            <label>Saved decks<select value={id ?? ''} onChange={e => { const found = saved.find(d => d.id === e.target.value); if (found) load(found); else { setId(undefined); setDeck(structuredClone(riftboundStarters[0].deck)); } }}><option value="">New deck</option>{saved.filter(d => d.deck.game === 'riftbound').map(d => <option key={d.id} value={d.id}>{d.deck.name}</option>)}</select></label>
            <label>Start from a retail deck<select value="" onChange={e => { const starter = riftboundStarters.find(s => s.id === e.target.value); if (starter) { setId(undefined); setDeck(structuredClone(starter.deck)); } }}><option value="" disabled>Choose a starter template</option>{riftboundStarters.map(s => <option key={s.id} value={s.id}>{s.deck.name}</option>)}</select></label>
            <div className="button-row"><button onClick={() => { setId(undefined); setDeck({ ...structuredClone(riftboundStarters[0].deck), name: 'My new deck', cards: ['OGN-030'] }); }}>Build from scratch</button></div>
          </div>
          <div className="card-picker-pair">
            <CardPicker label="Champion legend" value={deck.legend} options={legends.map(c => ({ id: c.id, label: `${c.tags[0]} - ${displayName(c)}`, detail: `${c.domains.join(' / ')} · ${c.set}` }))} onChange={legendId => { const starter = riftboundStarters.find(s => s.deck.legend === legendId); setDeck({ ...deck, legend: legendId, champion: starter?.deck.champion, cards: starter ? [starter.deck.champion] : [], runes: starter?.deck.runes ?? [], battlefields: starter?.deck.battlefields ?? [] }); }} />
            <CardPicker label="Chosen champion" value={deck.champion} empty="Choose a legend to see its champions." options={champions.map(c => ({ id: c.id, label: displayName(c), detail: `${c.domains.join(' / ')} · Energy ${c.energy} · ${c.id}` }))} onChange={championId => { const next = [...deck.cards]; const old = next.indexOf(deck.champion ?? ''); if (old >= 0) next.splice(old, 1); next.push(championId); setDeck({ ...deck, champion: championId, cards: next }); }} />
          </div>
        </details>
        <div className="zone-tabs" role="tablist" aria-label="Edit zone">{zones.map(([z, label, goal]) => <button key={z} role="tab" aria-selected={zone === z} className={zone === z ? 'active' : ''} onClick={() => setZone(z)}>{label}<b className={counts[z] >= goal ? 'met' : ''}>{counts[z]}/{goal}</b></button>)}</div>
        <div className="builder-filters">
          <label className="builder-search">Search cards<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or ability" /></label>
          {zone === 'cards' && <label>Builder card type<select value={cardType} onChange={e => setCardType(e.target.value)}><option value="all">All types</option>{['unit','spell','gear'].map(t => <option key={t}>{t}</option>)}</select></label>}
          <label>Sort cards<select value={sort} onChange={e => setSort(e.target.value)}><option value="name">Name</option><option value="cost">Energy cost</option></select></label>
          <label className="checkbox"><input type="checkbox" checked={ownedOnly} onChange={e => setOwnedOnly(e.target.checked)} />Only owned cards</label>
        </div>
        <p className="builder-pool-count">{pool.length} {pool.length === 1 ? 'card matches' : 'cards match'} {legend ? `${legend.domains.join(' / ')} domains` : 'your legend'}</p>
        <div className="card-list">{pool.slice(0, limit).map(card => { const count = (deck[zone] ?? []).filter(id => id === card.id).length;
          return <div className={`builder-card ${count ? 'in-deck' : ''}`} key={card.id}><CardArt cardId={card.id} className="builder-thumbnail" /><div className="builder-card-info"><strong>{displayName(card)}</strong><small>{card.types.join('/')} · {card.domains.join('/') || 'colorless'}{zone === 'cards' ? ` · ${card.energy} energy` : ''}{card.types.includes('unit') ? ` · ${card.might} might` : ''}</small></div><div className="count-controls"><button aria-label={`Remove ${card.id}`} disabled={!count} onClick={() => changeCount(card.id, -1)}>−</button><span>{count}<small>{owned[card.id] ?? 0} owned</small></span><button aria-label={`Add ${card.id}`} disabled={maxed(zone, card.id)} onClick={() => changeCount(card.id, 1)}>+</button></div></div>;
        })}{!pool.length && <p className="library-empty">No cards match. Try clearing the search or filters.</p>}</div>{pool.length > limit && <button className="show-more" onClick={() => setLimit(limit + 48)}>Show more cards · {pool.length - limit} left</button>}
      </div>
      <aside className="builder-deck" aria-label="Deck list">
        <h3>{deck.name || 'Untitled deck'}</h3>
        <div className="deck-meters">{zones.map(([z, label, goal]) => <label key={z} className={counts[z] >= goal ? 'met' : ''}><span>{label}<b>{counts[z]}/{goal}</b></span><progress max={goal} value={Math.min(goal, counts[z])} /></label>)}</div>
        {!!errors.length && <ul className="validation" aria-label="Deck validation">{errors.map(error => <li key={error}>{error}</li>)}</ul>}
        <div className="deck-list">
          {cardTypes.map(([type, label]) => { const entries = tally(deck.cards).filter(([cardId]) => byId[cardId]?.types.includes(type)); return entries.length ? <div key={type}><h4>{label}<small>{entries.reduce((n, [, c]) => n + c, 0)}</small></h4><ul>{entries.map(([cardId, n]) => row('cards', cardId, n))}</ul></div> : null; })}
          <div><h4>Runes<small>{counts.runes}</small></h4><ul>{tally(deck.runes ?? []).map(([cardId, n]) => row('runes', cardId, n))}</ul></div>
          <div><h4>Battlefields<small>{counts.battlefields}</small></h4><ul>{tally(deck.battlefields ?? []).map(([cardId, n]) => row('battlefields', cardId, n))}</ul></div>
        </div>
        <details className="missing-cards"><summary>{missing.length ? `${missing.reduce((n, entry) => n + entry.count, 0)} copies missing from your collection` : 'You own all cards in this deck'}</summary><p>Collection counts help plan your physical deck. You can still save and play practice decks.</p><ul>{missing.map(entry => <li key={entry.cardId}>{entry.count}× {byId[entry.cardId] ? displayName(byId[entry.cardId]) : entry.cardId}</li>)}</ul></details>
        {id && <button className="text-button danger" disabled={busy} onClick={() => request({ type: 'delete', token, id })}>Delete saved deck</button>}
      </aside>
    </div>
  </section>;
}
