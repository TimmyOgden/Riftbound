import initSqlJs, { type Database } from 'sql.js';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { deckSchema, type Deck } from '../../../packages/shared/src/index.ts';
import { validateDeck } from '../../../packages/game-rules/src/decks.ts';
import { riftboundStarters } from '../../../packages/riftbound-content/src/index.ts';
const credentials = z.object({ username: z.string().trim().regex(/^[a-zA-Z0-9_]{3,24}$/), password: z.string().min(10).max(128) });
const schema = z.discriminatedUnion('type', [
  credentials.extend({ type: z.literal('register') }), credentials.extend({ type: z.literal('login') }),
  z.object({ type: z.literal('list'), token: z.string().length(64) }),
  z.object({ type: z.literal('save'), token: z.string().length(64), id: z.string().uuid().optional(), deck: deckSchema }),
  z.object({ type: z.literal('delete'), token: z.string().length(64), id: z.string().uuid() }),
  z.object({ type: z.literal('logout'), token: z.string().length(64) })
]);
export interface SavedDeck { id: string; deck: Deck }
export interface AccountReply { ok: boolean; error?: string; token?: string; username?: string; decks?: SavedDeck[]; requestId?: string }
export class Accounts {
  private sessions = new Map<string, { id: string; username: string; expires: number }>();
  private queue: Promise<unknown> = Promise.resolve();
  private constructor(private db: Database, private filename: string) {}
  static async open(filename: string) {
    const SQL = await initSqlJs();
    let data: Buffer | undefined;
    try { data = await readFile(filename); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    const db = data ? new SQL.Database(data) : new SQL.Database();
    db.run('CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL); CREATE TABLE IF NOT EXISTS decks (id TEXT PRIMARY KEY, owner TEXT NOT NULL, data TEXT NOT NULL)');
    db.run('CREATE TABLE IF NOT EXISTS starter_grants (owner TEXT NOT NULL, starter TEXT NOT NULL, PRIMARY KEY (owner, starter))');
    return new Accounts(db, filename);
  }
  command(input: unknown): Promise<AccountReply> {
    const work = this.queue.then(() => this.execute(input)); this.queue = work.catch(() => {}); return work;
  }
  private rows(sql: string, values: string[]) {
    const statement = this.db.prepare(sql);
    try { statement.bind(values); const rows: Record<string, unknown>[] = []; while (statement.step()) rows.push(statement.getAsObject()); return rows; } finally { statement.free(); }
  }
  private async persist() {
    await mkdir(path.dirname(this.filename), { recursive: true });
    await writeFile(`${this.filename}.tmp`, this.db.export(), { mode: 0o600 });
    await rename(`${this.filename}.tmp`, this.filename);
  }
  private decks(owner: string): SavedDeck[] { return this.rows('SELECT id, data FROM decks WHERE owner = ? ORDER BY rowid', [owner]).map(row => ({ id: String(row.id), deck: JSON.parse(String(row.data)) as Deck })); }
  private async grantStarters(owner: string) {
    const missing = riftboundStarters.filter(starter => !this.rows('SELECT starter FROM starter_grants WHERE owner = ? AND starter = ?', [owner, starter.id]).length);
    if (!missing.length) return;
    const previous = this.db.export();
    try {
      for (const starter of missing) {
        this.db.run('INSERT INTO decks VALUES (?, ?, ?)', [randomUUID(), owner, JSON.stringify(starter.deck)]);
        this.db.run('INSERT INTO starter_grants VALUES (?, ?)', [owner, starter.id]);
      }
      await this.persist();
    } catch (error) { this.db.close(); const SQL = await initSqlJs(); this.db = new SQL.Database(previous); throw error; }
  }
  private async execute(input: unknown): Promise<AccountReply> {
    const parsed = schema.safeParse(input);
    if (!parsed.success) return { ok: false, error: 'Invalid request. Usernames need 3–24 letters, numbers or underscores; passwords need 10–128 characters.' };
    const cmd = parsed.data;
    if (cmd.type === 'register' || cmd.type === 'login') {
      const username = cmd.username.toLowerCase();
      let row = this.rows('SELECT * FROM accounts WHERE username = ?', [username])[0];
      if (cmd.type === 'register') {
        if (row) return { ok: false, error: 'Username is unavailable.' };
        const salt = randomBytes(16).toString('hex'), hash = scryptSync(cmd.password, salt, 64).toString('hex'), id = randomUUID();
        this.db.run('INSERT INTO accounts VALUES (?, ?, ?, ?)', [id, username, salt, hash]);
        try { await this.persist(); } catch (error) { this.db.run('DELETE FROM accounts WHERE id = ?', [id]); throw error; }
        row = { id, username, salt, hash };
      } else {
        const candidate = scryptSync(cmd.password, row ? String(row.salt) : 'invalid-account-salt', 64);
        if (!row || !timingSafeEqual(candidate, Buffer.from(String(row.hash), 'hex'))) return { ok: false, error: 'Username or password incorrect.' };
      }
      const token = randomBytes(32).toString('hex');
      await this.grantStarters(String(row.id));
      this.sessions.set(token, { id: String(row.id), username, expires: Date.now() + 86400000 });
      return { ok: true, token, username, decks: this.decks(String(row.id)) };
    }
    const session = this.sessions.get(cmd.token);
    if (!session || session.expires < Date.now()) { this.sessions.delete(cmd.token); return { ok: false, error: 'Sign in again.' }; }
    if (cmd.type === 'logout') { this.sessions.delete(cmd.token); return { ok: true }; }
    if (cmd.type === 'save' || cmd.type === 'delete') {
      const previous = this.db.export();
      if (cmd.type === 'save') {
        const errors = validateDeck(cmd.deck);
        if (errors.length) return { ok: false, error: errors.join(' ') };
        if (cmd.id && !this.rows('SELECT id FROM decks WHERE id = ? AND owner = ?', [cmd.id, session.id]).length) return { ok: false, error: 'Deck not found.' };
        if (!cmd.id && this.decks(session.id).length >= 50) return { ok: false, error: 'Maximum 50 saved decks.' };
        if (cmd.id) this.db.run('UPDATE decks SET data = ? WHERE id = ? AND owner = ?', [JSON.stringify(cmd.deck), cmd.id, session.id]);
        else this.db.run('INSERT INTO decks VALUES (?, ?, ?)', [randomUUID(), session.id, JSON.stringify(cmd.deck)]);
      } else this.db.run('DELETE FROM decks WHERE id = ? AND owner = ?', [cmd.id, session.id]);
      try { await this.persist(); } catch (error) { this.db.close(); const SQL = await initSqlJs(); this.db = new SQL.Database(previous); throw error; }
    }
    return { ok: true, username: session.username, decks: this.decks(session.id) };
  }
}
