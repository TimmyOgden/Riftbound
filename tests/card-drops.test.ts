import { expect, it } from 'vitest';
import { resolveCardDrop } from '../apps/desktop/src/card-drops.ts';
import { createPractice, practiceActions, practiceTransition, type PracticeUnit } from '../packages/game-engine/src/practice.ts';
import { riftboundStarters } from '../packages/riftbound-content/src/index.ts';
const unit = (id: string, owner: number): PracticeUnit => ({ id, cardId: 'OGN-052', owner, location: 0, ready: true, bonus: 0, buff: false, damage: 0 });
function fixture() {
  const s = createPractice(riftboundStarters.slice(1, 3).map(x => ({ name: 'Test', deck: x.deck })));
  s.players[0].runes = Array.from({ length: 12 }, () => ({ cardId: 'OGN-042', ready: true }));
  s.units = [unit('friend', 0), unit('enemy', 1)];
  return s;
}
it('a targeted spell drop chooses a legal unit, consumes the card once and rejects empty space', () => {
  const s = fixture(); s.players[0].hand = [{ id: 'spell', cardId: 'OGN-058' }];
  const card = { kind: 'card' as const, id: 'spell', cardId: 'OGN-058' }, legal = practiceActions(s, 0);
  expect(resolveCardDrop(legal, card, { field: 0 })).toBeUndefined();
  expect(resolveCardDrop(legal, card, { unit: 'missing', field: 0 })).toBeUndefined();
  const action = resolveCardDrop(legal, card, { unit: 'friend', field: 0 })!;
  const next = practiceTransition(s, 0, action);
  expect(next.units[0].bonus).toBe(2);
  expect(next.players[0].trash.filter(c => c.id === 'spell')).toHaveLength(1);
  expect(resolveCardDrop(practiceActions(next, 0), card, { unit: 'friend' })).toBeUndefined();
});
it('a two-target spell drop preserves the first target and an eligible second target', () => {
  const s = fixture(); s.players[0].runes.forEach(r => r.cardId = 'OGN-126'); s.players[0].hand = [{ id: 'spell', cardId: 'OGN-128' }];
  const action = resolveCardDrop(practiceActions(s, 0), { kind: 'card', id: 'spell', cardId: 'OGN-128' }, { unit: 'friend', field: 0 });
  expect(action).toMatchObject({ type: 'play', target: 'friend', other: 'enemy' });
  expect(resolveCardDrop(practiceActions(s, 0), { kind: 'card', id: 'spell', cardId: 'OGN-128' }, { unit: 'enemy' })).toBeUndefined();
});
it('normal and accelerated drops select separate server actions', () => {
  const s = fixture(); s.players[0].champion = { id: 'champion', cardId: 'OGN-151' }; s.players[0].runes.forEach(r => r.cardId = 'OGN-126');
  const card = { kind: 'card' as const, id: 'champion', cardId: 'OGN-151' }, legal = practiceActions(s, 0);
  expect(resolveCardDrop(legal, card, { field: -1 })).toMatchObject({ accelerate: false });
  expect(resolveCardDrop(legal, card, { field: -1 }, true)).toMatchObject({ accelerate: true });
  expect(resolveCardDrop(legal, card, { field: 1 })).toBeUndefined();
});
it('unit drops use field destinations even over enemy units and reject exhausted moves', () => {
  const s = fixture(), card = { kind: 'unit' as const, id: 'friend', cardId: 'OGN-052' };
  s.units[0].location = -1;
  expect(resolveCardDrop(practiceActions(s, 0), card, { unit: 'enemy', field: 0 })).toMatchObject({ type: 'move', field: 0 });
  s.units[0].ready = false;
  expect(resolveCardDrop(practiceActions(s, 0), card, { field: 0 })).toBeUndefined();
});
