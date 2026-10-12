import { randomInt, randomUUID, randomBytes, createHash } from 'node:crypto';
import { z } from 'zod';
import { deckSchema } from '../../../packages/shared/src/index.ts';
import { riftboundStarters } from '../../../packages/riftbound-content/src/index.ts';
import { createPractice, practiceTransition, practiceProject, practiceActor, practiceActions, type PracticeState, type PracticeView } from '../../../packages/game-engine/src/practice.ts';
import { practiceActionSchema } from '../../../packages/shared/src/practice-protocol.ts';
import { Snapshots, stateSchema } from './snapshots.ts';
import { choosePracticeAction } from '../../../packages/game-engine/src/practice-ai.ts';
const schema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('start'), deck: deckSchema, opponent: z.string().max(60) }),
  z.object({ type: z.literal('resume'), token: z.string().regex(/^[a-f0-9]{64}$/) }),
  z.object({ type: z.literal('view') }),
  z.object({ type: z.literal('action'), revision: z.number().int().nonnegative(), action: practiceActionSchema })
]);
const snapshotSchema = z.object({ version: z.literal(1), matches: z.array(z.object({ key: z.string().regex(/^[a-f0-9]{64}$/), state: stateSchema })) });
const tokenKey = (token: string) => createHash('sha256').update(token).digest('hex');
export interface PracticeReply { ok: boolean; error?: string; view?: PracticeView; sequence?: PracticeView[]; requestId?: string; token?: string; restored?: boolean }
export function shuffle<T>(items: T[]): T[] { const result = [...items]; for (let i = result.length - 1; i > 0; i--) { const j = randomInt(i + 1); [result[i], result[j]] = [result[j], result[i]]; } return result; }
export class PracticeMatches {
  private matches = new Map<string, PracticeState>();
  private sockets = new Map<string, string>();
  private snapshots: Snapshots<{ version: 1; matches: { key: string; state: PracticeState }[] }>;
  constructor(private chooseFirst: () => number = () => randomInt(2), private shuffleCards: typeof shuffle = shuffle, file?: string) {
    this.snapshots = new Snapshots(file, snapshotSchema);
    const saved = this.snapshots.load({ version: 1, matches: [] });
    saved.matches.forEach(({ key, state }) => this.matches.set(key, state.interactive ? state : { ...state, interactive: true, chain: [], priority: undefined, passes: 0, revision: state.revision + 1 }));
  }
  private save(key: string, state: PracticeState) {
    const matches = new Map(this.matches); matches.set(key, state);
    this.snapshots.save({ version: 1, matches: [...matches].map(([key, state]) => ({ key, state })) });
    this.matches = matches;
  }
  private runAI(state: PracticeState) {
    const sequence = [practiceProject(state, 0)];
    let steps = 0;
    while (practiceActor(state) === 1 && state.winner === undefined) {
      state = practiceTransition(state, 1, steps++ >= 60 ? practiceActions(state, 1).find(a => a.type === 'pass' || a.type === 'end') ?? choosePracticeAction(practiceProject(state, 1)) : choosePracticeAction(practiceProject(state, 1)));
      sequence.push(practiceProject(state, 0));
    }
    return { state, sequence };
  }
  disconnect(socket: string) { this.sockets.delete(socket); }
  command(socket: string, input: unknown): PracticeReply {
    const parsed = schema.safeParse(input); if (!parsed.success) return { ok: false, error: 'Invalid practice command.' };
    const cmd = parsed.data;
    if (cmd.type === 'resume') {
      const key = tokenKey(cmd.token), state = this.matches.get(key);
      if (!state) return { ok: false, error: 'Saved match not found.' };
      // A single live binding prevents a previous connection continuing after takeover.
      for (const [id, existing] of this.sockets) if (existing === key) this.sockets.delete(id);
      this.sockets.set(socket, key); return { ok: true, view: practiceProject(state, 0) };
    }
    if (cmd.type === 'start') {
      const opponent = riftboundStarters.find(s => s.id === cmd.opponent);
      if (!opponent) return { ok: false, error: 'Choose a starter deck for the AI.' };
      try {
        const { state, sequence } = this.runAI(createPractice([{ name: 'You', deck: { ...cmd.deck, cards: this.shuffleCards(cmd.deck.cards), runes: this.shuffleCards(cmd.deck.runes ?? []) } }, { name: 'AI', deck: { ...opponent.deck, cards: this.shuffleCards(opponent.deck.cards), runes: this.shuffleCards(opponent.deck.runes) } }], this.chooseFirst(), randomUUID(), true));
        const token = randomBytes(32).toString('hex'), key = tokenKey(token);
        this.save(key, state); this.sockets.set(socket, key); return { ok: true, token, view: sequence.at(-1), sequence };
      } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Cannot start practice.' }; }
    }
    const key = this.sockets.get(socket);
    let state = key ? this.matches.get(key) : undefined; if (!state) return { ok: false, error: 'Start an AI practice match first.' };
    if (cmd.type === 'action') {
      if (state.revision !== cmd.revision) return { ok: false, error: 'Board changed. Refresh the match.', view: practiceProject(state, 0) };
      try {
        state = practiceTransition(state, 0, cmd.action);
        const result = this.runAI(state);
        state = result.state;
        this.save(key!, state);
        return { ok: true, view: result.sequence.at(-1), sequence: result.sequence };
      } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Practice action failed.', view: practiceProject(this.matches.get(key!)!, 0) }; }
    }
    return { ok: true, view: practiceProject(state, 0) };
  }
}
