import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { commandSchema, type LobbyView, type Reply, type Deck, type Format } from '../../../packages/shared/src/index.ts';
import { z } from 'zod';
import { practiceActionSchema } from '../../../packages/shared/src/practice-protocol.ts';
import { createPractice, practiceTransition, type PracticeState, type PracticeView } from '../../../packages/game-engine/src/practice.ts';
import { matchView } from './match-view.ts';
import { shuffle } from './practice.ts';
import { Snapshots, stateSchema } from './snapshots.ts';
import { deckSchema } from '../../../packages/shared/src/index.ts';
import { originalModule } from '../../../packages/game-rules/src/index.ts';
import { validateDeck } from '../../../packages/game-rules/src/decks.ts';

interface Member { id: string; nickname: string; ready: boolean; connected: boolean; deck?: Deck; socket: string }
interface Room { code: string; format: Format; host: string; password: Buffer; players: Member[]; match?: PracticeState }
export class Lobby {
  private rooms = new Map<string, Room>();
  private sessions = new Map<string, { room: Room; player: Member }>();
  private sockets = new Map<string, { room: Room; player: Member }>();
  private snapshots: Snapshots<unknown>;
  constructor(private publish: (sockets: string[], view: LobbyView) => void, private publishMatch: (socket: string, view: PracticeView) => void = () => {}, file?: string) {
    const member = z.object({ id: z.string(), nickname: z.string(), ready: z.boolean(), deck: deckSchema.optional(), key: z.string().regex(/^[a-f0-9]{64}$/) });
    const schema = z.object({ version: z.literal(1), rooms: z.array(z.object({ code: z.string(), format: z.enum(['duel','teams','free-for-all']), host: z.string(), password: z.string().regex(/^[a-f0-9]{64}$/), players: z.array(member).max(4), match: stateSchema.optional() })) });
    this.snapshots = new Snapshots(file, schema);
    const saved = this.snapshots.load({ version: 1, rooms: [] }) as z.infer<typeof schema>;
    for (const savedRoom of saved.rooms) {
      const room: Room = { ...savedRoom, password: Buffer.from(savedRoom.password, 'hex'), match: savedRoom.match as PracticeState | undefined, players: savedRoom.players.map(p => ({ ...p, socket: '', connected: false })) };
      this.rooms.set(room.code, room);
      savedRoom.players.forEach((p, i) => this.sessions.set(p.key, { room, player: room.players[i] }));
    }
  }
  private save() {
    this.snapshots.save({ version: 1, rooms: [...this.rooms.values()].map(room => ({ code: room.code, format: room.format, host: room.host, password: room.password.toString('hex'), match: room.match, players: room.players.map(p => ({ id: p.id, nickname: p.nickname, ready: p.ready, deck: p.deck, key: [...this.sessions].find(([, s]) => s.player.id === p.id)![0] })) })) });
  }
  private emitMatch(room: Room) { if (room.match) room.players.forEach((p, i) => { if (p.connected) this.publishMatch(p.socket, matchView(room.match!, i)); }); }
  matchCommand(socket: string, input: unknown): { ok: boolean; error?: string; view?: PracticeView } {
    const parsed = z.discriminatedUnion('type', [z.object({ type: z.literal('view') }), z.object({ type: z.literal('action'), revision: z.number().int().nonnegative(), action: practiceActionSchema })]).safeParse(input);
    if (!parsed.success) return { ok: false, error: 'Invalid match command.' };
    const session = this.sockets.get(socket);
    if (!session?.room.match) return { ok: false, error: 'Start a friend match first.' };
    const { room, player } = session, index = room.players.indexOf(player);
    if (parsed.data.type === 'action') {
      if (parsed.data.revision !== room.match!.revision) return { ok: false, error: 'Board changed. The latest board has been restored.', view: matchView(room.match!, index) };
      try {
        const previous = room.match; room.match = practiceTransition(room.match!, index, parsed.data.action);
        try { this.save(); } catch (error) { room.match = previous; throw error; }
        this.emitMatch(room);
      } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Match action failed.', view: matchView(room.match!, index) }; }
    }
    return { ok: true, view: matchView(room.match!, index) };
  }
  private emit(room: Room) {
    this.publish(room.players.filter(p => p.connected).map(p => p.socket), {
      code: room.code, format: room.format, host: room.host,
      players: room.players.map(({ id, nickname, ready, connected }) => ({ id, nickname, ready, connected })), matchStarted: !!room.match && room.match.winner === undefined
    });
  }
  disconnect(socket: string) {
    const session = this.sockets.get(socket);
    if (session) { session.player.connected = false; session.player.ready = false; this.sockets.delete(socket); this.emit(session.room); }
  }
  command(socket: string, input: unknown): Reply {
    const parsed = commandSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: 'Invalid command.' };
    const cmd = parsed.data;
    if (cmd.type === 'resume') {
      const session = this.sessions.get(createHash('sha256').update(cmd.token).digest('hex'));
      if (!session) return { ok: false, error: 'Session not found.' };
      if (this.sockets.has(socket) && this.sockets.get(socket) !== session) return { ok: false, error: 'Already in a room.' };
      this.sockets.delete(session.player.socket);
      session.player.socket = socket; session.player.connected = true;
      this.sockets.set(socket, session); this.emit(session.room); this.emitMatch(session.room);
      return { ok: true, playerId: session.player.id };
    }
    if (cmd.type === 'create' || cmd.type === 'join') {
      if (this.sockets.has(socket)) return { ok: false, error: 'Already in a room.' };
      let room: Room;
      if (cmd.type === 'create') {
        let code: string;
        do { code = Array.from(randomBytes(6), b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join(''); } while (this.rooms.has(code));
        room = { code, format: cmd.format, host: '', password: scryptSync(cmd.password, code, 32), players: [] };
        this.rooms.set(code, room);
      } else {
        const found = this.rooms.get(cmd.code);
        if (!found || !timingSafeEqual(found.password, scryptSync(cmd.password, cmd.code, 32))) return { ok: false, error: 'Room or password incorrect.' };
        room = found;
        if (room.match) return { ok: false, error: 'This room already has a match in progress.' };
        if (room.players.length >= originalModule.players(room.format)) return { ok: false, error: 'Room is full.' };
      }
      const player: Member = { id: randomUUID(), nickname: cmd.nickname, ready: false, connected: true, socket };
      room.players.push(player); room.host ||= player.id;
      const token = randomBytes(32).toString('hex');
      const session = { room, player }; this.sessions.set(createHash('sha256').update(token).digest('hex'), session); this.sockets.set(socket, session); this.save(); this.emit(room);
      return { ok: true, token, playerId: player.id };
    }
    const session = this.sockets.get(socket);
    if (!session) return { ok: false, error: 'Join a room first.' };
    const { room, player } = session;
    if (cmd.type === 'start') {
      if (room.host !== player.id) return { ok: false, error: 'Only the host can start a match.' };
      if (room.match && room.match.winner === undefined) return { ok: false, error: 'A match is already in progress.' };
      if (room.format !== 'duel') return { ok: false, error: 'Friend matches currently support Duel. Four-player play remains in development.' };
      if (room.players.length !== 2 || room.players.some(p => !p.connected || !p.ready || !p.deck)) return { ok: false, error: 'Both players must be connected and ready with a deck.' };
      if (room.players.some(p => p.deck?.game !== 'riftbound')) return { ok: false, error: 'Choose Riftbound decks for this match.' };
      room.match = createPractice(room.players.map(p => ({ name: p.nickname, deck: { ...p.deck!, cards: shuffle(p.deck!.cards), runes: shuffle(p.deck!.runes ?? []) } })), randomBytes(1)[0] % 2, randomUUID(), true);
      this.save(); this.emit(room); this.emitMatch(room); return { ok: true };
    }
    if (room.match && room.match.winner === undefined) return { ok: false, error: 'Decks and format are locked during a match.' };
    if (cmd.type === 'ready') {
      const errors = validateDeck(cmd.deck);
      if (errors.length) return { ok: false, error: errors.join(' ') };
      player.deck = structuredClone(cmd.deck); player.ready = cmd.ready;
    } else if (cmd.type === 'format') {
      if (room.host !== player.id) return { ok: false, error: 'Only the host can change format.' };
      if (room.players.length > originalModule.players(cmd.format)) return { ok: false, error: 'Too many players for that format.' };
      room.format = cmd.format; room.players.forEach(p => p.ready = false);
    } else return { ok: false, error: 'Match commands are not available yet.' };
    this.save(); this.emit(room); return { ok: true };
  }
}
