import { existsSync, readFileSync, mkdirSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { practiceActionSchema } from '../../../packages/shared/src/practice-protocol.ts';
const card = z.object({ id: z.string(), cardId: z.string() });
const player = z.object({ name: z.string(), legend: z.string(), legendReady: z.boolean(), spellEnergy: z.number().nonnegative(), scored: z.array(z.number()), champion: card.optional(), hand: z.array(card), deck: z.array(card), trash: z.array(card), runes: z.array(z.object({ cardId: z.string(), ready: z.boolean() })), runeDeck: z.array(z.string()), score: z.number().nonnegative(), deathsThisTurn: z.number().int().nonnegative().optional() });
export const stateSchema = z.object({
  matchId: z.string(), firstPlayer: z.number().int().min(0).max(1), revision: z.number().int().nonnegative(), turn: z.number().int().positive(), active: z.number().int().min(0).max(1),
  players: z.array(player).length(2), units: z.array(card.extend({ owner: z.number().int().min(0).max(1), location: z.number().int().min(-1).max(1), ready: z.boolean(), bonus: z.number(), buff: z.boolean(), damage: z.number().nonnegative(), stunned: z.boolean().optional(), ganking: z.boolean().optional(), usedAbilities: z.array(z.string()).optional() })),
  fields: z.array(z.object({ cardId: z.string(), controller: z.number().int().min(0).max(1).optional() })).length(2), log: z.array(z.string()),
  events: z.array(z.object({ id: z.number().int(), type: z.enum(['play','move','combat','kill','score','activate','draw','turn','damage','rune','notice']), player: z.number().int().min(0).max(1), cardId: z.string().optional(), unit: z.string().optional(), field: z.number().optional(), amount: z.number().optional(), text: z.string() })), nextEvent: z.number().int(), nextId: z.number().int(), winner: z.number().int().min(0).max(1).optional(),
  interactive: z.boolean().optional(), priority: z.number().int().min(0).max(1).optional(), passes: z.number().int().nonnegative().optional(),
  chain: z.array(z.object({ player: z.number().int().min(0).max(1), card: card.optional(), cardId: z.string(), action: practiceActionSchema.refine(a => a.type === 'play' || a.type === 'activate') })).optional(),
  showdown: z.object({ field: z.number().int().min(0).max(1), attacker: z.number().int().min(0).max(1), focus: z.number().int().min(0).max(1), passes: z.number().int(), step: z.enum(['showdown','assign']), assignments: z.array(z.array(z.object({ unit: z.string(), amount: z.number().nonnegative() }))).length(2) }).optional(),
  task: z.object({ player: z.number().int().min(0).max(1), type: z.enum(['discard','retrieve']), count: z.number().int(), cardId: z.string() }).optional()
});
// Writes complete snapshots atomically. Bearer tokens are stored only as hashes.
export class Snapshots<T> {
  constructor(private file: string | undefined, private schema: z.ZodType) {}
  load(fallback: T): T {
    if (!this.file || !existsSync(this.file)) return fallback;
    try { return this.schema.parse(JSON.parse(readFileSync(this.file, 'utf8'))) as T; }
    catch { throw Error(`Invalid match snapshot: ${this.file}. Restore a valid backup before restarting.`); }
  }
  save(value: T) {
    if (!this.file) return;
    this.schema.parse(value);
    mkdirSync(path.dirname(this.file), { recursive: true });
    const temporary = `${this.file}.${randomUUID()}.tmp`;
    try { writeFileSync(temporary, JSON.stringify(value), { mode: 0o600 }); renameSync(temporary, this.file); }
    finally { if (existsSync(temporary)) unlinkSync(temporary); }
  }
}
