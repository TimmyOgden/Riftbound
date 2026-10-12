import { riftboundCardById as cards, displayName } from '../../riftbound-content/src/index.ts';
import type { Deck } from '../../shared/src/index.ts';
import { validateRiftboundDeck } from '../../game-rules/src/riftbound.ts';
export interface PracticeCard { id: string; cardId: string }
export interface PracticeUnit extends PracticeCard { owner: number; location: number; ready: boolean; bonus: number; buff: boolean; damage: number; stunned?: boolean; ganking?: boolean; usedAbilities?: string[] }
export interface PracticePlayer { name: string; legend: string; legendReady: boolean; spellEnergy: number; scored: number[]; champion?: PracticeCard; hand: PracticeCard[]; deck: PracticeCard[]; trash: PracticeCard[]; runes: { cardId: string; ready: boolean }[]; runeDeck: string[]; score: number; deathsThisTurn?: number }
export interface PracticeEvent { id: number; type: 'play' | 'move' | 'combat' | 'kill' | 'score' | 'activate' | 'draw' | 'turn' | 'damage' | 'rune' | 'notice'; player: number; cardId?: string; unit?: string; field?: number; amount?: number; text: string }
export interface ChainItem { player: number; card?: PracticeCard; action: Extract<PracticeAction, { type: 'play' | 'activate' }>; cardId: string }
export interface Showdown { field: number; attacker: number; focus: number; passes: number; step: 'showdown' | 'assign'; assignments: { unit: string; amount: number }[][] }
export interface PracticeTask { player: number; type: 'discard' | 'retrieve'; count: number; cardId: string }
export interface PracticeState { interactive?: boolean; priority?: number; passes?: number; chain?: ChainItem[]; showdown?: Showdown; task?: PracticeTask; matchId: string; firstPlayer: number; revision: number; turn: number; active: number; players: PracticePlayer[]; units: PracticeUnit[]; fields: { cardId: string; controller?: number }[]; log: string[]; events: PracticeEvent[]; nextEvent: number; nextId: number; winner?: number }
export type PracticeAction = { type: 'pass' } | { type: 'group-move'; units: string[]; field: number } | { type: 'assign'; order: string[] } | { type: 'discard'; cards: string[] } | { type: 'retrieve'; card: string } | { type: 'end' } | { type: 'play'; card: string; target?: string; other?: string; accelerate?: boolean; exhaust?: string } | { type: 'move'; unit: string; field: number } | { type: 'activate'; source: string; target?: string; mode?: 'damage' | 'stun' | 'ready' | 'ganking' };
export const practiceLimitations = 'Interactive beta adds Reaction chains, showdown windows, group movement, chosen combat damage order, and selected card triggers. Hidden cards, equipment, many card abilities, and four-player play remain unsupported. This is a rules subset, not a complete Riftbound simulator.';
function event(s: PracticeState, e: Omit<PracticeEvent, 'id'>) { s.events.push({ ...e, id: s.nextEvent++ }); }
const implementedSpells = new Set(['OGN-095','OGN-093','OGN-058','OGN-046','OGN-083','OGN-048','OGN-134','OGN-129','OGN-053','OGN-024','OGN-005','OGN-085','OGS-003','OGS-022','OGS-012','OGN-169','OGN-168','OGN-170','OGS-011','OGS-002','OGN-128','OGS-008','OGN-206','OGS-024','OGN-233','OGS-015','OGN-094','OGN-105']);
export function practiceCardNote(id: string) {
  const c = cards[id];
  if (!c) return 'Unknown card.';
  if (id === 'OGN-157') return 'Interactive beta: spend a buff for damage, Stun, ready, or Ganking; each option once per turn. Main-phase activation.';
  if (practiceSupport(id) === 'Supported') return 'Printed effects are implemented in interactive beta. Trigger ordering remains simplified.';
  if (c.types.includes('gear')) return 'Equipment cannot be played in this beta. Its printed effects are not simulated.';
  if (c.types.includes('spell') && !implementedSpells.has(id)) return 'This spell cannot be played in the practice beta yet.';
  if (c.text) return 'Only basic stats and selected effects are simulated in this beta; full printed ability and timing support is pending.';
  return '';
}
const take = (s: PracticeState, player: number, n: number) => { for (let i = 0; i < n; i++) { const card = s.players[player].deck.shift(); if (card) { s.players[player].hand.push(card); event(s, { type: 'draw', player, cardId: card.cardId, unit: card.id, amount: 1, text: `${s.players[player].name} draws a card.` }); } else if (s.winner === undefined) s.winner = 1 - player; } };
function channel(s: PracticeState, player: number, n: number) { for (let i = 0; i < n; i++) { const cardId = s.players[player].runeDeck.shift(); if (cardId) { s.players[player].runes.push({ cardId, ready: true }); event(s, { type: 'rune', player, cardId, amount: 1, text: `${s.players[player].name} channels ${cards[cardId].name}.` }); } } }
export function createPractice(entrants: { name: string; deck: Deck }[], firstPlayer = 0, matchId = 'practice', interactive = false): PracticeState {
  if (entrants.length !== 2) throw Error('Practice needs two players.');
  if (firstPlayer !== 0 && firstPlayer !== 1) throw Error('Invalid first player.');
  for (const e of entrants) { const errors = validateRiftboundDeck(e.deck); if (errors.length) throw Error(errors.join(' ')); }
  const s: PracticeState = { interactive, chain: [], matchId, firstPlayer, revision: 0, turn: 1, active: firstPlayer, units: [], fields: entrants.map(e => ({ cardId: e.deck.battlefields![0] })), log: ['Practice beta begins. Open Beta rules for current support.', `${entrants[firstPlayer].name} wins the coin flip and goes first.`], events: [], nextEvent: 1, nextId: 1, players: entrants.map((e, i) => {
    const deck = e.deck.cards.map((cardId, n) => ({ id: `${i}-${n}`, cardId }));
    const index = deck.findIndex(c => c.cardId === e.deck.champion); const champion = deck.splice(index, 1)[0];
    return { name: e.name, legend: e.deck.legend!, legendReady: true, spellEnergy: 0, scored: [], champion, hand: [], deck, trash: [], runes: [], runeDeck: [...e.deck.runes!], score: 0 };
  }) };
  take(s, 0, 4); take(s, 1, 4); channel(s, firstPlayer, 2); take(s, firstPlayer, 1); return s;
}
export function practiceCost(s: PracticeState, player: number, cardId: string, accelerate = false) {
  const c = cards[cardId]; let energy = c.energy;
  if (cardId === 'OGN-195') energy = Math.max(0, energy - s.players[player].trash.length);
  if (c.types.includes('spell')) energy = Math.max(1, energy - s.units.filter(u => u.owner === player && u.location >= 0 && u.cardId === 'OGN-084').length);
  return { energy: energy + Number(accelerate), power: c.power + Number(accelerate) };
}
function affordable(s: PracticeState, player: number, cardId: string, accelerate = false) {
  const p = s.players[player], c = cards[cardId], needed = practiceCost(s, player, cardId, accelerate);
  if (c.types.includes('spell')) needed.energy = Math.max(0, needed.energy - p.spellEnergy);
  return p.runes.filter(r => r.ready).length >= needed.energy && p.runes.filter(r => cards[r.cardId].domains.some(d => c.domains.includes(d))).length >= needed.power;
}
export function practiceMight(s: PracticeState, u: PracticeUnit, role?: 'attacker' | 'defender') {
  if (!role && s.showdown?.field === u.location) role = combatRole(s, u.owner);
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
  const p = s.players[player], c = cards[cardId], needed = practiceCost(s, player, cardId, accelerate);
  if (c.types.includes('spell')) { const spend = Math.min(needed.energy, p.spellEnergy); needed.energy -= spend; p.spellEnergy -= spend; }
  for (let i = 0; i < needed.energy; i++) p.runes.find(r => r.ready)!.ready = false;
  for (let i = 0; i < needed.power; i++) {
    const index = p.runes.findIndex(r => !r.ready && cards[r.cardId].domains.some(d => c.domains.includes(d)));
    const chosen = index >= 0 ? index : p.runes.findIndex(r => cards[r.cardId].domains.some(d => c.domains.includes(d)));
    p.runeDeck.push(p.runes.splice(chosen, 1)[0].cardId);
  }
}
const spellTargets = (id: string) => ['OGN-095','OGN-093','OGN-058','OGN-046','OGN-053','OGN-024','OGN-005','OGN-085','OGS-003','OGS-022','OGS-012','OGN-169','OGN-168','OGS-011','OGN-128','OGS-008','OGN-206','OGN-105'].includes(id);
export function practiceReason(s: PracticeState, player: number, a: PracticeAction): string | undefined {
  if (s.winner !== undefined) return 'Practice is complete.';
  if (s.interactive) {
    const timing = interactiveReason(s, player, a); if (timing) return timing;
    if (['pass', 'group-move', 'assign', 'discard', 'retrieve'].includes(a.type)) return;
  } else if (['pass', 'group-move', 'assign', 'discard', 'retrieve'].includes(a.type)) return 'This older engine state does not support this action.';
  if (!s.interactive && s.active !== player) return 'Wait for your turn.';
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
      if (!u || u.owner !== player) return 'Choose your unit.';
      if (s.interactive && u.cardId === 'OGN-157') {
        if (!u.buff) return 'Udyr must spend his buff to activate.';
        if (!a.mode) return 'Choose an Udyr ability.';
        if (u.usedAbilities?.includes(a.mode)) return 'That Udyr ability has already been chosen this turn.';
        if (['damage', 'stun'].includes(a.mode) && !s.units.some(v => v.id === a.target && v.location >= 0)) return 'Choose a unit at a battlefield.';
      } else { if (u.cardId !== 'OGS-014') return 'This unit ability is not supported yet.'; if (!u.ready) return 'This unit is exhausted.'; }
    }
    return;
  }
  if (a.type === 'move') {
    const unit = s.units.find(u => u.id === a.unit);
    if (!unit || unit.owner !== player || !unit.ready) return 'Choose one of your ready units.';
    if (!Number.isInteger(a.field) || a.field < -1 || a.field >= s.fields.length || unit.location === a.field) return 'Choose a different location.';
    if (unit.location >= 0 && a.field >= 0 && !(unit.ganking || cards[unit.cardId]?.text.includes('[Ganking]') && (unit.cardId !== 'OGN-125' || unit.buff))) return 'This unit must move through base.';
    return;
  }
  if (a.type !== 'play') return 'Unknown action.';
  const p = s.players[player], instance = [...p.hand, ...(p.champion ? [p.champion] : [])].find(c => c.id === a.card);
  if (!instance) return 'Card is not in your hand or champion zone.';
  const c = cards[instance.cardId];
  if (c.types.includes('gear')) return 'Equipment is not supported in this beta.';
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
    if (c.id === 'OGN-105' && a.other && (!other || other.id === target.id)) return 'Choose a different second unit.';
    if (c.id === 'OGN-206' && (!other || other.owner !== player || other.id === target.id)) return 'Choose two different friendly units.';
  }
  if (c.id === 'OGS-002' && (!target || target.location < 0)) return 'Choose a battlefield unit for Firestorm.';
  if (a.exhaust && (c.id !== 'OGN-048' || !s.units.some(u => u.id === a.exhaust && u.owner === player && u.ready))) return 'Choose a ready friendly unit for Meditation.';
  if (c.id === 'OGS-011' && a.other && (!other || other.owner !== player || other.id === target?.id)) return 'Choose a different friendly unit for Flash.';
  if (c.id === 'OGN-170' && !p.trash.some(card => cards[card.cardId].types.includes('unit'))) return 'No units in your trash.';
}
function token(s: PracticeState, owner: number, might: number, location = -1, ready = false) { s.units.push({ id: `token-${s.nextId++}`, cardId: might === 1 ? 'recruit' : 'sprite', owner, location, ready, bonus: might - 1, buff: false, damage: 0 }); }
function kill(s: PracticeState, unit: PracticeUnit) {
  const first = !s.players[unit.owner].deathsThisTurn;
  s.players[unit.owner].deathsThisTurn = (s.players[unit.owner].deathsThisTurn ?? 0) + 1;
  if (s.interactive && first) take(s, unit.owner, s.units.filter(u => u.owner === unit.owner && u.cardId === 'OGN-118').length);
 s.units = s.units.filter(u => u.id !== unit.id); if (cards[unit.cardId]) s.players[unit.owner].trash.push({ id: unit.id, cardId: unit.cardId }); event(s, { type: 'kill', player: unit.owner, unit: unit.id, cardId: unit.cardId, field: unit.location, text: `${cards[unit.cardId]?.name ?? 'Token'} leaves the table` }); }
