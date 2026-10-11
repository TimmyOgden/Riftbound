import { describe, expect, it } from 'vitest';
import { starterDeck } from '../packages/game-content/src/index.ts';
import { originalModule } from '../packages/game-rules/src/index.ts';
import { createGame, legalActions, project, transition } from '../packages/game-engine/src/index.ts';

describe('original game engine', () => {
  it('accepts the starter deck and rejects illegal decks', () => {
    expect(originalModule.validateDeck(starterDeck)).toEqual([]);
    expect(originalModule.validateDeck({ name: 'Invalid', cards: ['unknown'] })).not.toEqual([]);
  });
  it.each(['duel', 'teams', 'free-for-all'] as const)('finishes an automated %s match without mutating prior states', format => {
    let state = createGame(format, Array.from({ length: originalModule.players(format) }, (_, i) => ({ id: `p${i}`, deck: starterDeck.cards })));
    for (let i = 0; i < 200 && state.winner === undefined; i++) {
      const before = structuredClone(state);
      const id = state.players[state.active].id;
      const actions = legalActions(state, id);
      state = transition(state, id, actions.find(a => a.type === 'attack') ?? actions.find(a => a.type === 'play') ?? { type: 'end' });
      expect(before.revision).toBe(state.revision - 1);
    }
    expect(state.winner).toBeDefined();
  });
  it('hides opponents hands and all deck order', () => {
    const state = createGame('duel', ['a', 'b'].map(id => ({ id, deck: starterDeck.cards })));
    const view = JSON.parse(JSON.stringify(project(state, 'a')));
    expect(view.players[0].hand).toHaveLength(5);
    expect(view.players[1].hand).toBeUndefined();
    expect(view.players.every((p: { deck?: unknown }) => p.deck === undefined)).toBe(true);
    expect(() => transition(state, 'b', { type: 'end' })).toThrow('Wait for your turn');
  });
});
