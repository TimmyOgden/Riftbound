export type Keyword = 'swift' | 'guard' | 'ward' | 'drain';
export type Effect = { kind: 'draw' | 'heal' | 'damage' | 'buff' | 'score' | 'energy'; amount: number; scope: 'self' | 'target' | 'allEnemies' };
export interface Card { id: string; name: string; type: 'resource' | 'unit' | 'spell' | 'champion'; cost: number; attack: number; health: number; keywords: Keyword[]; effects: Effect[]; trigger?: 'deploy' | 'death' | 'turn'; text: string; rarity: 'common' | 'rare' | 'legendary'; set: string; artwork: string; thumbnail: string; frame: string }
const names = ['Dawn Crystal','Tide Crystal','Ash Crystal','Grove Crystal','Star Crystal','Moss Courier','Ash Sentry','River Duelist','Moon Warden','Root Medic','Storm Finch','Cinder Hound','Stone Weaver','Dusk Scout','Dawn Keeper','Frost Herald','Briar Knight','Mist Archer','Sun Acolyte','Flame Pilgrim','Echo Seer','Cloud Rider','Iron Elk','Night Sentinel','Vale Shaman','Ember Bolt','Healing Rain','Wild Insight','Radiant Oath','Thunder Chorus','Frost Spark','Verdant Pact','Astral Study','Cinder Tribute','Tidal Gift','Astra of the Vale','Orin the Ember','Nyra of Tides','Tal the Keeper','Vesper Starbound'];
export const cards: Card[] = names.map((name, i) => {
  const type = i < 5 ? 'resource' : i < 25 ? 'unit' : i < 35 ? 'spell' : 'champion';
  const kind = (['draw', 'heal', 'damage', 'buff', 'score', 'energy'] as const)[i % 6];
  const effect: Effect = { kind, amount: 1 + Math.floor(i / 12), scope: kind === 'damage' || kind === 'buff' ? 'target' : 'self' };
  const keywords: Keyword[] = type === 'unit' || type === 'champion' ? [(['swift','guard','ward','drain'] as const)[i % 4]] : [];
  const id = `ec-${String(i + 1).padStart(2, '0')}`;
  return { id, name, type, cost: type === 'resource' ? 0 : 1 + i % 5, attack: 1 + i % 4, health: 2 + i % 5, keywords, effects: type === 'resource' ? [] : [effect], trigger: type === 'unit' || type === 'champion' ? (i % 3 === 0 ? 'death' : i % 3 === 1 ? 'turn' : 'deploy') : undefined, text: type === 'resource' ? 'Once per turn: gain one permanent energy capacity.' : `${type === 'spell' ? 'Resolve' : i % 3 === 0 ? 'On death' : i % 3 === 1 ? 'At your turn start' : 'On deployment'}: ${kind} ${effect.amount} (${effect.scope}). ${keywords.join(', ')}`, rarity: type === 'champion' ? 'legendary' : i % 3 ? 'common' : 'rare', set: 'Ember Concord / First Light', artwork: '/art/placeholder.svg', thumbnail: '/art/placeholder.svg', frame: type };
});
export const cardById = Object.fromEntries(cards.map(c => [c.id,c])) as Record<string, Card>;
export const starterDeck = { name: 'First Light', cards: [...Array.from({length: 10}, (_, i) => cards[i % 5].id), ...Array.from({length: 20}, (_, i) => cards[5 + i].id)] };
export interface AuthorizedAssetProvider { moduleId: string; getArtwork(cardId: string): Promise<{ thumbnail: string; full: string; license: string }>; }
