import type { Deck } from '../../shared/src/index.ts';
import { displayName, riftboundCardById as byId, riftboundStarters } from '../../riftbound-content/src/index.ts';
const banned = new Set(['OGN-182','OGN-168','OGN-183','OGN-177','OGN-285','OGN-276','OGN-284','OGN-290']);
const sorted = (items: string[] | undefined) => JSON.stringify([...(items ?? [])].sort());
export function exactStarter(deck: Deck) {
  return riftboundStarters.find(({ deck: starter }) => deck.legend === starter.legend && deck.champion === starter.champion && sorted(deck.cards) === sorted(starter.cards) && sorted(deck.runes) === sorted(starter.runes) && sorted(deck.battlefields) === sorted(starter.battlefields));
}
export function validateRiftboundDeck(deck: Deck): string[] {
  const errors: string[] = [];
  const legend = byId[deck.legend ?? ''], champion = byId[deck.champion ?? ''];
  if (!legend?.types.includes('legend')) errors.push('Choose a champion legend.');
  if (!champion?.types.includes('unit') || !champion.superTypes.includes('champion')) errors.push('Choose a champion unit.');
  if (legend && champion && !legend.tags.some(tag => champion.tags.includes(tag))) errors.push('Chosen champion must match the legend.');
  if (deck.cards.length < 40) errors.push('Main deck needs at least 40 cards, including the chosen champion.');
  if (!deck.cards.includes(deck.champion ?? '')) errors.push('Include the chosen champion in your main deck.');
  if (deck.runes?.length !== 12) errors.push('Rune deck needs exactly 12 runes.');
  const starter = exactStarter(deck);
  if (deck.battlefields?.length !== 3 && !(starter?.product === 'Proving Grounds' && deck.battlefields?.length === 1)) errors.push('Choose three different battlefields (unmodified Proving Grounds decks use one).');
  const fieldNames = (deck.battlefields ?? []).map(id => byId[id]?.name ?? id);
  if (new Set(fieldNames).size !== fieldNames.length) errors.push('Battlefields must have different names.');
  let signatures = 0;
  const counts = new Map<string, number>();
  for (const [zone, ids] of [['main', deck.cards], ['runes', deck.runes ?? []], ['battlefields', deck.battlefields ?? []]] as const) {
    for (const id of ids) {
      const card = byId[id];
      if (!card) { errors.push(`Unknown card: ${id}`); continue; }
      if (legend && card.domains.some(domain => !legend.domains.includes(domain))) errors.push(`${displayName(card)} is outside the legend's domains.`);
      if (zone === 'main') {
        if (!card.types.some(type => ['unit','gear','spell'].includes(type)) || card.superTypes.includes('token')) errors.push(`${displayName(card)} cannot go in the main deck.`);
        const key = displayName(card); counts.set(key, (counts.get(key) ?? 0) + 1);
        if (card.superTypes.includes('signature')) { signatures++; if (!legend?.tags.some(tag => card.tags.includes(tag))) errors.push('Signature cards must match your legend.'); }
      } else if (zone === 'runes' && !card.types.includes('rune')) errors.push('Rune deck may only contain runes.');
      else if (zone === 'battlefields' && !card.types.includes('battlefield')) errors.push('Choose battlefield cards for the battlefield slots.');
      if (!starter && banned.has(id)) errors.push(`${displayName(card)} is banned in constructed decks. Exact retail starter lists are allowed for casual practice.`);
    }
  }
  if ([...counts.values()].some(count => count > 3)) errors.push('Maximum three copies of each main-deck card, including your chosen champion.');
  if (signatures > 3) errors.push('Maximum three signature cards total.');
  return [...new Set(errors)];
}
