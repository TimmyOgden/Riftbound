import { randomInt, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { deckSchema } from '../../../packages/shared/src/index.ts';
import { riftboundStarters } from '../../../packages/riftbound-content/src/index.ts';
import { createPractice, practiceTransition, practiceProject, type PracticeState, type PracticeView } from '../../../packages/game-engine/src/practice.ts';
import { choosePracticeAction } from '../../../packages/game-engine/src/practice-ai.ts';
const schema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('start'), deck: deckSchema, opponent: z.string().max(60) }),
  z.object({ type: z.literal('view') }),
  z.object({ type: z.literal('action'), revision: z.number().int().nonnegative(), action: z.discriminatedUnion('type', [z.object({ type: z.literal('end') }), z.object({ type: z.literal('activate'), source: z.string().max(80), target: z.string().max(80).optional() }), z.object({ type: z.literal('play'), card: z.string().max(80), target: z.string().max(80).optional(), other: z.string().max(80).optional(), accelerate: z.boolean().optional() }), z.object({ type: z.literal('move'), unit: z.string().max(80), field: z.number().int().min(-1).max(1) })]) })
]);
export interface PracticeReply { ok: boolean; error?: string; view?: PracticeView; sequence?: PracticeView[]; requestId?: string }
function shuffle<T>(items: T[]): T[] { const result = [...items]; for (let i = result.length - 1; i > 0; i--) { const j = randomInt(i + 1); [result[i], result[j]] = [result[j], result[i]]; } return result; }
export class PracticeMatches {
  constructor(private chooseFirst: () => number = () => randomInt(2), private shuffleCards: typeof shuffle = shuffle) {}
  private runAI(state: PracticeState) {
    const sequence = [practiceProject(state, 0)];
    let steps = 0;
    while (state.active === 1 && state.winner === undefined) {
      state = practiceTransition(state, 1, steps++ >= 60 ? { type: 'end' } : choosePracticeAction(practiceProject(state, 1)));
      sequence.push(practiceProject(state, 0));
    }
    return { state, sequence };
  }
  private matches = new Map<string, PracticeState>();
  disconnect(socket: string) { this.matches.delete(socket); }
  command(socket: string, input: unknown): PracticeReply {
    const parsed = schema.safeParse(input); if (!parsed.success) return { ok: false, error: 'Invalid practice command.' };
    const cmd = parsed.data;
    if (cmd.type === 'start') {
      const opponent = riftboundStarters.find(s => s.id === cmd.opponent);
      if (!opponent) return { ok: false, error: 'Choose a starter deck for the AI.' };
      try {
        const { state, sequence } = this.runAI(createPractice([{ name: 'You', deck: { ...cmd.deck, cards: this.shuffleCards(cmd.deck.cards), runes: this.shuffleCards(cmd.deck.runes ?? []) } }, { name: 'AI', deck: { ...opponent.deck, cards: this.shuffleCards(opponent.deck.cards), runes: this.shuffleCards(opponent.deck.runes) } }], this.chooseFirst(), randomUUID()));
        this.matches.set(socket, state); return { ok: true, view: sequence.at(-1), sequence };
      } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Cannot start practice.' }; }
    }
    let state = this.matches.get(socket); if (!state) return { ok: false, error: 'Start an AI practice match first.' };
    if (cmd.type === 'action') {
      if (state.revision !== cmd.revision) return { ok: false, error: 'Board changed. Refresh the match.', view: practiceProject(state, 0) };
      try {
        state = practiceTransition(state, 0, cmd.action);
        const result = this.runAI(state);
        state = result.state;
        this.matches.set(socket, state);
        return { ok: true, view: result.sequence.at(-1), sequence: result.sequence };
      } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Practice action failed.', view: practiceProject(this.matches.get(socket)!, 0) }; }
    }
    return { ok: true, view: practiceProject(state, 0) };
  }
}
