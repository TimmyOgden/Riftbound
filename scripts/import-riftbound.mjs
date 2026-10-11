import { mkdir, writeFile } from 'node:fs/promises';
const source = 'https://content.publishing.riotgames.com/publishing-content/v2.0/public/channel/riftbound_website/list/riftbound_gallery_cards?locale=en_US&from=0&limit=2000';
const response = await fetch(source);
if (!response.ok) throw Error(`Official gallery returned ${response.status}`);
const payload = await response.json();
const decode = value => String(value ?? '').replace(/\\u([0-9a-f]{4})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
const cards = payload.data.filter(card => ['OGN', 'OGS'].includes(card.set?.value?.id) && /^og[ns]-\d{3}-\d{3}$/.test(card.id)).map(card => ({
  id: card.publicCode.split('/')[0], name: decode(card.name), subtitle: decode(card.subtitle), set: card.set.value.id,
  types: card.cardType.type.map(type => type.id), superTypes: (card.cardType.superType ?? []).map(type => type.id),
  domains: (card.domain?.values ?? []).map(domain => domain.id).filter(domain => domain !== 'colorless'), tags: card.tags?.tags ?? [],
  energy: Number(card.energy?.value?.id ?? 0), power: Number(card.power?.value?.id ?? 0), might: Number(card.might?.value?.id ?? 0),
  text: decode(card.text?.richText?.body).replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'"),
  image: card.cardImage?.url ?? ''
}));
if (cards.length < 300 || !cards.some(card => card.id === 'OGN-251')) throw Error('Unexpected gallery payload');
await mkdir('packages/riftbound-content/src', { recursive: true });
await writeFile('packages/riftbound-content/src/cards.json', JSON.stringify({ source, fetchedAt: new Date().toISOString(), cards }, null, 2) + '\n');
console.log(`Imported ${cards.length} Origins / Proving Grounds cards from Riot's gallery.`);
