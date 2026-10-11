import snapshot from './cards.json';
import type { Deck } from '../../shared/src/index.ts';
export const riftboundCards = snapshot.cards;
export type RiftboundCard = (typeof riftboundCards)[number];
export const riftboundCardById = Object.fromEntries(riftboundCards.map(card => [card.id, card])) as Record<string, RiftboundCard>;
export const displayName = (card: RiftboundCard) => card.subtitle && card.subtitle !== 'Starter' ? `${card.name}, ${card.subtitle}` : `${card.name}${card.set === 'OGS' ? ` (${card.domains.join('/')})` : ''}`;
export const originsListSource = 'https://riftmana.com/riftbound-preconstructed-origin-champion-starter-decks/';
export const provingGroundsListSource = 'https://riftmana.com/riftbound-proving-grounds-decklists/';
const expand = (list: string): string[] => list.split(' ').flatMap(part => { const [count, id] = part.split('x'); return Array(Number(count)).fill(id) as string[]; });
function precon(id: string, name: string, legend: string, champion: string, fields: string[], runes: string, main: string, product: 'Origins' | 'Proving Grounds') {
  return { id, product, source: product === 'Origins' ? originsListSource : provingGroundsListSource, deck: { name, game: 'riftbound' as const, legend, champion, battlefields: fields, runes: expand(runes), cards: expand(main) } };
}
// Counts describe the physical preconstructed products, including the chosen champion in the 40-card main deck.
export const riftboundStarters = [
  precon('origins-jinx', 'Jinx - Origins', 'OGN-251', 'OGN-030', ['OGN-289','OGN-298','OGN-285'], '6xOGN-007 6xOGN-166', '3xOGN-169 3xOGN-168 2xOGN-008 3xOGN-003 3xOGN-185 3xOGN-182 1xOGN-036 1xOGN-030 3xOGN-006 2xOGN-165 2xOGN-024 2xOGN-180 3xOGN-019 2xOGN-001 2xOGN-178 3xOGN-002 1xOGN-011 1xOGN-195', 'Origins'),
  precon('origins-viktor', 'Viktor - Origins', 'OGN-265', 'OGN-117', ['OGN-294','OGN-293','OGN-275'], '6xOGN-089 6xOGN-214', '2xOGN-090 2xOGN-095 3xOGN-209 2xOGN-213 2xOGN-093 3xOGN-216 2xOGN-101 3xOGN-103 2xOGN-206 2xOGN-094 3xOGN-084 3xOGN-222 1xOGN-111 2xOGN-083 3xOGN-208 1xOGN-117 2xOGN-086 1xOGN-118 1xOGN-233', 'Origins'),
  precon('origins-lee-sin', 'Lee Sin - Origins', 'OGN-257', 'OGN-151', ['OGN-282','OGN-289','OGN-280'], '6xOGN-042 6xOGN-126', '2xOGN-043 3xOGN-052 3xOGN-136 3xOGN-128 3xOGN-058 1xOGN-060 3xOGN-055 3xOGN-132 2xOGN-053 2xOGN-135 1xOGN-152 3xOGN-147 3xOGN-065 1xOGN-151 2xOGN-125 1xOGN-157 2xOGN-137 2xOGN-142', 'Origins'),
  precon('proving-grounds-annie', 'Annie - Proving Grounds', 'OGS-017', 'OGS-010', ['OGN-296'], '6xOGN-007 6xOGN-166', '3xOGN-169 3xOGN-170 3xOGN-171 3xOGN-185 3xOGS-003 2xOGN-013 2xOGS-011 3xOGN-176 3xOGN-005 2xOGS-010 3xOGN-191 2xOGS-001 3xOGN-174 3xOGS-002 2xOGS-018', 'Proving Grounds'),
  precon('proving-grounds-lux', 'Lux - Proving Grounds', 'OGS-021', 'OGS-014', ['OGN-288'], '6xOGN-089 6xOGN-214', '3xOGN-095 3xOGN-103 3xOGN-210 2xOGN-084 3xOGN-087 3xOGN-206 2xOGS-014 3xOGN-219 3xOGN-085 2xOGS-006 3xOGS-016 3xOGN-105 3xOGS-012 2xOGN-088 2xOGS-022', 'Proving Grounds'),
  precon('proving-grounds-garen', 'Garen - Proving Grounds', 'OGS-023', 'OGS-007', ['OGN-294'], '6xOGN-126 6xOGN-214', '3xOGN-210 3xOGN-129 3xOGN-130 3xOGN-132 3xOGN-211 3xOGN-222 3xOGN-206 3xOGN-219 2xOGN-131 2xOGN-215 2xOGS-024 2xOGS-007 2xOGS-013 3xOGS-016 3xOGS-015', 'Proving Grounds'),
  precon('proving-grounds-yi', 'Master Yi - Proving Grounds', 'OGS-019', 'OGS-004', ['OGN-279'], '6xOGN-042 6xOGN-126', '3xOGN-046 3xOGN-048 3xOGN-052 3xOGN-127 3xOGN-134 2xOGN-129 3xOGN-055 2xOGS-020 3xOGN-049 2xOGS-004 3xOGS-005 3xOGS-008 3xOGN-137 2xOGS-009 2xOGN-142', 'Proving Grounds')
];
export function isRiftboundDeck(deck: Deck) { return deck.game === 'riftbound'; }
