import { riftboundCardById as cards } from '../../riftbound-content/src/index.ts';
import { practiceActions, practiceMight, type PracticeAction, type PracticeView, type PracticeState } from './practice.ts';
// Receives a player projection, never the full game state or the opponent's hand/decks.
export function choosePracticeAction(view: PracticeView): PracticeAction {
  const player = view.active, own = view.players[player];
  const value = (action: PracticeAction) => {
    if (action.type === 'end') return 0;
    if (action.type === 'activate') {
      if (action.source === 'legend') return own.legend === 'OGN-265' ? 7 : view.units.find(u => u.id === action.target)?.buff ? -1 : 9;
      // Lux energy is useful only when it unlocks an implemented legal spell.
      const boosted = structuredClone(view) as unknown as PracticeState;
      boosted.players[player].spellEnergy += 2;
      const spells = new Set((own.hand ?? []).filter(c => cards[c.cardId]?.types.includes('spell')).map(c => c.id));
      return practiceActions(boosted, player).some(a => a.type === 'play' && spells.has(a.card)) ? 2 : -1;
    }
    if (action.type === 'play') {
      const instance = [...(own.hand ?? []), ...(own.champion ? [own.champion] : [])].find(c => c.id === action.card)!;
      const card = cards[instance.cardId], target = view.units.find(u => u.id === action.target);
      if (card.types.includes('unit')) return 15 + card.might * 2 - card.energy + (action.accelerate ? 6 : 0);
      if (card.types.includes('gear')) return -1; // Unimplemented gear effects provide no advantage in this beta.
      if (['OGN-083','OGN-048','OGN-134','OGN-129','OGS-015','OGN-094'].includes(card.id)) return 8;
      if (target && target.owner !== player && ['OGN-024','OGN-005','OGN-085','OGS-003','OGS-022','OGS-012','OGN-169','OGN-168','OGS-002','OGN-095','OGN-093'].includes(card.id)) return 12 + (cards[target.cardId]?.might ?? 1) / 2;
      if (target?.owner === player && ['OGN-058','OGN-046','OGN-053','OGN-206','OGN-128','OGS-008'].includes(card.id)) return 5;
      return -2;
    }
    const unit = view.units.find(u => u.id === action.unit)!;
    if (action.field < 0) return -3;
    if (view.fields[action.field].controller === player) return -1;
    const enemies = view.units.filter(u => u.owner !== player && u.location === action.field);
    if (!enemies.length) return 35;
    const publicState = view as unknown as PracticeState; // Might uses only public units, runes, legends and fields.
    const attack = practiceMight(publicState, { ...unit, location: action.field }, 'attacker');
    const defense = enemies.reduce((sum, u) => sum + practiceMight(publicState, u, 'defender'), 0);
    return attack > defense ? 25 + attack - defense : attack === defense ? 3 : -5;
  };
  return [...view.legal].sort((a, b) => value(b) - value(a))[0] ?? { type: 'end' };
}
