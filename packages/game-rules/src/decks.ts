import type { Deck } from '../../shared/src/index.ts';
import { originalModule } from './index.ts';
import { validateRiftboundDeck } from './riftbound.ts';
export const validateDeck = (deck: Deck) => deck.game === 'riftbound' ? validateRiftboundDeck(deck) : originalModule.validateDeck(deck);
