import snapshot from './cards.json';
import type { Deck } from '../../shared/src/index.ts';
export const riftboundCards = snapshot.cards;
export type RiftboundCard = (typeof riftboundCards)[number];
export const riftboundCardById = Object.fromEntries(riftboundCards.map(card => [card.id, card])) as Record<string, RiftboundCard>;
export const displayName = (card: RiftboundCard) => card.subtitle && card.subtitle !== 'Starter' ? `${card.name}, ${card.subtitle}` : `${card.name}${card.set === 'OGS' ? ` (${card.domains.join('/')})` : ''}`;
export const originsListSource = 'https://riftmana.com/riftbound-preconstructed-origin-champion-starter-decks/';
export const provingGroundsListSource = 'https://riftmana.com/riftbound-proving-grounds-decklists/';
export const spiritforgedListSource = 'https://playriftbound.com/en-us/news/announcements/spiritforged-precons-fiora-rumble/';
export const unleashedListSource = 'https://playriftbound.com/en-us/news/announcements/vi--vex-champion-decks/';
export const vendettaListSource = 'https://playriftbound.com/en-us/news/announcements/the-vendetta-overview/';
type Product = 'Origins' | 'Proving Grounds' | 'Spiritforged' | 'Unleashed' | 'Vendetta';
const listSources: Record<Product, string> = { Origins: originsListSource, 'Proving Grounds': provingGroundsListSource, Spiritforged: spiritforgedListSource, Unleashed: unleashedListSource, Vendetta: vendettaListSource };
const expand = (list: string): string[] => list.split(' ').flatMap(part => { const [count, id] = part.split('x'); return Array(Number(count)).fill(id) as string[]; });
function precon(id: string, name: string, legend: string, champion: string, fields: string[], runes: string, main: string, product: Product) {
  return { id, product, source: listSources[product], deck: { name, game: 'riftbound' as const, legend, champion, battlefields: fields, runes: expand(runes), cards: expand(main) } };
}
// Counts describe the physical preconstructed products, including the chosen champion in the 40-card main deck.
export const riftboundStarters = [
  precon('origins-jinx', 'Jinx - Origins', 'OGN-251', 'OGN-030', ['OGN-289','OGN-298','OGN-285'], '6xOGN-007 6xOGN-166', '3xOGN-169 3xOGN-168 2xOGN-008 3xOGN-003 3xOGN-185 3xOGN-182 1xOGN-036 1xOGN-030 3xOGN-006 2xOGN-165 2xOGN-024 2xOGN-180 3xOGN-019 2xOGN-001 2xOGN-178 3xOGN-002 1xOGN-011 1xOGN-195', 'Origins'),
  precon('origins-viktor', 'Viktor - Origins', 'OGN-265', 'OGN-117', ['OGN-294','OGN-293','OGN-275'], '6xOGN-089 6xOGN-214', '2xOGN-090 2xOGN-095 3xOGN-209 2xOGN-213 2xOGN-093 3xOGN-216 2xOGN-101 3xOGN-103 2xOGN-206 2xOGN-094 3xOGN-084 3xOGN-222 1xOGN-111 2xOGN-083 3xOGN-208 1xOGN-117 2xOGN-086 1xOGN-118 1xOGN-233', 'Origins'),
  precon('origins-lee-sin', 'Lee Sin - Origins', 'OGN-257', 'OGN-151', ['OGN-282','OGN-289','OGN-280'], '6xOGN-042 6xOGN-126', '2xOGN-043 3xOGN-052 3xOGN-136 3xOGN-128 3xOGN-058 1xOGN-060 3xOGN-055 3xOGN-132 2xOGN-053 2xOGN-135 1xOGN-152 3xOGN-147 3xOGN-065 1xOGN-151 2xOGN-125 1xOGN-157 2xOGN-137 2xOGN-142', 'Origins'),
  precon('proving-grounds-annie', 'Annie - Proving Grounds', 'OGS-017', 'OGS-010', ['OGN-296'], '6xOGN-007 6xOGN-166', '3xOGN-169 3xOGN-170 3xOGN-171 3xOGN-185 3xOGS-003 2xOGN-013 2xOGS-011 3xOGN-176 3xOGN-005 2xOGS-010 3xOGN-191 2xOGS-001 3xOGN-174 3xOGS-002 2xOGS-018', 'Proving Grounds'),
  precon('proving-grounds-lux', 'Lux - Proving Grounds', 'OGS-021', 'OGS-014', ['OGN-288'], '6xOGN-089 6xOGN-214', '3xOGN-095 3xOGN-103 3xOGN-210 2xOGN-084 3xOGN-087 3xOGN-206 2xOGS-014 3xOGN-219 3xOGN-085 2xOGS-006 3xOGS-016 3xOGN-105 3xOGS-012 2xOGN-088 2xOGS-022', 'Proving Grounds'),
  precon('proving-grounds-garen', 'Garen - Proving Grounds', 'OGS-023', 'OGS-007', ['OGN-294'], '6xOGN-126 6xOGN-214', '3xOGN-210 3xOGN-129 3xOGN-130 3xOGN-132 3xOGN-211 3xOGN-222 3xOGN-206 3xOGN-219 2xOGN-131 2xOGN-215 2xOGS-024 2xOGS-007 2xOGS-013 3xOGS-016 3xOGS-015', 'Proving Grounds'),
  precon('proving-grounds-yi', 'Master Yi - Proving Grounds', 'OGS-019', 'OGS-004', ['OGN-279'], '6xOGN-042 6xOGN-126', '3xOGN-046 3xOGN-048 3xOGN-052 3xOGN-127 3xOGN-134 2xOGN-129 3xOGN-055 2xOGS-020 3xOGN-049 2xOGS-004 3xOGS-005 3xOGS-008 3xOGN-137 2xOGS-009 2xOGN-142', 'Proving Grounds'),
  precon('spiritforged-rumble', 'Rumble - Spiritforged', 'SFD-181', 'SFD-089', ['SFD-212','SFD-215','SFD-220'], '6xOGN-089 6xOGN-007', '2xSFD-021 2xSFD-026 3xSFD-007 3xOGN-016 3xSFD-065 3xSFD-062 3xSFD-069 2xSFD-071 1xSFD-089 2xOGN-083 1xOGN-105 2xSFD-070 2xSFD-066 3xSFD-076 2xOGN-095 3xOGN-024 1xSFD-182 1xSFD-019 1xSFD-022', 'Spiritforged'),
  precon('spiritforged-fiora', 'Fiora - Spiritforged', 'SFD-205', 'SFD-180', ['SFD-213','SFD-221','SFD-218'], '6xOGN-214 6xOGN-126', '2xSFD-110 2xSFD-103 2xSFD-156 2xSFD-113 2xSFD-099 2xOGN-136 2xSFD-093 2xSFD-167 2xSFD-157 1xSFD-180 1xSFD-116 2xSFD-097 3xSFD-107 2xOGN-229 1xSFD-206 2xSFD-106 3xSFD-161 3xSFD-108 1xSFD-172 3xSFD-095', 'Spiritforged'),
  precon('unleashed-vex', 'Vex - Unleashed', 'UNL-193', 'UNL-150', ['UNL-207','UNL-213','UNL-214'], '6xOGN-042 6xOGN-166', '2xUNL-036 1xUNL-035 2xUNL-134 2xUNL-041 3xUNL-042 1xUNL-043 2xUNL-048 2xUNL-133 1xUNL-126 1xUNL-141 1xUNL-052 1xUNL-050 1xUNL-194 1xUNL-136 2xUNL-039 2xUNL-127 2xUNL-038 2xUNL-031 2xUNL-034 3xUNL-040 2xUNL-047 1xUNL-150 1xSFD-146 2xUNL-055', 'Unleashed'),
  precon('unleashed-vi', 'Vi - Unleashed', 'UNL-187', 'UNL-030', ['UNL-217','UNL-215','UNL-218'], '6xOGN-214 6xOGN-007', '2xUNL-010 3xUNL-002 2xUNL-156 2xUNL-154 2xUNL-006 2xUNL-017 1xUNL-188 2xUNL-015 1xUNL-001 2xUNL-012 2xUNL-008 2xUNL-018 2xUNL-153 1xUNL-024 2xSFD-009 1xUNL-175 2xUNL-161 2xUNL-163 1xUNL-026 1xUNL-009 1xUNL-159 1xOGN-036 1xUNL-030 2xUNL-176', 'Unleashed'),
  precon('vendetta-shen', 'Shen - Vendetta', 'VEN-147', 'VEN-138', ['VEN-159','OGN-280','VEN-166'], '6xOGN-214 6xOGN-042', '1xVEN-148 1xVEN-043 1xVEN-135 2xVEN-129 1xVEN-034 1xVEN-126 2xOGN-058 2xVEN-128 2xVEN-033 1xVEN-127 3xVEN-028 3xVEN-117 2xVEN-027 1xVEN-031 2xVEN-123 2xVEN-119 2xVEN-026 2xOGN-043 2xVEN-030 2xUNL-156 1xVEN-116 1xVEN-138 2xVEN-042 1xOGN-241', 'Vendetta'),
  precon('vendetta-zed', 'Zed - Vendetta', 'VEN-143', 'VEN-023', ['OGN-298','VEN-165','VEN-166'], '6xOGN-166 6xOGN-007', '1xVEN-110 1xVEN-017 1xVEN-144 1xVEN-020 2xVEN-105 2xVEN-012 1xVEN-106 2xVEN-101 2xVEN-014 3xVEN-013 1xVEN-102 2xOGN-185 3xVEN-095 3xVEN-007 3xVEN-008 3xVEN-096 3xVEN-002 3xVEN-093 2xVEN-112 1xVEN-023', 'Vendetta')
];
export function isRiftboundDeck(deck: Deck) { return deck.game === 'riftbound'; }
