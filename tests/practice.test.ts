import { expect, it } from 'vitest';
import { riftboundStarters } from '../packages/riftbound-content/src/index.ts';
import { createPractice, practiceProject, practiceReason, practiceTransition } from '../packages/game-engine/src/practice.ts';
import { choosePracticeAction } from '../packages/game-engine/src/practice-ai.ts';
import { PracticeMatches } from '../apps/server/src/practice.ts';
it.each([0, 1])('deals and channels correctly when player %i starts', first => {
  const entrants = riftboundStarters.slice(0, 2).map(({ deck }, i) => ({ name: String(i), deck }));
  const state = createPractice(entrants, first, 'opening-test');
  expect(state).toMatchObject({ active: first, firstPlayer: first, matchId: 'opening-test' });
  expect(state.players[first].hand).toHaveLength(5);
  expect(state.players[first].runes).toHaveLength(2);
  expect(state.players[1 - first].hand).toHaveLength(4);
  expect(state.players[1 - first].runes).toHaveLength(0);
  const second = practiceTransition(state, first, { type: 'end' });
  expect(second.players[1 - first].hand).toHaveLength(5);
  expect(second.players[1 - first].runes).toHaveLength(3);
  const round = practiceTransition(second, 1 - first, { type: 'end' });
  expect(round.players[first].runes).toHaveLength(4);
  for (const viewer of [0, 1]) {
    const events = practiceProject(second, viewer).events.filter(e => e.type === 'draw');
    expect(events.filter(e => e.player === viewer).every(e => e.cardId && e.unit)).toBe(true);
    expect(events.filter(e => e.player !== viewer).every(e => !e.cardId && !e.unit)).toBe(true);
  }
});
it.each([0, 1])('returns an actionable player turn after the opening coin chooses %i', first => {
  const matches = new PracticeMatches(() => first);
  const input = { type: 'start', deck: riftboundStarters[0].deck, opponent: riftboundStarters[2].id };
  const reply = matches.command('opening', input);
  expect(reply.ok).toBe(true);
  expect(reply.view).toMatchObject({ active: 0, firstPlayer: first });
  expect(reply.view!.players[0].hand).toHaveLength(5);
  expect(reply.view!.players[0].runes).toHaveLength(first ? 3 : 2);
  expect(reply.view!.legal).toContainEqual({ type: 'end' });
  expect(matches.command('opening', input).view!.matchId).not.toBe(reply.view!.matchId);
});
it.each(riftboundStarters)('finishes AI practice using $deck.name and immutable transitions', ({ deck }) => {
  let state = createPractice([{ name: 'Player', deck }, { name: 'AI', deck: riftboundStarters[2].deck }]);
  for (let step = 0; step < 700 && state.winner === undefined; step++) {
    const before = JSON.stringify(state), player = state.active;
    const view = practiceProject(state, player), action = choosePracticeAction(view);
    expect(practiceReason(state, player, action)).toBeUndefined();
    const next = practiceTransition(state, player, action);
    expect(JSON.stringify(state)).toBe(before); expect(next.revision).toBe(state.revision + 1); state = next;
  }
  expect(state.winner).toBeDefined();
});
it('gives the strategy bot no opponent hand or deck order', () => {
  const state = createPractice(riftboundStarters.slice(0, 2).map(({ deck }, i) => ({ name: String(i), deck })));
  const view = practiceProject(state, 0);
  expect(view.players[1].hand).toBeUndefined();
  expect(view.players.every(p => !('deck' in p) && !('runeDeck' in p))).toBe(true);
  expect(choosePracticeAction(view)).toBeDefined();
});
it.each([0, 1])('returns private, ordered playback frames for first player %i', first => {
  const matches = new PracticeMatches(() => first, items => [...items]);
  const start = matches.command('sequence', { type: 'start', deck: riftboundStarters[0].deck, opponent: riftboundStarters[1].id });
  const reply = first ? start : matches.command('sequence', { type: 'action', revision: start.view!.revision, action: { type: 'end' } });
  const frames = reply.sequence!;
  expect(frames.length).toBeGreaterThan(1);
  expect(frames.length).toBeLessThanOrEqual(62);
  expect(frames[0].active).toBe(1);
  expect(frames.at(-1)).toEqual(reply.view);
  expect(frames.at(-1)!.active).toBe(0);
  frames.forEach((frame, i) => {
    if (i) expect(frame.revision).toBe(frames[i - 1].revision + 1);
    expect(frame.matchId).toBe(reply.view!.matchId);
    expect(frame.players[1].hand).toBeUndefined();
    expect(frame.players.every(p => !('deck' in p) && !('runeDeck' in p))).toBe(true);
    expect(frame.events.filter(e => e.type === 'draw' && e.player === 1).every(e => !e.unit && !e.cardId)).toBe(true);
  });
  expect(frames.some(frame => frame.events.some(e => e.type === 'activate' && e.player === 1))).toBe(true);
  expect(matches.command('sequence', { type: 'view' }).view).toEqual(reply.view);
  expect(matches.command('sequence', { type: 'action', revision: frames[0].revision, action: { type: 'end' } }).ok).toBe(false);
});
it('rejects stale revisions, out-of-turn moves, malformed commands, and invalid decks', () => {
  const matches = new PracticeMatches(() => 0);
  const start = matches.command('player', { type: 'start', deck: riftboundStarters[0].deck, opponent: riftboundStarters[2].id });
  expect(start.ok).toBe(true);
  expect(matches.command('player', { type: 'action', revision: 999, action: { type: 'end' } }).ok).toBe(false);
  expect(matches.command('player', { type: 'action', revision: 0, action: { type: 'move', unit: 'nonexistent', field: 0 } }).ok).toBe(false);
  expect(matches.command('player', { type: 'action', revision: 0, action: { type: 'end' } }).ok).toBe(true);
  expect(matches.command('player', { type: 'action', revision: 0, action: { type: 'end' } }).ok).toBe(false);
  expect(matches.command('player', { type: 'start', deck: { name: 'Invalid', cards: [] }, opponent: riftboundStarters[0].id }).ok).toBe(false);
  expect(matches.command('player', { type: 'action', revision: 'bad' }).ok).toBe(false);
  matches.disconnect('player'); expect(matches.command('player', { type: 'view' }).ok).toBe(false);
});
