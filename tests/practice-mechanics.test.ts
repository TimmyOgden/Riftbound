import { expect, it } from 'vitest';
import { riftboundStarters } from '../packages/riftbound-content/src/index.ts';
import { createPractice, practiceActions, practiceMight, practiceProject, practiceReason, practiceTransition, type PracticeState, type PracticeUnit } from '../packages/game-engine/src/practice.ts';
const setup = (id = 'origins-lee-sin') => createPractice([{ name: 'You', deck: riftboundStarters.find(s => s.id === id)!.deck }, { name: 'AI', deck: riftboundStarters[2].deck }]);
const unit = (id: string, cardId: string, location = -1, owner = 0): PracticeUnit => ({ id, cardId, owner, location, ready: true, bonus: 0, damage: 0, buff: false });
const runes = (s: PracticeState, n: number, id = 'OGN-007') => { s.players[0].runes = Array.from({ length: n }, () => ({ cardId: id, ready: true })); };

it('Accelerate costs additional energy/power and enters ready without mutating the old state', () => {
  const s = setup('origins-jinx'); runes(s, 6);
  const before = JSON.stringify(s), card = s.players[0].champion!.id;
  expect(practiceActions(s, 0)).toContainEqual({ type: 'play', card, target: undefined, other: undefined, accelerate: true });
  const next = practiceTransition(s, 0, { type: 'play', card, accelerate: true });
  expect(next.units[0].ready).toBe(true);
  expect(next.players[0].runes).toHaveLength(4);
  expect(next.players[0].runes.filter(r => r.ready)).toHaveLength(2);
  expect(next.events.some(e => e.text.includes('Accelerated'))).toBe(true);
  expect(JSON.stringify(s)).toBe(before);
  expect(practiceTransition(s, 0, { type: 'play', card }).units[0].ready).toBe(false);
});
it('rejects Accelerate when the additional cost or keyword is missing', () => {
  const s = setup('origins-jinx'); runes(s, 3);
  expect(practiceReason(s, 0, { type: 'play', card: s.players[0].champion!.id, accelerate: true })).toContain('Insufficient');
  const lux = setup('proving-grounds-lux'); runes(lux, 8, 'OGN-214');
  expect(practiceReason(lux, 0, { type: 'play', card: lux.players[0].champion!.id, accelerate: true })).toContain('does not have');
});
it('Lee Sin buffs only friendly units and exhausts until its next turn', () => {
  const s = setup(); s.units.push(unit('friend', 'OGN-052'), unit('enemy', 'OGN-052', -1, 1));
  expect(practiceReason(s, 0, { type: 'activate', source: 'legend', target: 'enemy' })).toContain('friendly');
  const next = practiceTransition(s, 0, { type: 'activate', source: 'legend', target: 'friend' });
  expect(next.units[0].buff).toBe(true); expect(next.players[0].legendReady).toBe(false);
  expect(next.players[0].runes.filter(r => r.ready)).toHaveLength(1);
  expect(practiceReason(next, 0, { type: 'activate', source: 'legend', target: 'friend' })).toContain('exhausted');
  const round = practiceTransition(practiceTransition(next, 0, { type: 'end' }), 1, { type: 'end' });
  expect(round.players[0].legendReady).toBe(true); expect(round.units[0].buff).toBe(true);
});
it('Viktor creates one exhausted Recruit and cannot activate twice', () => {
  const s = setup('origins-viktor');
  const next = practiceTransition(s, 0, { type: 'activate', source: 'legend' });
  expect(next.units[0]).toMatchObject({ cardId: 'recruit', location: -1, ready: false, owner: 0 });
  expect(practiceReason(next, 0, { type: 'activate', source: 'legend' })).toContain('exhausted');
});
it('Lux energy pays only spell costs, is spent once and expires at end of turn', () => {
  const s = setup('proving-grounds-lux'); s.units.push(unit('lux', 'OGS-014')); runes(s, 0);
  s.players[0].hand = [{ id: 'spell', cardId: 'OGN-095' }, { id: 'creature', cardId: 'OGN-087' }];
  const next = practiceTransition(s, 0, { type: 'activate', source: 'lux' });
  expect(next.players[0].spellEnergy).toBe(2); expect(next.units[0].ready).toBe(false);
  expect(practiceReason(next, 0, { type: 'play', card: 'creature' })).toContain('Insufficient');
  const cast = practiceTransition(next, 0, { type: 'play', card: 'spell', target: 'lux' });
  expect(cast.players[0].spellEnergy).toBe(1);
  expect(practiceTransition(cast, 0, { type: 'end' }).players[0].spellEnergy).toBe(0);
});
it('a conquest at seven draws; scoring both fields in the same turn wins', () => {
  const s = setup(); s.players[0].score = 7; s.units.push(unit('first', 'OGN-052'), unit('second', 'OGN-052'));
  const hand = s.players[0].hand.length;
  const next = practiceTransition(s, 0, { type: 'move', unit: 'first', field: 0 });
  expect(next.players[0].score).toBe(7); expect(next.players[0].hand).toHaveLength(hand + 1); expect(next.winner).toBeUndefined();
  expect(next.players[0].scored).toEqual([0]);
  const win = practiceTransition(next, 0, { type: 'move', unit: 'second', field: 1 });
  expect(win.players[0].score).toBe(8); expect(win.winner).toBe(0);
});
it('reconquering the same battlefield cannot score twice and hold can win the final point', () => {
  const s = setup(); s.units.push(unit('first', 'OGN-052'), unit('second', 'OGN-052'));
  let next = practiceTransition(s, 0, { type: 'move', unit: 'first', field: 0 });
  next.units[0].ready = true;
  next = practiceTransition(next, 0, { type: 'move', unit: 'first', field: -1 });
  next = practiceTransition(next, 0, { type: 'move', unit: 'second', field: 0 });
  expect(next.players[0].score).toBe(1);
  next.players[0].score = 7;
  const win = practiceTransition(practiceTransition(next, 0, { type: 'end' }), 1, { type: 'end' });
  expect(win.winner).toBe(0); expect(win.players[0].scored).toEqual([0]);
});
it('animation projections hide opponent draws and private deck order', () => {
  const next = practiceTransition(setup(), 0, { type: 'end' });
  const view = practiceProject(next, 0);
  expect(view.players[1].hand).toBeUndefined();
  expect(view.events.filter(e => e.type === 'draw' && e.player !== 0).every(e => e.cardId === undefined && e.unit === undefined)).toBe(true);
  expect(view.players.every(p => !('deck' in p) && !('runeDeck' in p))).toBe(true);
});

