import type { PracticeAction } from '../../../packages/game-engine/src/practice.ts';
import type { DragCard, DropZone } from './useCardDrag.ts';

// Choose exclusively from the latest server legal actions, never invent a command.
export function resolveCardDrop(legal: PracticeAction[], card: DragCard, zone: DropZone, accelerate = false): PracticeAction | undefined {
  if (card.kind === 'unit') return legal.find(a => a.type === 'move' && a.unit === card.id && a.field === zone.field);
  const plays = legal.filter((a): a is Extract<PracticeAction, { type: 'play' }> => a.type === 'play' && a.card === card.id && !!a.accelerate === accelerate);
  return (zone.unit ? plays.find(a => a.target === zone.unit) : undefined) ?? (zone.field === -1 ? plays.find(a => !a.target) : undefined);
}
