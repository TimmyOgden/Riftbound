import { z } from 'zod';
const id = z.string().min(1).max(80);
export const practiceActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('end') }), z.object({ type: z.literal('pass') }),
  z.object({ type: z.literal('activate'), source: id, target: id.optional(), mode: z.enum(['damage','stun','ready','ganking']).optional() }),
  z.object({ type: z.literal('play'), card: id, target: id.optional(), other: id.optional(), accelerate: z.boolean().optional(), exhaust: id.optional() }),
  z.object({ type: z.literal('move'), unit: id, field: z.number().int().min(-1).max(1) }),
  z.object({ type: z.literal('group-move'), units: z.array(id).min(1).max(30), field: z.number().int().min(-1).max(1) }),
  z.object({ type: z.literal('assign'), order: z.array(id).max(100) }),
  z.object({ type: z.literal('discard'), cards: z.array(id).max(100) }),
  z.object({ type: z.literal('retrieve'), card: id })
]);
