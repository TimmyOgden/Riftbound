import { riftboundCardById as cards, displayName } from '../../riftbound-content/src/index.ts';
import type { Deck } from '../../shared/src/index.ts';
import { validateRiftboundDeck } from '../../game-rules/src/riftbound.ts';
export interface PracticeCard { id: string; cardId: string }
export interface PracticeUnit extends PracticeCard { owner: number; location: number; ready: boolean; bonus: number; buff: boolean; damage: number }
export interface PracticePlayer { name: string; legend: string; legendReady: boolean; spellEnergy: number; scored: number[]; champion?: PracticeCard; hand: PracticeCard[]; deck: PracticeCard[]; trash: PracticeCard[]; runes: { cardId: string; ready: boolean }[]; runeDeck: string[]; score: number }
export interface PracticeEvent { id: number; type: 'play' | 'move' | 'combat' | 'kill' | 'score' | 'activate' | 'draw' | 'turn' | 'damage' | 'rune' | 'notice'; player: number; cardId?: string; unit?: string; field?: number; amount?: number; text: string }
export interface PracticeState { matchId: string; firstPlayer: number; revision: number; turn: number; active: number; players: PracticePlayer[]; units: PracticeUnit[]; fields: { cardId: string; controller?: number }[]; log: string[]; events: PracticeEvent[]; nextEvent: number; nextId: number; winner?: number }
export type PracticeAction = { type: 'end' } | { type: 'play'; card: string; target?: string; other?: string; accelerate?: boolean } | { type: 'move'; unit: string; field: number } | { type: 'activate'; source: string; target?: string };
export const practiceLimitations = 'Practice beta supports Accelerate, Lee Sin/Viktor legend activations, Lux Crownguard spell energy, and once-per-battlefield/final-point scoring. No reaction/chain windows, hidden cards, or complete triggered/activated effects. Combat uses one moving unit at a time and automatic damage assignment. This is not a complete Riftbound rules simulator.';
function event(s: PracticeState, e: Omit<PracticeEvent, 'id'>) { s.events.push({ ...e, id: s.nextEvent++ }); }
const implementedSpells = new Set(['OGN-095','OGN-093','OGN-058','OGN-046','OGN-083','OGN-048','OGN-134','OGN-129','OGN-053','OGN-024','OGN-005','OGN-085','OGS-003','OGS-022','OGS-012','OGN-169','OGN-168','OGN-170','OGS-011','OGS-002','OGN-128','OGS-008','OGN-206','OGS-024','OGN-233','OGS-015','OGN-094']);
export function practiceCardNote(id: string) {
  const c = cards[id];
  if (!c) return 'Unknown card.';
  if (id === 'OGN-257') return 'Supported: pay 1 energy and exhaust this legend to buff a friendly unit. Buffs do not stack. Main-phase activation only; reaction windows remain pending.';
  if (id === 'OGN-265') return 'Supported: pay 1 energy and exhaust this legend to create an exhausted Recruit in base. Main-phase activation only.';
  if (id === 'OGS-014') return 'Supported: exhaust Lux to add 2 energy for spells only, expiring at end of turn. Reaction timing remains pending.';
  if (c.types.includes('spell') && !implementedSpells.has(id)) return 'This spell cannot be played in the practice beta yet.';
  if (c.text) return 'Only basic stats and selected effects are simulated in this beta; full printed ability and timing support is pending.';
  return '';
}
const take = (s: PracticeState, player: number, n: number) => { for (let i = 0; i < n; i++) { const card = s.players[player].deck.shift(); if (card) { s.players[player].hand.push(card); event(s, { type: 'draw', player, cardId: card.cardId, unit: card.id, amount: 1, text: `${s.players[player].name} draws a card.` }); } else if (s.winner === undefined) s.winner = 1 - player; } };
function channel(s: PracticeState, player: number, n: number) { for (let i = 0; i < n; i++) { const cardId = s.players[player].runeDeck.shift(); if (cardId) { s.players[player].runes.push({ cardId, ready: true }); event(s, { type: 'rune', player, cardId, amount: 1, text: `${s.players[player].name} channels ${cards[cardId].name}.` }); } } }
export function createPractice(entrants: { name: string; deck: Deck }[], firstPlayer = 0, matchId = 'practice'): PracticeState {
  if (entrants.length !== 2) throw Error('Practice needs two players.');
  if (firstPlayer !== 0 && firstPlayer !== 1) throw Error('Invalid first player.');
  for (const e of entrants) { const errors = validateRiftboundDeck(e.deck); if (errors.length) throw Error(errors.join(' ')); }
  const s: PracticeState = { matchId, firstPlayer, revision: 0, turn: 1, active: firstPlayer, units: [], fields: entrants.map(e => ({ cardId: e.deck.battlefields![0] })), log: ['Practice beta begins. Open Beta rules for current support.', `${entrants[firstPlayer].name} wins the coin flip and goes first.`], events: [], nextEvent: 1, nextId: 1, players: entrants.map((e, i) => {
    const deck = e.deck.cards.map((cardId, n) => ({ id: `${i}-${n}`, cardId }));
    const index = deck.findIndex(c => c.cardId === e.deck.champion); const champion = deck.splice(index, 1)[0];
    return { name: e.name, legend: e.deck.legend!, legendReady: true, spellEnergy: 0, scored: [], champion, hand: [], deck, trash: [], runes: [], runeDeck: [...e.deck.runes!], score: 0 };
  }) };
  take(s, 0, 4); take(s, 1, 4); channel(s, firstPlayer, 2); take(s, firstPlayer, 1); return s;
}
function cost(s: PracticeState, player: number, cardId: string, accelerate = false) {
  const c = cards[cardId]; let energy = c.energy;
  if (cardId === 'OGN-195') energy = Math.max(0, energy - s.players[player].trash.length);
  if (c.types.includes('spell')) energy = Math.max(1, energy - s.units.filter(u => u.owner === player && u.location >= 0 && u.cardId === 'OGN-084').length);
  return { energy: energy + Number(accelerate), power: c.power + Number(accelerate) };
}
function affordable(s: PracticeState, player: number, cardId: string, accelerate = false) {
  const p = s.players[player], c = cards[cardId], needed = cost(s, player, cardId, accelerate);
  if (c.types.includes('spell')) needed.energy = Math.max(0, needed.energy - p.spellEnergy);
  return p.runes.filter(r => r.ready).length >= needed.energy && p.runes.filter(r => cards[r.cardId].domains.some(d => c.domains.includes(d))).length >= needed.power;
}
export function practiceMight(s: PracticeState, u: PracticeUnit, role?: 'attacker' | 'defender') {
  const card = cards[u.cardId]; let might = card?.might ?? 1;
  might += u.bonus + Number(u.buff);
  if (u.cardId === 'OGN-065' && u.buff) might++;
  if (u.cardId === 'OGS-004' && s.players[u.owner].runes.length >= 8) might += 4;
  if (s.fields[u.location]?.cardId === 'OGN-294') might++;
  might += s.units.filter(v => v.id !== u.id && v.owner === u.owner && v.location === u.location && v.cardId === 'OGS-013').length;
  if (u.buff && u.location >= 0) might += 2 * s.units.filter(v => v.id !== u.id && v.owner === u.owner && v.location === u.location && v.cardId === 'OGN-151').length;
  const peers = s.units.filter(v => v.owner === u.owner && v.location === u.location);
  if (role && peers.length === 1 && u.cardId === 'OGN-055') might += 2;
  if (role === 'defender' && peers.length === 1 && s.players[u.owner].legend === 'OGS-019') might += 2;
  const keyword = role === 'attacker' ? 'Assault' : role === 'defender' ? 'Shield' : undefined;
  if (keyword) { const match = card?.text.match(new RegExp(`\\[${keyword}(?: (\\d+))?\\]`)); if (match) might += Number(match[1] ?? 1); }
  return Math.max(1, might);
}
function pay(s: PracticeState, player: number, cardId: string, accelerate = false) {
  const p = s.players[player], c = cards[cardId], needed = cost(s, player, cardId, accelerate);
  if (c.types.includes('spell')) { const spend = Math.min(needed.energy, p.spellEnergy); needed.energy -= spend; p.spellEnergy -= spend; }
  for (let i = 0; i < needed.energy; i++) p.runes.find(r => r.ready)!.ready = false;
  for (let i = 0; i < needed.power; i++) {
    const index = p.runes.findIndex(r => !r.ready && cards[r.cardId].domains.some(d => c.domains.includes(d)));
    const chosen = index >= 0 ? index : p.runes.findIndex(r => cards[r.cardId].domains.some(d => c.domains.includes(d)));
    p.runeDeck.push(p.runes.splice(chosen, 1)[0].cardId);
  }
}
const spellTargets = (id: string) => ['OGN-095','OGN-093','OGN-058','OGN-046','OGN-053','OGN-024','OGN-005','OGN-085','OGS-003','OGS-022','OGS-012','OGN-169','OGN-168','OGS-011','OGN-128','OGS-008','OGN-206'].includes(id);
export function practiceReason(s: PracticeState, player: number, a: PracticeAction): string | undefined {
  if (s.winner !== undefined) return 'Practice is complete.';
  if (s.active !== player) return 'Wait for your turn.';
  if (a.type === 'end') return;
  if (a.type === 'activate') {
    const p = s.players[player];
    if (a.source === 'legend') {
      if (!['OGN-257', 'OGN-265'].includes(p.legend)) return 'This legend ability is not supported yet.';
      if (!p.legendReady) return 'Your legend is exhausted.';
      if (!p.runes.some(r => r.ready)) return 'This ability costs 1 energy.';
      if (p.legend === 'OGN-257' && !s.units.some(u => u.id === a.target && u.owner === player)) return 'Choose a friendly unit.';
    } else {
      const u = s.units.find(u => u.id === a.source);
      if (!u || u.owner !== player || u.cardId !== 'OGS-014') return 'This unit ability is not supported yet.';
      if (!u.ready) return 'This unit is exhausted.';
    }
    return;
  }
  if (a.type === 'move') {
    const unit = s.units.find(u => u.id === a.unit);
    if (!unit || unit.owner !== player || !unit.ready) return 'Choose one of your ready units.';
    if (!Number.isInteger(a.field) || a.field < -1 || a.field >= s.fields.length || unit.location === a.field) return 'Choose a different location.';
    if (unit.location >= 0 && a.field >= 0 && !cards[unit.cardId]?.text.includes('[Ganking]')) return 'This unit must move through base.';
    return;
  }
  const p = s.players[player], instance = [...p.hand, ...(p.champion ? [p.champion] : [])].find(c => c.id === a.card);
  if (!instance) return 'Card is not in your hand or champion zone.';
  const c = cards[instance.cardId];
  if (a.accelerate && (!c.types.includes('unit') || !c.text.includes('[Accelerate]'))) return 'This card does not have Accelerate.';
  if (!affordable(s, player, c.id, a.accelerate)) return 'Insufficient runes for the energy and power costs.';
  if (c.types.includes('spell') && !implementedSpells.has(c.id)) return 'This spell is not implemented in the practice beta.';
  const target = s.units.find(u => u.id === a.target), other = s.units.find(u => u.id === a.other);
  if (c.types.includes('spell') && spellTargets(c.id)) {
    if (!target) return 'Choose a unit target.';
    if (['OGN-046','OGN-053','OGS-011','OGN-128','OGS-008','OGN-206'].includes(c.id) && target.owner !== player) return 'Choose a friendly unit.';
    if (['OGN-024','OGN-005','OGN-085','OGS-003','OGS-012','OGN-169','OGN-168'].includes(c.id) && target.location < 0) return 'Choose a unit at a battlefield.';
    if (c.id === 'OGN-169' && practiceMight(s, target) > 3) return 'Gust needs a target with 3 might or less.';
    if (['OGN-128','OGS-008'].includes(c.id) && (!other || other.owner === player)) return 'Choose an enemy unit as the second target.';
    if (c.id === 'OGN-206' && (!other || other.owner !== player || other.id === target.id)) return 'Choose two different friendly units.';
  }
  if (c.id === 'OGS-002' && (!target || target.location < 0)) return 'Choose a battlefield unit for Firestorm.';
  if (c.id === 'OGN-170' && !p.trash.some(card => cards[card.cardId].types.includes('unit'))) return 'No units in your trash.';
}
function token(s: PracticeState, owner: number, might: number, location = -1, ready = false) { s.units.push({ id: `token-${s.nextId++}`, cardId: might === 1 ? 'recruit' : 'sprite', owner, location, ready, bonus: might - 1, buff: false, damage: 0 }); }
function kill(s: PracticeState, unit: PracticeUnit) { s.units = s.units.filter(u => u.id !== unit.id); if (cards[unit.cardId]) s.players[unit.owner].trash.push({ id: unit.id, cardId: unit.cardId }); event(s, { type: 'kill', player: unit.owner, unit: unit.id, cardId: unit.cardId, field: unit.location, text: `${cards[unit.cardId]?.name ?? 'Token'} leaves the table` }); }
function cleanup(s: PracticeState) {
  for (const u of [...s.units]) if (u.damage > 0 && u.damage >= practiceMight(s, u)) kill(s, u);
  for (let i = 0; i < s.fields.length; i++) {
    const owners = [...new Set(s.units.filter(u => u.location === i).map(u => u.owner))];
    if (!owners.length) s.fields[i].controller = undefined;
    else if (owners.length === 1 && s.winner === undefined) conquer(s, i, owners[0]);
  }
}
function damage(s: PracticeState, source: number, u: PracticeUnit, amount: number) { const extra = s.units.filter(v => v.owner === source && v.cardId === 'OGS-001').length + Number(s.fields[u.location]?.cardId === 'OGN-296'); u.damage += amount + extra; event(s, { type: 'damage', player: source, unit: u.id, field: u.location, amount: amount + extra, text: `${amount + extra} damage` }); }
function scoreField(s: PracticeState, field: number, player: number, method: 'conquers' | 'holds') {
  const p = s.players[player]; if (p.scored.includes(field)) return;
  p.scored.push(field);
  const drawsInstead = method === 'conquers' && p.score >= 7 && p.scored.length < s.fields.length;
  if (drawsInstead) take(s, player, 1); else p.score++;
  const text = `${p.name} ${method} ${cards[s.fields[field].cardId].name}${drawsInstead ? ': draws a card (final-point restriction).' : ' for 1 point.'}`;
  s.log.push(text); event(s, { type: drawsInstead ? 'notice' : 'score', player, field, amount: 1, text });
  if (p.score >= 8) s.winner = player;
}
function conquer(s: PracticeState, field: number, player: number) { const f = s.fields[field]; if (f.controller === player || !s.units.some(u => u.location === field && u.owner === player)) return; f.controller = player; scoreField(s, field, player, 'conquers'); }
export function practiceTransition(state: PracticeState, player: number, action: PracticeAction): PracticeState {
  const error = practiceReason(state, player, action); if (error) throw Error(error);
  const s = structuredClone(state), p = s.players[player]; s.revision++;
  if (action.type === 'activate') {
    let cardId = p.legend;
    if (action.source === 'legend') {
      p.runes.find(r => r.ready)!.ready = false; p.legendReady = false;
      if (p.legend === 'OGN-265') token(s, player, 1);
      else s.units.find(u => u.id === action.target)!.buff = true;
    } else { const u = s.units.find(u => u.id === action.source)!; u.ready = false; p.spellEnergy += 2; cardId = u.cardId; }
    const text = `${p.name} activates ${displayName(cards[cardId])}.`;
    s.log.push(text); event(s, { type: 'activate', player, cardId, unit: action.target ?? action.source, text });
  } else if (action.type === 'play') {
    const instance = [...p.hand, ...(p.champion ? [p.champion] : [])].find(c => c.id === action.card)!;
    const c = cards[instance.cardId]; pay(s, player, c.id, action.accelerate);
    if (p.champion?.id === instance.id) p.champion = undefined; else p.hand = p.hand.filter(card => card.id !== instance.id);
    const target = s.units.find(u => u.id === action.target), other = s.units.find(u => u.id === action.other);
    s.log.push(`${p.name} plays ${displayName(c)}.`);
    event(s, { type: 'play', player, cardId: c.id, unit: instance.id, text: `${p.name} plays ${displayName(c)}${action.accelerate ? ' — Accelerated' : ''}` });
    if (c.types.includes('unit')) {
      const u: PracticeUnit = { ...instance, owner: player, location: -1, ready: !!action.accelerate || c.text.includes('I enter ready.') || s.log.includes(`confront:${s.turn}:${player}`), bonus: 0, buff: false, damage: 0 }; s.units.push(u);
      if (c.id === 'OGN-087') take(s, player, 1);
      if (c.id === 'OGN-137') { channel(s, player, 1); const rune = p.runes.at(-1); if (rune) rune.ready = false; }
      if (c.id === 'OGN-211') token(s, player, 1);
    } else {
      p.trash.push(instance);
      if (c.id === 'OGN-182') take(s, player, 1);
      if (['OGN-083','OGN-048'].includes(c.id)) take(s, player, c.id === 'OGN-083' ? 2 : 1);
      if (c.id === 'OGN-134') { if (p.runeDeck.length) { channel(s, player, 1); p.runes.at(-1)!.ready = false; } else take(s, player, 1); }
      if (c.id === 'OGN-129') { s.log.push(`confront:${s.turn}:${player}`); take(s, player, 1); }
      if (target) {
        if (['OGN-095','OGN-093'].includes(c.id)) target.bonus -= Math.min(practiceMight(s, target) - 1, c.id === 'OGN-095' ? 1 : 4);
        if (['OGN-058','OGN-046'].includes(c.id)) target.bonus += c.id === 'OGN-058' ? 2 : s.units.filter(u => u.owner === player && u.location === target.location).length === 1 ? 2 : 1;
        if (['OGN-095','OGN-058','OGN-024'].includes(c.id)) take(s, player, 1);
        if (c.id === 'OGN-053') target.buff = true;
        const hits: Record<string, number> = { 'OGN-024': 4, 'OGN-005': 3, 'OGN-085': 6, 'OGS-003': 2, 'OGS-022': 8 };
        if (hits[c.id]) { damage(s, player, target, hits[c.id]); if (c.id === 'OGN-005' && target.damage >= practiceMight(s, target)) take(s, player, 1); }
        if (c.id === 'OGS-012') kill(s, target);
        if (c.id === 'OGN-169') { kill(s, target); const q = s.players[target.owner]; const returned = q.trash.pop(); if (returned) q.hand.push(returned); }
        if (['OGN-168','OGS-011'].includes(c.id)) target.location = -1;
        if (['OGN-128','OGS-008'].includes(c.id) && other) { if (c.id === 'OGS-008') target.bonus += 3; const a = practiceMight(s, target), b = practiceMight(s, other); damage(s, player, other, a); damage(s, player, target, b); }
        if (c.id === 'OGN-206' && other) { target.bonus += 2; other.bonus += 2; }
        if (c.id === 'OGS-002') for (const u of s.units.filter(u => u.owner !== player && u.location === target.location)) damage(s, player, u, 3);
      }
      if (['OGS-024','OGN-233'].includes(c.id)) for (const u of s.units.filter(u => u.owner === player)) u.bonus += c.id === 'OGS-024' ? 2 : 5;
      if (c.id === 'OGS-015') for (let i = 0; i < 4; i++) token(s, player, 1);
      if (c.id === 'OGN-094') token(s, player, 3, -1, true);
      if (c.id === 'OGN-170') { const index = p.trash.findIndex(card => cards[card.cardId].types.includes('unit')); if (index >= 0) p.hand.push(p.trash.splice(index, 1)[0]); }
    }
    cleanup(s);
  } else if (action.type === 'move') {
    const u = s.units.find(u => u.id === action.unit)!; u.location = action.field; u.ready = false;
    s.log.push(`${p.name} moves ${cards[u.cardId] ? displayName(cards[u.cardId]) : u.cardId} to ${action.field < 0 ? 'base' : cards[s.fields[action.field].cardId].name}.`);
    event(s, { type: 'move', player, unit: u.id, cardId: u.cardId, field: action.field, text: `${p.name} moves ${cards[u.cardId]?.name ?? 'Token'}` });
    if (u.cardId === 'OGN-222' && action.field >= 0) token(s, player, 1, action.field);
    if (action.field >= 0) {
      const defenders = s.units.filter(v => v.owner !== player && v.location === action.field);
      if (defenders.length) {
        event(s, { type: 'combat', player, field: action.field, text: `Combat at ${cards[s.fields[action.field].cardId].name}` });
        let attack = practiceMight(s, u, 'attacker'); const defense = defenders.reduce((sum, v) => sum + practiceMight(s, v, 'defender'), 0);
        for (const v of [...defenders].sort((a, b) => Number(cards[b.cardId]?.text.includes('[Tank]')) - Number(cards[a.cardId]?.text.includes('[Tank]')) || practiceMight(s, a, 'defender') - practiceMight(s, b, 'defender'))) { const assigned = Math.min(attack, Math.max(0, practiceMight(s, v, 'defender') - v.damage)); v.damage += assigned; if (assigned) event(s, { type: 'damage', player, unit: v.id, field: action.field, amount: assigned, text: `${assigned} combat damage` }); attack -= assigned; if (v.damage >= practiceMight(s, v, 'defender')) kill(s, v); }
        u.damage += defense; event(s, { type: 'damage', player: 1 - player, unit: u.id, field: action.field, amount: defense, text: `${defense} combat damage` }); if (u.damage >= practiceMight(s, u, 'attacker')) kill(s, u);
        s.log.push('Combat resolved using the practice beta combat model.');
        s.units.filter(v => v.location === action.field).forEach(v => v.damage = 0);
      }
      cleanup(s); if (!s.units.some(v => v.owner !== player && v.location === action.field)) conquer(s, action.field, player);
    } else cleanup(s);
  } else {
    s.log.push(`${p.name} ends their turn.`);
    for (const u of s.units) { u.bonus = 0; u.damage = 0; }
    s.active = 1 - player; s.turn++;
    p.spellEnergy = 0;
    s.players.forEach(p => p.scored = []);
    const next = s.players[s.active]; next.legendReady = true; next.runes.forEach(r => r.ready = true); s.units.filter(u => u.owner === s.active).forEach(u => u.ready = true);
    for (let field = 0; field < s.fields.length && s.winner === undefined; field++) if (s.fields[field].controller === s.active) scoreField(s, field, s.active, 'holds');
    event(s, { type: 'turn', player: s.active, text: `${next.name}'s turn` });
    if (s.winner !== undefined) return s;
    if (next.legend === 'OGN-251' && next.hand.length <= 1) take(s, s.active, 1);
    channel(s, s.active, s.turn === 2 ? 3 : 2); take(s, s.active, 1);
  }
  if (s.log.length > 160) s.log = s.log.slice(-160);
  if (s.events.length > 200) s.events = s.events.slice(-200);
  return s;
}
export function practiceActions(s: PracticeState, player: number): PracticeAction[] {
  if (s.active !== player || s.winner !== undefined) return [];
  const p = s.players[player], actions: PracticeAction[] = [{ type: 'end' }];
  for (const card of [...p.hand, ...(p.champion ? [p.champion] : [])]) {
    const c = cards[card.cardId];
    const targets = spellTargets(c.id) || c.id === 'OGS-002' ? s.units.map(u => u.id) : [undefined];
    const others = ['OGN-128','OGS-008','OGN-206'].includes(c.id) ? s.units.map(u => u.id) : [undefined];
    for (const target of targets) for (const other of others) for (const accelerate of c.text.includes('[Accelerate]') ? [false, true] : [false]) { const a: PracticeAction = { type: 'play', card: card.id, target, other, accelerate }; if (!practiceReason(s, player, a)) actions.push(a); }
  }
  const abilities: PracticeAction[] = [{ type: 'activate', source: 'legend' }, ...s.units.filter(u => u.owner === player).flatMap(u => [{ type: 'activate' as const, source: 'legend', target: u.id }, { type: 'activate' as const, source: u.id }])];
  actions.push(...abilities.filter(a => !practiceReason(s, player, a)));
  for (const u of s.units.filter(u => u.owner === player)) for (let field = -1; field < s.fields.length; field++) { const a: PracticeAction = { type: 'move', unit: u.id, field }; if (!practiceReason(s, player, a)) actions.push(a); }
  return actions;
}
export function practiceProject(s: PracticeState, player: number) { return { ...s, events: s.events.map(e => e.type === 'draw' && e.player !== player ? { ...e, cardId: undefined, unit: undefined } : e), players: s.players.map((p, i) => ({ name: p.name, legend: p.legend, legendReady: p.legendReady, spellEnergy: p.spellEnergy, scored: p.scored, champion: p.champion, hand: i === player ? p.hand : undefined, handCount: p.hand.length, deckCount: p.deck.length, runeDeckCount: p.runeDeck.length, runes: p.runes, trash: p.trash, score: p.score })), legal: practiceActions(s, player), limitations: practiceLimitations }; }
export type PracticeView = ReturnType<typeof practiceProject>;
