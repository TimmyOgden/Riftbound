import { z } from 'zod';
export const formatSchema = z.enum(['duel', 'teams', 'free-for-all']);
export type Format = z.infer<typeof formatSchema>;
export const deckSchema = z.object({ name: z.string().trim().min(1).max(60), cards: z.array(z.string().max(60)).max(100), game: z.enum(['ember-concord', 'riftbound']).optional(), legend: z.string().max(60).optional(), champion: z.string().max(60).optional(), runes: z.array(z.string().max(60)).max(12).optional(), battlefields: z.array(z.string().max(60)).max(3).optional() });
export type Deck = z.infer<typeof deckSchema>;
export const commandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('create'), nickname: z.string().trim().min(1).max(24), password: z.string().max(64).default(''), format: formatSchema }),
  z.object({ type: z.literal('join'), nickname: z.string().trim().min(1).max(24), code: z.string().regex(/^[A-Z2-9]{6}$/), password: z.string().max(64).default('') }),
  z.object({ type: z.literal('resume'), token: z.string().length(64) }),
  z.object({ type: z.literal('ready'), ready: z.boolean(), deck: deckSchema }),
  z.object({ type: z.literal('format'), format: formatSchema }),
  z.object({ type: z.literal('start') }),
  z.object({ type: z.literal('action'), revision: z.number().int().nonnegative(), action: z.discriminatedUnion('type', [
    z.object({ type: z.literal('end') }),
    z.object({ type: z.literal('play'), card: z.string().max(80), lane: z.number().int().min(0).max(2), target: z.string().max(80).optional() }),
    z.object({ type: z.literal('attack'), unit: z.string().max(80), target: z.string().max(80) }),
    z.object({ type: z.literal('move'), unit: z.string().max(80), lane: z.number().int().min(0).max(2) })
  ]) })
]);
export interface LobbyView { code: string; format: Format; host: string; players: { id: string; nickname: string; ready: boolean; connected: boolean }[] }
export interface Reply { ok: boolean; error?: string; token?: string; playerId?: string; requestId?: string }
