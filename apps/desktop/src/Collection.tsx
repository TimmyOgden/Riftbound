import React, { useEffect, useState } from 'react';
import { riftboundCards, displayName } from '../../../packages/riftbound-content/src/index.ts';
import { CardArt } from './CardArt.tsx';
import { RuneIcon } from './RuneIcon.tsx';
import './collection.css';
const setNames: Record<string, string> = { OGN: 'Origins', OGS: 'Proving Grounds', SFD: 'Spiritforged', UNL: 'Unleashed', VEN: 'Vendetta', RAD: 'Radiance' };
const domainList = ['fury', 'calm', 'mind', 'body', 'chaos', 'order'];
const collectible = riftboundCards.filter(c => !c.superTypes.includes('token'));
const sets = [...new Set(collectible.map(c => c.set))].sort((a, b) => Object.keys(setNames).indexOf(a) - Object.keys(setNames).indexOf(b));
export function Collection({ owned, busy, update }: { owned: Record<string, number>; busy: boolean; update: (cardId: string, count: number) => void }) {
  const [search, setSearch] = useState(''), [onlyOwned, setOnlyOwned] = useState(false), [type, setType] = useState('all');
  const [set, setSet] = useState('all'), [domains, setDomains] = useState<string[]>([]), [sort, setSort] = useState('number'), [limit, setLimit] = useState(60);
  useEffect(() => { setLimit(60); }, [search, onlyOwned, type, set, domains, sort]);
  const cards = collectible.filter(c => (!onlyOwned || owned[c.id] > 0) && (type === 'all' || c.types.includes(type)) && (set === 'all' || c.set === set) && (!domains.length || c.domains.some(d => domains.includes(d))) && `${displayName(c)} ${c.id} ${c.domains.join(' ')}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sort === 'name' ? displayName(a).localeCompare(displayName(b)) : sort === 'cost' ? a.energy - b.energy || displayName(a).localeCompare(displayName(b)) : sort === 'owned' ? (owned[b.id] ?? 0) - (owned[a.id] ?? 0) || a.id.localeCompare(b.id) : a.id.localeCompare(b.id));
  const total = Object.values(owned).reduce((a, b) => a + b, 0);
  const toggleDomain = (d: string) => setDomains(domains.includes(d) ? domains.filter(x => x !== d) : [...domains, d]);
  return <div className="collection-page">
    <div className="collection-summary">
      <div><h2>Your owned cards</h2><p>Track your physical collection. Saved starter decks do not add owned cards.</p><p className="collection-totals">{total} cards owned · {Object.keys(owned).length} unique cards</p></div>
      <div className="set-progress">{sets.map(s => { const pool = collectible.filter(c => c.set === s), have = pool.filter(c => owned[c.id] > 0).length; return <button key={s} className={set === s ? 'active' : ''} onClick={() => setSet(set === s ? 'all' : s)} aria-pressed={set === s}><span>{setNames[s] ?? s}<b>{have}/{pool.length}</b></span><progress max={pool.length} value={have} /></button>; })}</div>
    </div>
    <div className="collection-toolbar">
      <label className="collection-search">Search collection<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, card number or domain" /></label>
      <label>Set<select value={set} onChange={e => setSet(e.target.value)}><option value="all">All sets</option>{sets.map(s => <option key={s} value={s}>{setNames[s] ?? s}</option>)}</select></label>
      <label>Card type<select value={type} onChange={e => setType(e.target.value)}><option value="all">All types</option>{['unit','spell','gear','legend','rune','battlefield'].map(t => <option key={t}>{t}</option>)}</select></label>
      <label>Sort<select value={sort} onChange={e => setSort(e.target.value)}><option value="number">Card number</option><option value="name">Name</option><option value="cost">Energy cost</option><option value="owned">Most owned</option></select></label>
    </div>
    <div className="collection-chips">{domainList.map(d => <button key={d} className={`domain-chip ${d} ${domains.includes(d) ? 'on' : ''}`} aria-pressed={domains.includes(d)} onClick={() => toggleDomain(d)}><RuneIcon domain={d} />{d}</button>)}<label className="checkbox"><input type="checkbox" checked={onlyOwned} onChange={e => setOnlyOwned(e.target.checked)} />Only owned cards</label><span className="collection-count">{cards.length} cards</span></div>
    <div className="collection-grid">{cards.slice(0, limit).map(c => { const n = owned[c.id] ?? 0; return <article className={`owned-card ${n ? 'have' : 'missing'}`} key={c.id}><CardArt cardId={c.id} /><strong>{displayName(c)}</strong><small>{c.id} · {c.domains.join(' / ') || 'colorless'}</small><div className="count-controls"><button disabled={busy || !n} aria-label={`Own fewer ${c.id}`} onClick={() => update(c.id, n - 1)}>−</button><label><span>Owned</span><input key={`${c.id}-${n}`} aria-label={`Owned copies ${c.id}`} type="number" min="0" max="999" defaultValue={n} disabled={busy} onBlur={e => { const value = Number(e.target.value); if (e.target.value !== '' && Number.isInteger(value) && value >= 0 && value <= 999 && value !== n) update(c.id, value); else e.target.value = String(n); }} /></label><button disabled={busy || n >= 999} aria-label={`Own more ${c.id}`} onClick={() => update(c.id, n + 1)}>+</button></div></article>; })}</div>
    {cards.length > limit && <button className="show-more" onClick={() => setLimit(limit + 60)}>Show more cards · {cards.length - limit} left</button>}
    {!cards.length && <p className="library-empty">No cards match these filters.</p>}
  </div>;
}