function cleanup(s: PracticeState) {
  for (const u of [...s.units]) if (u.damage > 0 && u.damage >= practiceMight(s, u)) kill(s, u);
  for (let i = 0; i < s.fields.length; i++) {
    if (s.interactive && s.showdown?.field === i) continue;
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
function conquer(s: PracticeState, field: number, player: number) { const f = s.fields[field]; if (f.controller === player || !s.units.some(u => u.location === field && u.owner === player)) return; f.controller = player; scoreField(s, field, player, 'conquers'); if (s.interactive && s.players[player].legend === 'OGS-023' && s.units.filter(u => u.owner === player && u.location === field).length >= 4) take(s, player, 2); }
export function practiceTransition(state: PracticeState, player: number, action: PracticeAction): PracticeState {
  const error = practiceReason(state, player, action); if (error) throw Error(error);
  if (state.interactive) return interactiveTransition(state, player, action);
  const s = structuredClone(state), p = s.players[player]; s.revision++;
  if (action.type === 'activate') {
    payAbility(s, player, action);
    resolveAbility(s, player, action);
  } else if (action.type === 'play') {
    const instance = [...p.hand, ...(p.champion ? [p.champion] : [])].find(c => c.id === action.card)!;
    const c = cards[instance.cardId]; pay(s, player, c.id, action.accelerate);
    if (p.champion?.id === instance.id) p.champion = undefined; else p.hand = p.hand.filter(card => card.id !== instance.id);
    if (action.exhaust) s.units.find(u => u.id === action.exhaust)!.ready = false;
    recordPlay(s, player, instance, action);
    resolvePlay(s, player, instance, action);
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
  } else if (action.type === 'end') {
    s.log.push(`${p.name} ends their turn.`);
    for (const u of s.units) { u.bonus = 0; u.damage = 0; u.stunned = false; u.ganking = false; u.usedAbilities = []; }
    s.active = 1 - player; s.turn++;
    p.spellEnergy = 0;
    s.players.forEach(p => { p.scored = []; p.deathsThisTurn = 0; });
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
  if (practiceActor(s) !== player || s.winner !== undefined) return [];
  if (s.interactive && s.task) {
    const p = s.players[player];
    return s.task.type === 'discard' ? [{ type: 'discard', cards: p.hand.slice(0, Math.min(s.task.count, p.hand.length)).map(c => c.id) }] : p.trash.filter(c => cards[c.cardId].types.includes('spell')).map(c => ({ type: 'retrieve', card: c.id }));
  }
  if (s.interactive && s.showdown?.step === 'assign') return [{ type: 'assign', order: combatTargets(s, player).map(u => u.id) }];
  const p = s.players[player], actions: PracticeAction[] = s.interactive && (s.chain?.length || s.showdown) ? [{ type: 'pass' }] : [{ type: 'end' }];
  for (const card of [...p.hand, ...(p.champion ? [p.champion] : [])]) {
    const c = cards[card.cardId];
    const targets = spellTargets(c.id) || c.id === 'OGS-002' ? s.units.map(u => u.id) : [undefined];
    const others = ['OGN-128','OGS-008','OGN-206'].includes(c.id) ? s.units.map(u => u.id) : [undefined];
    for (const target of targets) for (const other of others) for (const accelerate of c.text.includes('[Accelerate]') ? [false, true] : [false]) { const a: PracticeAction = { type: 'play', card: card.id, target, other, accelerate }; if (!practiceReason(s, player, a)) actions.push(a); }
  }
  const abilities: PracticeAction[] = [{ type: 'activate', source: 'legend' }, ...s.units.filter(u => u.owner === player).flatMap(u => [{ type: 'activate' as const, source: 'legend', target: u.id }, { type: 'activate' as const, source: u.id }])];
  if (s.interactive) for (const u of s.units.filter(u => u.owner === player && u.cardId === 'OGN-157')) for (const mode of ['damage','stun','ready','ganking'] as const) {
    const targets = mode === 'damage' || mode === 'stun' ? s.units.filter(v => v.location >= 0).map(v => v.id) : [undefined];
    for (const target of targets) abilities.push({ type: 'activate', source: u.id, mode, target });
  }
  actions.push(...abilities.filter(a => !practiceReason(s, player, a)));
  for (const u of s.units.filter(u => u.owner === player)) for (let field = -1; field < s.fields.length; field++) { const a: PracticeAction = { type: 'move', unit: u.id, field }; if (!practiceReason(s, player, a)) actions.push(a); }
  if (s.interactive && !s.chain?.length && !s.showdown && !s.task) for (const origin of [-1, 0, 1]) {
    const units = s.units.filter(u => u.owner === player && u.ready && u.location === origin).map(u => u.id);
    if (units.length > 1) for (const field of [-1, 0, 1]) { const action: PracticeAction = { type: 'group-move', units, field }; if (!practiceReason(s, player, action)) actions.push(action); }
  }
  if (s.interactive) for (const a of [...actions]) if (a.type === 'play') {
    const c = p.hand.find(c => c.id === a.card);
    if (c?.cardId === 'OGN-048') for (const u of s.units.filter(u => u.owner === player && u.ready)) actions.push({ ...a, exhaust: u.id });
    if (c?.cardId === 'OGN-105') for (const u of s.units.filter(u => u.id !== a.target)) actions.push({ ...a, other: u.id });
    if (c?.cardId === 'OGS-011') for (const u of s.units.filter(u => u.owner === player && u.id !== a.target)) actions.push({ ...a, other: u.id });
  }
  return actions.filter(a => !practiceReason(s, player, a));
}
export function practiceProject(s: PracticeState, player: number) { return { ...s, events: s.events.map(e => e.type === 'draw' && e.player !== player ? { ...e, cardId: undefined, unit: undefined } : e), players: s.players.map((p, i) => ({ name: p.name, legend: p.legend, legendReady: p.legendReady, spellEnergy: p.spellEnergy, scored: p.scored, champion: p.champion, hand: i === player ? p.hand : undefined, handCount: p.hand.length, deckCount: p.deck.length, runeDeckCount: p.runeDeck.length, runes: p.runes, trash: p.trash, score: p.score })), legal: practiceActions(s, player), limitations: practiceLimitations }; }
export type PracticeView = ReturnType<typeof practiceProject>;

function payAbility(s: PracticeState, player: number, action: Extract<PracticeAction, { type: 'activate' }>) {
  const p = s.players[player];
  if (action.source === 'legend') { p.runes.find(r => r.ready)!.ready = false; p.legendReady = false; }
  else { const u = s.units.find(u => u.id === action.source)!; if (u.cardId === 'OGN-157' && action.mode) { u.buff = false; (u.usedAbilities ??= []).push(action.mode); } else u.ready = false; }
}

function resolveAbility(s: PracticeState, player: number, action: Extract<PracticeAction, { type: 'activate' }>, sourceCardId?: string) {
 const p = s.players[player];
    let cardId = sourceCardId ?? p.legend;
    if (action.source === 'legend') {
      if (p.legend === 'OGN-265') token(s, player, 1);
      else { const target = s.units.find(u => u.id === action.target); if (target) target.buff = true; }
    } else { const u = s.units.find(u => u.id === action.source); cardId = u?.cardId ?? cardId;
      if (cardId === 'OGN-157') {
        const target = s.units.find(v => v.id === action.target && v.location >= 0);
        if (action.mode === 'damage' && target) damage(s, player, target, 2);
        if (action.mode === 'stun' && target) target.stunned = true;
        if (action.mode === 'ready' && u) u.ready = true;
        if (action.mode === 'ganking' && u) u.ganking = true;
        cleanup(s);
      } else p.spellEnergy += 2; }
    const text = `${p.name} activates ${displayName(cards[cardId])}.`;
    s.log.push(text); event(s, { type: 'activate', player, cardId, unit: action.target ?? action.source, text });

}

function resolvePlay(s: PracticeState, player: number, instance: PracticeCard, action: Extract<PracticeAction, { type: 'play' }>) {
 const p = s.players[player], c = cards[instance.cardId];
    const valid = (u: PracticeUnit) => !(['OGN-024','OGN-005','OGN-085','OGS-003','OGS-012','OGN-169','OGN-168','OGS-002'].includes(c.id) && u.location < 0) && !(c.id === 'OGN-169' && practiceMight(s, u) > 3);
    const target = s.units.find(u => u.id === action.target && valid(u)), other = s.units.find(u => u.id === action.other && valid(u));
    if (c.types.includes('unit')) {
      const u: PracticeUnit = { ...instance, owner: player, location: -1, ready: !!action.accelerate || c.text.includes('I enter ready.') || s.log.includes(`confront:${s.turn}:${player}`), bonus: 0, buff: false, damage: 0 }; s.units.push(u);
      if (c.id === 'OGN-087') take(s, player, 1);
      if (c.id === 'OGN-137' && p.runeDeck.length) { channel(s, player, 1); p.runes.at(-1)!.ready = false; }
      if (c.id === 'OGN-211') token(s, player, 1);
    } else {
      p.trash.push(instance);
      if (c.id === 'OGN-182') take(s, player, 1);
      if (['OGN-083','OGN-048'].includes(c.id)) take(s, player, c.id === 'OGN-083' || action.exhaust ? 2 : 1);
      if (c.id === 'OGN-134') { if (p.runeDeck.length) { channel(s, player, 1); p.runes.at(-1)!.ready = false; } else take(s, player, 1); }
      if (c.id === 'OGN-129') { s.log.push(`confront:${s.turn}:${player}`); take(s, player, 1); }
      if (target) {
        if (['OGN-095','OGN-093'].includes(c.id)) target.bonus -= Math.min(practiceMight(s, target) - 1, c.id === 'OGN-095' ? 1 : 4);
        if (['OGN-058','OGN-046'].includes(c.id)) target.bonus += c.id === 'OGN-058' ? 2 : s.units.filter(u => u.owner === player && u.location === target.location).length === 1 ? 2 : 1;

        if (c.id === 'OGN-053') target.buff = true;
        const hits: Record<string, number> = { 'OGN-024': 4, 'OGN-005': 3, 'OGN-085': 6, 'OGS-003': 2, 'OGS-022': 8, 'OGN-105': 6 };
        if (hits[c.id]) { damage(s, player, target, hits[c.id]); if (c.id === 'OGN-005' && target.damage >= practiceMight(s, target)) take(s, player, 1); }

        if (c.id === 'OGS-012') kill(s, target);
        if (c.id === 'OGN-169') { kill(s, target); const q = s.players[target.owner]; const index = q.trash.findIndex(card => card.id === target.id); if (index >= 0) q.hand.push(q.trash.splice(index, 1)[0]); }
        if (['OGN-168','OGS-011'].includes(c.id)) { target.location = -1; }
        if (['OGN-128','OGS-008'].includes(c.id) && other) { if (c.id === 'OGS-008') target.bonus += 3; const a = practiceMight(s, target), b = practiceMight(s, other); damage(s, player, other, a); damage(s, player, target, b); }
        if (c.id === 'OGN-206') target.bonus += 2;
        if (c.id === 'OGS-002') for (const u of s.units.filter(u => u.owner !== player && u.location === target.location)) damage(s, player, u, 3);
      }
      if (c.id === 'OGN-105' && other) damage(s, player, other, 6);
      if (c.id === 'OGN-206' && other) other.bonus += 2;
      if (c.id === 'OGS-011' && other) other.location = -1;
      if (['OGN-095','OGN-058','OGN-024'].includes(c.id)) take(s, player, 1);
      if (['OGS-024','OGN-233'].includes(c.id)) for (const u of s.units.filter(u => u.owner === player)) u.bonus += c.id === 'OGS-024' ? 2 : 5;
      if (c.id === 'OGS-015') for (let i = 0; i < 4; i++) token(s, player, 1);
      if (c.id === 'OGN-094') token(s, player, 3, -1, true);
      if (c.id === 'OGN-170') { const index = p.trash.findIndex(card => cards[card.cardId].types.includes('unit')); if (index >= 0) p.hand.push(p.trash.splice(index, 1)[0]); }
    }
    cleanup(s);

 if (s.interactive && c.id === 'OGN-030' && p.hand.length) s.task = { player, type: 'discard', count: Math.min(2, p.hand.length), cardId: c.id };
 if (s.interactive && c.id === 'OGS-010' && p.trash.some(c => cards[c.cardId].types.includes('spell'))) s.task = { player, type: 'retrieve', count: 1, cardId: c.id };
}

function recordPlay(s: PracticeState, player: number, instance: PracticeCard, action: Extract<PracticeAction, { type: 'play' }>) {
  const c = cards[instance.cardId], p = s.players[player];
  s.log.push(`${p.name} plays ${displayName(c)}.`);
  event(s, { type: 'play', player, cardId: c.id, unit: instance.id, text: `${p.name} plays ${displayName(c)}${action.accelerate ? ' — Accelerated' : ''}` });
  if (s.interactive && c.types.includes('spell') && p.legend === 'OGS-021' && practiceCost(s, player, c.id).energy >= 5) take(s, player, 1);
  if (s.interactive && s.active !== player && s.units.some(u => u.owner === player && u.cardId === 'OGN-117')) {
    for (const u of s.units.filter(u => u.owner === player && u.cardId === 'OGN-117')) token(s, player, 1);
  }
}

export function practiceActor(s: Pick<PracticeState, 'active' | 'priority' | 'task'>) { return s.task?.player ?? s.priority ?? s.active; }
function interactiveReason(s: PracticeState, player: number, a: PracticeAction): string | undefined {
  if (practiceActor(s) !== player) return 'Wait for your priority.';
  if (s.task) {
    const p = s.players[player];
    if (s.task.type === 'discard') {
      if (a.type !== 'discard' || a.cards.length !== Math.min(s.task.count, p.hand.length) || new Set(a.cards).size !== a.cards.length || a.cards.some(id => !p.hand.some(c => c.id === id))) return `Choose ${Math.min(s.task.count, p.hand.length)} hand cards to discard.`;
    } else if (a.type !== 'retrieve' || !p.trash.some(c => c.id === a.card && cards[c.cardId].types.includes('spell'))) return 'Choose a spell in your trash.';
    return;
  }
  if (s.showdown?.step === 'assign') {
    if (a.type !== 'assign') return 'Choose your combat damage order.';
    const targets = combatTargets(s, player);
    if (a.order.length !== targets.length || new Set(a.order).size !== a.order.length || a.order.some(id => !targets.some(u => u.id === id))) return 'Order every opposing combat unit exactly once.';
    let lastRank = -1;
    for (const id of a.order) { const rank = combatRank(s.units.find(u => u.id === id)!); if (rank < lastRank) return 'Assign damage to Tank first and Backline last.'; lastRank = rank; }
    return;
  }
  if (a.type === 'assign' || a.type === 'discard' || a.type === 'retrieve') return 'There is no pending choice for this action.';
  const closed = !!s.chain?.length, showdown = !!s.showdown;
  if (a.type === 'pass') return closed || showdown ? undefined : 'There is no response window to pass.';
  if (closed || showdown) {
    if (a.type !== 'play' && a.type !== 'activate') return 'Resolve the response window first.';
    const p = s.players[player];
    const cardId = a.type === 'play' ? [...p.hand, ...(p.champion ? [p.champion] : [])].find(c => c.id === a.card)?.cardId : a.source === 'legend' ? p.legend : s.units.find(u => u.id === a.source)?.cardId;
    const text = cardId && cards[cardId]?.text || '';
    if (!text.includes('[Reaction]') && (closed || !text.includes('[Action]'))) return closed ? 'Only Reaction cards and abilities can respond on a chain.' : 'Only Action or Reaction cards and abilities can be used in a showdown.';
  } else if (s.active !== player) return 'Wait for your turn.';
  if (a.type === 'group-move') {
    if (!a.units.length || a.units.length > 30 || new Set(a.units).size !== a.units.length) return 'Choose different ready units to move together.';
    const units = a.units.map(id => s.units.find(u => u.id === id));
    if (units.some(u => !u || u.owner !== player || !u.ready)) return 'Choose your ready units.';
    if (units.some(u => u!.location !== units[0]!.location)) return 'Group movement needs a shared starting location.';
    for (const unit of units) { const error = practiceReason(s, player, { type: 'move', unit: unit!.id, field: a.field }); if (error) return error; }
  }
}
function combatRank(u: PracticeUnit) { const text = cards[u.cardId]?.text ?? ''; return text.includes('[Tank]') ? 0 : text.includes('[Backline]') ? 2 : 1; }
export function combatTargets(s: PracticeState, player: number) { return s.units.filter(u => u.owner !== player && u.location === s.showdown?.field).sort((a, b) => combatRank(a) - combatRank(b) || practiceMight(s, a) - practiceMight(s, b)); }
function combatRole(s: PracticeState, player: number) { return s.showdown?.attacker === player ? 'attacker' as const : 'defender' as const; }
export function combatDamage(s: PracticeState, player: number) { return s.units.filter(u => u.owner === player && !u.stunned && u.location === s.showdown?.field).reduce((sum, u) => sum + practiceMight(s, u, combatRole(s, player)), 0); }
export function combatAllocation(s: PracticeState, player: number, order: string[]) {
  let remaining = combatDamage(s, player);
  return order.map((id, i) => { const u = s.units.find(u => u.id === id)!; const amount = i === order.length - 1 ? remaining : Math.min(remaining, Math.max(0, practiceMight(s, u, combatRole(s, u.owner)) - u.damage)); remaining -= amount; return { unit: id, amount }; });
}
function finishShowdown(s: PracticeState) {
  const field = s.showdown!.field;
  s.showdown = undefined; s.priority = undefined; s.passes = 0;
  s.units.filter(u => u.location === field).forEach(u => u.damage = 0);
  cleanup(s);
}
function advanceShowdown(s: PracticeState) {
  if (!s.showdown || s.showdown.step === 'assign' || s.chain?.length || s.task) return;
  const combat = s.showdown;
  const sides = [0, 1].map(owner => s.units.some(u => u.owner === owner && u.location === combat.field));
  if (!sides.every(Boolean)) { finishShowdown(s); return; }
  if (combat.passes >= 2) { combat.step = 'assign'; s.priority = combat.attacker; }
}
function interactiveTransition(state: PracticeState, player: number, action: PracticeAction): PracticeState {
  const s = structuredClone(state), p = s.players[player]; s.revision++;
  if (action.type === 'discard') {
    for (const id of action.cards) { const i = p.hand.findIndex(c => c.id === id); const card = p.hand.splice(i, 1)[0]; p.trash.push(card); if (card.cardId === 'OGN-182') take(s, player, 1); }
    s.task = undefined;
    event(s, { type: 'notice', player, text: `${p.name} discards ${action.cards.length} cards.` });
  } else if (action.type === 'retrieve') {
    p.hand.push(p.trash.splice(p.trash.findIndex(c => c.id === action.card), 1)[0]); s.task = undefined;
  } else if (action.type === 'pass') {
    if (s.chain?.length) {
      s.passes = (s.passes ?? 0) + 1;
      if (s.passes < 2) s.priority = 1 - player;
      else {
        const item = s.chain.pop()!;
        if (item.action.type === 'play' && item.card) resolvePlay(s, item.player, item.card, item.action);
        else if (item.action.type === 'activate') resolveAbility(s, item.player, item.action, item.cardId);
        s.passes = 0;
        if (s.chain.length) s.priority = s.chain.at(-1)!.player;
        else { s.priority = s.showdown ? 1 - s.showdown.focus : undefined; if (s.showdown) { s.showdown.focus = s.priority!; s.showdown.passes = 0; } }
        event(s, { type: 'notice', player: item.player, cardId: item.cardId, text: `${cards[item.cardId]?.name ?? 'Ability'} resolves.` });
      }
    } else if (s.showdown) { s.showdown.passes++; s.priority = 1 - player; s.showdown.focus = s.priority; }
  } else if (action.type === 'assign') {
    const combat = s.showdown!;
    combat.assignments[player] = combatAllocation(s, player, action.order);
    if (player === combat.attacker) s.priority = 1 - player;
    else {
      // Apply both allocations before removing any units: retaliation is simultaneous.
      for (const owner of [0, 1]) for (const hit of combat.assignments[owner]) { const u = s.units.find(u => u.id === hit.unit)!; u.damage += hit.amount; if (hit.amount) event(s, { type: 'damage', player: owner, unit: u.id, field: combat.field, amount: hit.amount, text: `${hit.amount} combat damage` }); }
      const defeated = s.units.filter(u => u.location === combat.field && u.damage >= practiceMight(s, u, combatRole(s, u.owner)));
      defeated.forEach(u => kill(s, u));
      s.log.push('Combat resolves with simultaneous, player-ordered damage.');
      finishShowdown(s);
    }
  } else if (action.type === 'play') {
    const instance = [...p.hand, ...(p.champion ? [p.champion] : [])].find(c => c.id === action.card)!;
    pay(s, player, instance.cardId, action.accelerate);
    if (p.champion?.id === instance.id) p.champion = undefined; else p.hand = p.hand.filter(c => c.id !== instance.id);
    if (action.exhaust) s.units.find(u => u.id === action.exhaust)!.ready = false;
    recordPlay(s, player, instance, action);
    if (cards[instance.cardId].types.includes('spell')) { (s.chain ??= []).push({ player, card: instance, cardId: instance.cardId, action }); s.priority = player; s.passes = 0; }
    else resolvePlay(s, player, instance, action);
  } else if (action.type === 'activate') {
    payAbility(s, player, action);
    const cardId = action.source === 'legend' ? p.legend : s.units.find(u => u.id === action.source)!.cardId;
    if (cardId === 'OGS-014') resolveAbility(s, player, action);
    else { (s.chain ??= []).push({ player, cardId, action }); s.priority = player; s.passes = 0; }
  } else if (action.type === 'move' || action.type === 'group-move') {
    const ids = action.type === 'move' ? [action.unit] : action.units;
    for (const id of ids) {
      const u = s.units.find(u => u.id === id)!; u.location = action.field; u.ready = false;
      s.log.push(`${p.name} moves ${cards[u.cardId] ? displayName(cards[u.cardId]) : 'Token'} to ${action.field < 0 ? 'base' : cards[s.fields[action.field].cardId].name}.`);
      event(s, { type: 'move', player, unit: u.id, cardId: u.cardId, field: action.field, text: `${p.name} moves ${cards[u.cardId]?.name ?? 'Token'}` });
      if (u.cardId === 'OGN-222' && action.field >= 0) token(s, player, 1, action.field);
    }

    if (action.field >= 0 && s.fields[action.field].controller !== player) {
      s.showdown = { field: action.field, attacker: player, focus: player, passes: 0, step: 'showdown', assignments: [[], []] }; s.priority = player;
      event(s, { type: 'combat', player, field: action.field, text: `Showdown at ${cards[s.fields[action.field].cardId].name}` });
      // Non-combat showdowns also allow the defender a response before conquest.
    } else cleanup(s);
  } else if (action.type === 'end') {
    if (p.legend === 'OGS-017') { let n = 2; for (const rune of p.runes) if (!rune.ready && n > 0) { rune.ready = true; n--; } }
    const next = practiceTransition({ ...s, interactive: false, revision: state.revision }, player, action);
    next.interactive = true; return next;
  }
  if (s.showdown && !s.chain?.length && !s.task) {
    // Keep uncontested showdowns open until both sides pass, unless removal ended combat.
    const owners = new Set(s.units.filter(u => u.location === s.showdown!.field).map(u => u.owner));
    if (s.showdown.passes >= 2 && owners.size < 2) finishShowdown(s);
    else if (owners.size === 2) advanceShowdown(s);
  }
  if (s.events.length > 200) s.events = s.events.slice(-200);
  if (s.log.length > 160) s.log = s.log.slice(-160);
  return s;
}

export function practiceSupport(id: string): 'Supported' | 'Partial' | 'Unsupported' {
  const c = cards[id]; if (!c) return 'Unsupported';
  if (c.types.includes('gear') || c.types.includes('spell') && !implementedSpells.has(id)) return 'Unsupported';
  if (!c.text || ['OGN-257','OGN-265','OGS-014','OGS-021','OGS-017','OGN-251','OGN-117','OGN-030','OGS-010','OGN-087','OGN-137','OGN-211','OGN-222','OGN-182','OGN-084','OGN-055','OGN-046','OGN-048','OGN-058','OGN-093','OGN-095','OGN-206','OGN-005','OGN-024','OGN-085','OGS-011','OGN-105','OGN-157','OGS-023','OGN-118'].includes(id)) return 'Supported';
  return 'Partial';
}
