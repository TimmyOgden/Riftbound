import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { commandSchema, type LobbyView, type Reply, type Deck, type Format } from '../../../packages/shared/src/index.ts';
import { originalModule } from '../../../packages/game-rules/src/index.ts';
import { validateDeck } from '../../../packages/game-rules/src/decks.ts';

interface Member { id: string; nickname: string; ready: boolean; connected: boolean; deck?: Deck; socket: string }
interface Room { code: string; format: Format; host: string; password: Buffer; players: Member[] }
export class Lobby {
  private rooms = new Map<string, Room>();
  private sessions = new Map<string, { room: Room; player: Member }>();
  private sockets = new Map<string, { room: Room; player: Member }>();
  constructor(private publish: (sockets: string[], view: LobbyView) => void) {}
  private emit(room: Room) {
    this.publish(room.players.filter(p => p.connected).map(p => p.socket), {
      code: room.code, format: room.format, host: room.host,
      players: room.players.map(({ id, nickname, ready, connected }) => ({ id, nickname, ready, connected }))
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
      const session = this.sessions.get(cmd.token);
      if (!session) return { ok: false, error: 'Session not found.' };
      if (this.sockets.has(socket) && this.sockets.get(socket) !== session) return { ok: false, error: 'Already in a room.' };
      this.sockets.delete(session.player.socket);
      session.player.socket = socket; session.player.connected = true;
      this.sockets.set(socket, session); this.emit(session.room);
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
        if (room.players.length >= originalModule.players(room.format)) return { ok: false, error: 'Room is full.' };
      }
      const player: Member = { id: randomUUID(), nickname: cmd.nickname, ready: false, connected: true, socket };
      room.players.push(player); room.host ||= player.id;
      const token = randomBytes(32).toString('hex');
      const session = { room, player }; this.sessions.set(token, session); this.sockets.set(socket, session); this.emit(room);
      return { ok: true, token, playerId: player.id };
    }
    const session = this.sockets.get(socket);
    if (!session) return { ok: false, error: 'Join a room first.' };
    const { room, player } = session;
    if (cmd.type === 'ready') {
      const errors = validateDeck(cmd.deck);
      if (errors.length) return { ok: false, error: errors.join(' ') };
      player.deck = structuredClone(cmd.deck); player.ready = cmd.ready;
    } else if (cmd.type === 'format') {
      if (room.host !== player.id) return { ok: false, error: 'Only the host can change format.' };
      if (room.players.length > originalModule.players(cmd.format)) return { ok: false, error: 'Too many players for that format.' };
      room.format = cmd.format; room.players.forEach(p => p.ready = false);
    } else return { ok: false, error: 'Match commands are not available yet.' };
    this.emit(room); return { ok: true };
  }
}
