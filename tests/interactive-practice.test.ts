import { expect, it } from 'vitest';
import { createPractice, practiceTransition, practiceReason, practiceActions, practiceActor, practiceProject, type PracticeState, type PracticeUnit } from '../packages/game-engine/src/practice.ts';
import { riftboundStarters } from '../packages/riftbound-content/src/index.ts';
import { choosePracticeAction } from '../packages/game-engine/src/practice-ai.ts';
function state() { const s = createPractice(riftboundStarters.slice(0, 2).map(({ deck }, i) => ({ name: `Player ${i}`, deck })), 0, 'interactive', true); s.players.forEach((p, i) => { p.hand = []; p.runes = Array.from({ length: 12 }, () => ({ cardId: i ? 'OGN-089' : 'OGN-042', ready: true })); }); return s; }
function unit(id: string, owner: number, cardId = 'OGN-142', location = -1): PracticeUnit { return { id, owner, cardId, location, ready: true, bonus: 0, buff: false, damage: 0 }; }
const pass = (s: PracticeState) => practiceTransition(s, practiceActor(s), { type: 'pass' });
it('holds paid spells on a chain, enforces priority/timing, resolves newest first and never exposes hidden draws', () => {
  let s = state(); s.units = [unit('target', 0)]; s.players[0].hand = [{ id: 'buff', cardId: 'OGN-058' }]; s.players[1].hand = [{ id: 'debuff', cardId: 'OGN-093' }];
  s = practiceTransition(s, 0, { type: 'play', card: 'buff', target: 'target' });
  expect(s.chain).toHaveLength(1); expect(s.units[0].bonus).toBe(0); expect(s.players[0].hand).toHaveLength(0); expect(s.players[0].trash).toHaveLength(0);
  expect(practiceReason(s, 1, { type: 'play', card: 'debuff', target: 'target' })).toContain('priority');
  expect(practiceReason(s, 0, { type: 'end' })).toContain('window');
  s = pass(s); s = practiceTransition(s, 1, { type: 'play', card: 'debuff', target: 'target' });
  s = pass(pass(s)); expect(s.chain).toHaveLength(1); expect(s.units[0].bonus).toBeLessThan(0);
  s = pass(pass(s)); expect(s.chain).toHaveLength(0); expect(s.priority).toBeUndefined(); expect(s.players[0].trash[0].id).toBe('buff');
  expect(practiceProject(s, 1).events.filter(e => e.type === 'draw' && e.player === 0).every(e => !e.cardId && !e.unit)).toBe(true);
});
it('rejects Action spells in a closed chain and permits them in an open showdown', () => {
  let s = state(); s.units = [unit('a', 0), unit('d', 1, 'OGN-142', 0)]; s.players[0].runes = Array.from({ length: 12 }, (_, i) => ({ cardId: i % 2 ? 'OGN-042' : 'OGN-126', ready: true })); s.players[0].hand = [{ id: 'action', cardId: 'OGN-128' }, { id: 'reaction', cardId: 'OGN-058' }];
  s = practiceTransition(s, 0, { type: 'move', unit: 'a', field: 0 });
  expect(practiceReason(s, 0, { type: 'play', card: 'action', target: 'a', other: 'd' })).toBeUndefined();
  s = practiceTransition(s, 0, { type: 'play', card: 'reaction', target: 'a' });
  expect(practiceReason(s, 0, { type: 'play', card: 'action', target: 'a', other: 'd' })).toContain('Only Reaction');
});
it('moves a group once, includes all allied units in combat, enforces Tank order and deals both sides damage simultaneously', () => {
  let s = state(); s.units = [unit('a', 0), unit('b', 0), unit('d', 1, 'OGN-087', 0), unit('e', 1, 'OGN-142', 0)];
  const before = JSON.stringify(s); s = practiceTransition(s, 0, { type: 'group-move', units: ['a','b'], field: 0 });
  expect(JSON.stringify(s)).not.toBe(before); expect(s.units.filter(u => u.owner === 0).every(u => !u.ready && u.location === 0)).toBe(true);
  expect(practiceReason(s, 0, { type: 'move', unit: 'a', field: -1 })).toContain('window');
  s = pass(pass(s)); expect(s.showdown?.step).toBe('assign');
  expect(practiceReason(s, 0, { type: 'assign', order: ['e','d'] })).toContain('Tank');
  s = practiceTransition(s, 0, { type: 'assign', order: ['d','e'] });
  expect(s.units.every(u => u.damage === 0)).toBe(true);
  s = practiceTransition(s, 1, { type: 'assign', order: ['a','b'] });
  expect(s.showdown).toBeUndefined(); expect(s.units.every(u => u.damage === 0)).toBe(true); expect(s.events.filter(e => e.type === 'damage').length).toBeGreaterThan(1);
});
it('waits for both passes before conquering an unoccupied battlefield and rejects duplicated/group ownership moves', () => {
  let s = state(); s.units = [unit('a', 0), unit('b', 1)];
  expect(practiceReason(s, 0, { type: 'group-move', units: ['a','a'], field: 0 })).toBeDefined();
  expect(practiceReason(s, 0, { type: 'group-move', units: ['a','b'], field: 0 })).toBeDefined();
  s = practiceTransition(s, 0, { type: 'move', unit: 'a', field: 0 }); expect(s.players[0].score).toBe(0);
  s = pass(pass(s)); expect(s.players[0].score).toBe(1); expect(s.showdown).toBeUndefined();
});
it('resource abilities resolve immediately during chains; targeted abilities pay once before resolving', () => {
  let s = state(); s.units = [unit('lux', 0, 'OGS-014'), unit('target', 0)]; s.players[0].legend = 'OGN-257';
  s = practiceTransition(s, 0, { type: 'activate', source: 'legend', target: 'target' });
  expect(s.players[0].legendReady).toBe(false); expect(s.units[1].buff).toBe(false);
  s = practiceTransition(s, 0, { type: 'activate', source: 'lux' }); expect(s.players[0].spellEnergy).toBe(2); expect(s.chain).toHaveLength(1);
  s = pass(pass(s)); expect(s.units[1].buff).toBe(true);
});
it('implements Jinx discard choices, Scrapheap discard draw, Annie return choices and Lux spell trigger', () => {
  let s = state(); s.players[0].runes = Array.from({ length: 12 }, () => ({ cardId: 'OGN-007', ready: true }));
  s.players[0].hand = [{ id: 'jinx', cardId: 'OGN-030' }, { id: 'scrap', cardId: 'OGN-182' }, { id: 'other', cardId: 'OGN-142' }];
  s = practiceTransition(s, 0, { type: 'play', card: 'jinx' }); expect(s.task).toMatchObject({ type: 'discard', count: 2 });
  expect(practiceReason(s, 0, { type: 'discard', cards: ['scrap','scrap'] })).toBeDefined();
  s = practiceTransition(s, 0, { type: 'discard', cards: ['scrap','other'] }); expect(s.players[0].hand).toHaveLength(1); expect(s.task).toBeUndefined();
  s.players[0].runes = Array.from({ length: 12 }, () => ({ cardId: 'OGN-166', ready: true }));
  s.players[0].hand.push({ id: 'annie', cardId: 'OGS-010' }); s.players[0].trash.push({ id: 'spell', cardId: 'OGN-095' });
  s = practiceTransition(s, 0, { type: 'play', card: 'annie' }); expect(s.task?.type).toBe('retrieve');
  s = practiceTransition(s, 0, { type: 'retrieve', card: 'spell' }); expect(s.players[0].hand.some(c => c.id === 'spell')).toBe(true);
  s.players[0].legend = 'OGS-021'; s.players[0].runes = Array.from({ length: 12 }, () => ({ cardId: 'OGN-214', ready: true })); s.players[0].hand = [{ id: 'comet', cardId: 'OGN-085' }]; s.units.push(unit('enemy', 1, 'OGN-142', 0));
  s = practiceTransition(s, 0, { type: 'play', card: 'comet', target: 'enemy' }); expect(s.players[0].hand).toHaveLength(1);
});
it.each(riftboundStarters)('finishes interactive AI games with $deck.name', ({ deck }) => {
  let s = createPractice([{ name: 'One', deck }, { name: 'Two', deck: riftboundStarters[2].deck }], 0, 'ai', true);
  for (let n = 0; n < 2000 && s.winner === undefined; n++) { const actor = practiceActor(s), view = practiceProject(s, actor), action = choosePracticeAction(view); expect(practiceReason(s, actor, action)).toBeUndefined(); s = practiceTransition(s, actor, action); }
  expect(s.winner).toBeDefined();
});
it('Udyr spends buffs, prevents repeating an option, applies stun to combat contribution and resets choices at end of turn', () => {
  let s = state(); s.units = [unit('udyr', 0, 'OGN-157'), unit('target', 1, 'OGN-142', 0)]; s.units[0].buff = true; s.units[0].ready = false;
  s = practiceTransition(s, 0, { type: 'activate', source: 'udyr', mode: 'ready' }); expect(s.units[0].buff).toBe(false);
  s = pass(pass(s)); expect(s.units[0].ready).toBe(true);
  s.units[0].buff = true; expect(practiceReason(s, 0, { type: 'activate', source: 'udyr', mode: 'ready' })).toContain('already');
  s = practiceTransition(s, 0, { type: 'activate', source: 'udyr', mode: 'stun', target: 'target' }); s = pass(pass(s)); expect(s.units[1].stunned).toBe(true);
  s = practiceTransition(s, 0, { type: 'end' }); expect(s.units[0].usedAbilities).toEqual([]); expect(s.units[1].stunned).toBe(false);
});
it('rechecks battlefield targets when a reaction moves the target to base', () => {
  let s = state(); s.units = [unit('target', 1, 'OGN-142', 0)]; s.players[0].runes = Array.from({ length: 12 }, () => ({ cardId: 'OGN-007', ready: true })); s.players[0].hand = [{ id: 'burn', cardId: 'OGN-085' }]; s.players[1].runes = Array.from({ length: 12 }, () => ({ cardId: 'OGN-166', ready: true })); s.players[1].hand = [{ id: 'flash', cardId: 'OGS-011' }];
  s = practiceTransition(s, 0, { type: 'play', card: 'burn', target: 'target' }); s = pass(s);
  s = practiceTransition(s, 1, { type: 'play', card: 'flash', target: 'target' }); s = pass(pass(s));
  expect(s.units[0].location).toBe(-1); s = pass(pass(s)); expect(s.units[0].damage).toBe(0); expect(s.units).toHaveLength(1);
});
