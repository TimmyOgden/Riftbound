import { expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { io, type Socket } from 'socket.io-client';
import type { LobbyView, Reply } from '../packages/shared/src/index.ts';
import type { AccountReply } from '../apps/server/src/accounts.ts';
import { starterDeck } from '../packages/game-content/src/index.ts';
import { riftboundStarters } from '../packages/riftbound-content/src/index.ts';
it('connects two independent clients, joins a private room, and saves an account deck over the network', async () => {
  const probe = createServer();
  await new Promise<void>(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = (probe.address() as { port: number }).port;
  await new Promise<void>(resolve => probe.close(() => resolve()));
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ember-network-'));
  const process = spawn(globalThis.process.execPath, ['node_modules/tsx/dist/cli.mjs', 'apps/server/src/index.ts'], { env: { ...globalThis.process.env, PORT: String(port), HOST: '127.0.0.1', ACCOUNTS_FILE: path.join(dir, 'accounts.sqlite'), LOG_FILE: path.join(dir, 'server.jsonl') }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  const clients: Socket[] = [];
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Server startup timed out')), 10000);
      process.stdout.on('data', data => { if (String(data).includes('listening')) { clearTimeout(timer); resolve(); } });
      process.once('exit', code => { clearTimeout(timer); reject(Error(`Server exited ${code}`)); });
      process.stderr.on('data', data => { clearTimeout(timer); reject(Error(String(data))); });
    });
    for (let i = 0; i < 2; i++) {
      const client = io(`http://127.0.0.1:${port}`, { transports: ['websocket'], reconnection: false }); clients.push(client);
      await new Promise<void>((resolve, reject) => { client.once('connect', resolve); client.once('connect_error', reject); });
    }
    const view = new Promise<LobbyView>(resolve => clients[0].once('lobby', resolve));
    const host = await clients[0].timeout(3000).emitWithAck('command', { type: 'create', nickname: 'Host', password: 'room-secret', format: 'duel' }) as Reply;
    expect(host.ok).toBe(true);
    const code = (await view).code;
    const joined = new Promise<LobbyView>(resolve => clients[0].once('lobby', resolve));
    expect((await clients[1].timeout(3000).emitWithAck('command', { type: 'join', nickname: 'Friend', password: 'room-secret', code })).ok).toBe(true);
    expect((await joined).players).toHaveLength(2);
    const account = await clients[1].timeout(3000).emitWithAck('account', { type: 'register', username: 'Friend', password: 'friend-password-123', email: 'friend@example.com' }) as AccountReply;
    expect(account.ok).toBe(true);
    expect(account.decks).toHaveLength(7);
    const saved = await clients[1].timeout(3000).emitWithAck('account', { type: 'save', token: account.token, deck: starterDeck }) as AccountReply;
    expect(saved.decks!.at(-1)!.deck).toEqual(starterDeck);
    const practice = await clients[0].timeout(3000).emitWithAck('practice', { type: 'start', deck: riftboundStarters[0].deck, opponent: riftboundStarters[2].id });
    expect(practice.ok).toBe(true); expect(practice.view.players[1].hand).toBeUndefined();
    const rejected = await clients[0].timeout(3000).emitWithAck('practice', { type: 'action', revision: 99, action: { type: 'end' } });
    expect(rejected.ok).toBe(false); expect(rejected.requestId).toBeDefined();
    const turn = await clients[0].timeout(3000).emitWithAck('practice', { type: 'action', revision: practice.view.revision, action: { type: 'end' } });
    expect(turn.ok).toBe(true); expect(turn.view.legal.some((a: { type: string }) => a.type === 'pass' || a.type === 'end')).toBe(true); expect(turn.view.revision).toBeGreaterThan(1);
  } finally { clients.forEach(client => client.disconnect()); process.kill(); }
}, 20000);
