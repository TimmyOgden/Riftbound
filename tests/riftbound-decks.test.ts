import { expect, it } from 'vitest';
import { riftboundStarters, riftboundCardById } from '../packages/riftbound-content/src/index.ts';
import { validateRiftboundDeck } from '../packages/game-rules/src/riftbound.ts';
it.each(riftboundStarters)('validates retail $deck.name with correct zones and counts', ({ deck, product }) => {
  expect(deck.cards).toHaveLength(40); expect(deck.runes).toHaveLength(12);
  expect(deck.battlefields).toHaveLength(product === 'Origins' ? 3 : 1);
  expect([...deck.cards, ...deck.runes, ...deck.battlefields, deck.legend].every(id => !!riftboundCardById[id])).toBe(true);
  expect(validateRiftboundDeck(deck)).toEqual([]);
});
it('rejects domain mismatches, excess copies, wrong champion, and runes in main deck', () => {
  const deck = structuredClone(riftboundStarters[2].deck);
  deck.cards[0] = 'OGN-006';
  expect(validateRiftboundDeck(deck).join(' ')).toContain('domains');
  deck.champion = 'OGN-030'; expect(validateRiftboundDeck(deck).join(' ')).toContain('match the legend');
  deck.cards = Array(40).fill('OGN-042'); expect(validateRiftboundDeck(deck).join(' ')).toContain('main deck');
});