it('spells that remove the last enemy establish control for surviving friendly units', () => {
  const s = setup('proving-grounds-lux'); runes(s, 10, 'OGN-214');
  s.players[0].hand = [{ id: 'kill', cardId: 'OGS-012' }];
  s.units = [unit('friend', 'OGN-052', 0), unit('enemy', 'OGN-052', 0, 1)];
  s.fields[0].controller = 1;
  const next = practiceTransition(s, 0, { type: 'play', card: 'kill', target: 'enemy' });
  expect(next.fields[0].controller).toBe(0); expect(next.players[0].score).toBe(1);
});
it('Lee Sin aura affects other buffed units at his battlefield, not in base', () => {
  const s = setup(); const ally = unit('ally', 'OGN-052'); ally.buff = true;
  s.units = [unit('lee', 'OGN-151'), ally];
  const base = practiceMight(s, ally);
  s.units.forEach(u => u.location = 0);
  expect(practiceMight(s, ally)).toBe(base + 2);
});

it('combat emits damage and defeat events and awards control to a surviving attacker', () => {
  const s = setup(); s.units = [unit('lee', 'OGN-151'), unit('enemy', 'OGN-052', 0, 1)]; s.fields[0].controller = 1;
  const next = practiceTransition(s, 0, { type: 'move', unit: 'lee', field: 0 });
  expect(next.events.map(e => e.type)).toEqual(expect.arrayContaining(['move', 'combat', 'damage', 'kill', 'score']));
  expect(next.units.map(u => u.id)).toEqual(['lee']); expect(next.units[0].damage).toBe(0);
  expect(next.players[0].score).toBe(1);
});
