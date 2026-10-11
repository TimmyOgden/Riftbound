import { cardById, type Effect } from '../../game-content/src/index.ts';
import type { Format } from '../../shared/src/index.ts';
export interface Instance { id: string; cardId: string }
export interface Unit extends Instance { owner: string; lane: number; attack: number; health: number; ready: boolean; ward: boolean }
export interface Player { id: string; team: number; health: number; score: number; energy: number; capacity: number; resourcePlayed: boolean; deck: Instance[]; hand: Instance[]; discard: Instance[] }
export interface State { revision: number; turn: number; active: number; format: Format; players: Player[]; units: Unit[]; log: string[]; winner?: number; nextId: number }
export type Action = { type: 'end' } | { type: 'play'; card: string; lane: number; target?: string } | { type: 'attack'; unit: string; target: string } | { type: 'move'; unit: string; lane: number };
export function createGame(format: Format, entrants: { id: string; deck: string[] }[]): State {
  if (entrants.length !== (format === 'duel' ? 2 : 4)) throw Error('Wrong player count');
  const state: State = { revision: 0, turn: 1, active: 0, format, units: [], log: ['Match begins.'], nextId: 1, players: entrants.map((e,i) => ({ id:e.id, team:format === 'teams' ? i % 2 : i, health:20, score:0, energy:1, capacity:1, resourcePlayed:false, hand:[], discard:[], deck:e.deck.map((cardId,n) => ({cardId,id:`${e.id}-${n}`})) })) };
  for (const p of state.players) draw(state,p,5);
  return state;
}
function draw(s: State,p: Player,n: number) { for(let i=0;i<n;i++) { const card=p.deck.shift(); if(card) p.hand.push(card); else p.health--; } }
function enemy(s:State,a:string,b:string) { return s.players.find(p=>p.id===a)?.team !== s.players.find(p=>p.id===b)?.team; }
function effect(s:State,owner:Player,e:Effect,target?:string) {
  const u=s.units.find(u=>u.id===target); const p=s.players.find(p=>p.id===target);
  if(e.kind==='draw') draw(s,owner,e.amount);
  if(e.kind==='heal') owner.health=Math.min(20,owner.health+e.amount);
  if(e.kind==='score') owner.score+=e.amount;
  if(e.kind==='energy') owner.energy+=e.amount;
  if(e.kind==='buff' && u) {u.attack+=e.amount;u.health+=e.amount;}
  if(e.kind==='damage') { if(u) {if(u.ward) u.ward=false;else u.health-=e.amount;} else if(p) p.health-=e.amount; }
}
function settle(s:State) {
  let iterations=0;
  while(s.units.some(u=>u.health<=0)) { if(++iterations>100) throw Error('Effect loop'); const dead=s.units.filter(u=>u.health<=0);s.units=s.units.filter(u=>u.health>0); for(const u of dead) {const p=s.players.find(p=>p.id===u.owner)!;p.discard.push({id:u.id,cardId:u.cardId}); const c=cardById[u.cardId];if(c.trigger==='death') for(const e of c.effects) effect(s,p,e,s.players.find(q=>enemy(s,p.id,q.id)&&q.health>0)?.id);s.log.push(`${c.name} falls.`);} }
  for(const p of s.players.filter(p=>p.health<=0)) {s.units=s.units.filter(u=>u.owner!==p.id);}
  const alive=[...new Set(s.players.filter(p=>p.health>0).map(p=>p.team))];
  const scores=new Map<number,number>();for(const p of s.players) scores.set(p.team,(scores.get(p.team)??0)+p.score);
  const scored=[...scores].find(([,score])=>score>=12);
  if(scored) s.winner=scored[0];else if(alive.length<=1) s.winner=alive[0]??-1;
}
export function reason(s:State,id:string,a:Action): string | undefined {
  const p=s.players[s.active];if(s.winner!==undefined) return 'Match is complete.';if(p.id!==id) return 'Wait for your turn.';
  if(a.type==='end') return;
  if(a.type==='play') {const inst=p.hand.find(c=>c.id===a.card);if(!inst) return 'Card is not in your hand.';const c=cardById[inst.cardId];if(!c) return 'Unknown card.';if(c.cost>p.energy) return 'Insufficient energy.';if(!Number.isInteger(a.lane)||a.lane<0||a.lane>2) return 'Invalid battlefield.';if(c.type==='resource'&&p.resourcePlayed) return 'Only one resource per turn.';if((c.type==='unit'||c.type==='champion')&&s.units.filter(u=>u.owner===id&&u.lane===a.lane).length>=3) return 'Battlefield is full.';
    if(c.effects.some(e=>e.scope==='target') && (c.type==='spell'||c.trigger==='deploy')) {const u=s.units.find(u=>u.id===a.target);const targetPlayer=s.players.find(q=>q.id===a.target&&q.health>0);if(c.effects.some(e=>e.kind==='damage')&& !((u&&enemy(s,id,u.owner))||(targetPlayer&&enemy(s,id,targetPlayer.id)))) return 'Choose an enemy target.';if(c.effects.some(e=>e.kind==='buff')&&(!u||u.owner!==id)) return 'Choose your unit.';}return;
  }
  const u=s.units.find(u=>u.id===a.unit);if(!u||u.owner!==id) return 'You do not control that unit.';if(!u.ready) return 'Unit is exhausted.';
  if(a.type==='move') {if(!Number.isInteger(a.lane)||a.lane<0||a.lane>2||a.lane===u.lane) return 'Choose another battlefield.';if(s.units.filter(v=>v.owner===id&&v.lane===a.lane).length>=3) return 'Battlefield is full.';return;}
  const t=s.units.find(v=>v.id===a.target);const q=s.players.find(q=>q.id===a.target&&q.health>0);if(t && (!enemy(s,id,t.owner)||t.lane!==u.lane)) return 'Attack an enemy in this battlefield.';if(!t&&!q) return 'Invalid target.';if(q&&!enemy(s,id,q.id)) return 'Cannot attack allies.';const guards=s.units.filter(v=>enemy(s,id,v.owner)&&v.lane===u.lane&&cardById[v.cardId].keywords.includes('guard'));if(guards.length&&!guards.some(v=>v.id===a.target)) return 'A guard must be attacked first.';
}
export function transition(state:State,id:string,action:Action):State {
  const error=reason(state,id,action);if(error) throw Error(error);const s=structuredClone(state);const p=s.players[s.active];s.revision++;
  if(action.type==='play') {const index=p.hand.findIndex(c=>c.id===action.card);const inst=p.hand.splice(index,1)[0];const c=cardById[inst.cardId];p.energy-=c.cost;if(c.type==='resource') {p.resourcePlayed=true;p.capacity++;p.energy++;p.discard.push(inst);}else {if(c.type==='unit'||c.type==='champion') s.units.push({...inst,owner:id,lane:action.lane,attack:c.attack,health:c.health,ready:c.keywords.includes('swift'),ward:c.keywords.includes('ward')});else p.discard.push(inst);if(c.type==='spell'||c.trigger==='deploy') for(const e of c.effects) effect(s,p,e,action.target);}s.log.push(`${id} plays ${c.name}.`);}
  if(action.type==='move') {const u=s.units.find(u=>u.id===action.unit)!;u.lane=action.lane;u.ready=false;s.log.push(`${id} moves ${cardById[u.cardId].name}.`);}
  if(action.type==='attack') {const u=s.units.find(u=>u.id===action.unit)!;const t=s.units.find(u=>u.id===action.target);const q=s.players.find(p=>p.id===action.target);u.ready=false;if(t) {if(t.ward)t.ward=false;else t.health-=u.attack;if(u.ward)u.ward=false;else u.health-=t.attack;}else q!.health-=u.attack;if(cardById[u.cardId].keywords.includes('drain'))p.health=Math.min(20,p.health+u.attack);s.log.push(`${cardById[u.cardId].name} attacks for ${u.attack}.`);}
  settle(s);
  if(action.type==='end'&&s.winner===undefined) {for(let lane=0;lane<3;lane++) {const teams=[...new Set(s.units.filter(u=>u.lane===lane).map(u=>s.players.find(p=>p.id===u.owner)!.team))];if(teams.length===1&&teams[0]===p.team) {p.score++;s.log.push(`${id} scores at battlefield ${lane+1}.`);}}settle(s);if(s.winner===undefined) {do{s.active=(s.active+1)%s.players.length;}while(s.players[s.active].health<=0);s.turn++;const next=s.players[s.active];next.energy=next.capacity;next.resourcePlayed=false;draw(s,next,1);for(const u of s.units.filter(u=>u.owner===next.id)) {u.ready=true;const c=cardById[u.cardId];if(c.trigger==='turn') for(const e of c.effects) effect(s,next,e,e.kind==='buff'?u.id:s.players.find(q=>enemy(s,next.id,q.id)&&q.health>0)?.id);}settle(s);s.log.push(`${next.id}'s turn.`);}}
  return s;
}
export function legalActions(s:State,id:string):Action[] {const p=s.players.find(p=>p.id===id);if(!p)return [];const candidates:Action[]=[{type:'end'}];const targets=[...s.players.map(p=>p.id),...s.units.map(u=>u.id)];for(const c of p.hand)for(let lane=0;lane<3;lane++)for(const target of [undefined,...targets]) candidates.push({type:'play',card:c.id,lane,target});for(const u of s.units.filter(u=>u.owner===id)){for(const target of targets)candidates.push({type:'attack',unit:u.id,target});for(let lane=0;lane<3;lane++)candidates.push({type:'move',unit:u.id,lane});}return candidates.filter(a=>!reason(s,id,a));}
export function project(s:State,id:string) {return {...s,players:s.players.map(p=>({...p,deck:undefined,deckCount:p.deck.length,hand:p.id===id?p.hand:undefined,handCount:p.hand.length})),legal:legalActions(s,id)};}
