import { cardById } from '../../game-content/src/index.ts';
import type { Deck, Format } from '../../shared/src/index.ts';
export interface GameModule { id: string; name: string; authorized: boolean; validateDeck(deck: Deck): string[]; players(format: Format): number; victoryScore: number }
export const originalModule: GameModule = { id: 'ember-concord', name: 'Ember Concord', authorized: true, victoryScore: 12, players: f => f === 'duel' ? 2 : 4, validateDeck(deck) {
  const errors: string[] = [];
  if (deck.cards.length !== 30) errors.push('A deck must contain exactly 30 cards.');
  const counts = new Map<string, number>();
  for (const id of deck.cards) { if (!cardById[id]) errors.push(`Unknown card: ${id}`); counts.set(id,(counts.get(id) ?? 0) + 1); }
  if ([...counts.values()].some(n => n > 3)) errors.push('Maximum three copies per card.');
  if (deck.cards.filter(id => cardById[id]?.type === 'resource').length < 8) errors.push('At least eight resource cards required.');
  if (deck.cards.filter(id => cardById[id]?.type === 'champion').length > 3) errors.push('Maximum three champions.');
  return errors;
} };
