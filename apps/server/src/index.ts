import path from 'node:path';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { Lobby } from './lobby.ts';
import { Accounts } from './accounts.ts';
import { Diagnostics, safeCommand } from './logging.ts';
import { PracticeMatches } from './practice.ts';
const diagnostics = new Diagnostics(process.env.LOG_FILE ?? '.runtime/logs/server.jsonl');
const snapshotRoot = process.env.MATCHES_DIR ?? (process.env.ACCOUNTS_FILE ? `${process.env.ACCOUNTS_FILE}.matches` : '.runtime/matches');
const practice = new PracticeMatches(process.env.NODE_ENV === 'test' && process.env.TEST_FIRST_PLAYER !== undefined ? () => Number(process.env.TEST_FIRST_PLAYER) : undefined, process.env.NODE_ENV === 'test' && process.env.TEST_DECK_ORDER === 'fixed' ? items => [...items] : undefined, path.join(snapshotRoot, 'practice.json'));
const accounts = await Accounts.open(process.env.ACCOUNTS_FILE ?? '.runtime/accounts.sqlite');
const http = createServer((req, res) => { res.writeHead(req.url === '/health' ? 200 : 404); res.end(req.url === '/health' ? 'ok' : 'Not found'); });
const io = new Server(http, { cors: { origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' }, maxHttpBufferSize: 16384 });
const lobby = new Lobby((sockets, view) => sockets.forEach(id => io.to(id).emit('lobby', view)), (id, view) => io.to(id).emit('match', view), path.join(snapshotRoot, 'lobbies.json'));
io.on('connection', socket => {
  function handle(feature: string, input: unknown, reply: (result: unknown) => void, run: () => { ok: boolean; error?: string } | Promise<{ ok: boolean; error?: string }>) {
    const requestId = diagnostics.requestId(), started = Date.now(), command = safeCommand(input);
    void Promise.resolve().then(run).then(result => {
      diagnostics.record({ level: result.ok ? 'info' : 'warn', event: result.ok ? 'request_ok' : 'request_rejected', requestId, feature, command, durationMs: Date.now() - started });
      reply({ ...result, requestId });
    }).catch(error => { diagnostics.exception(error, { requestId, feature, command }); reply({ ok: false, error: 'Server operation failed. Use this request ID to find the error in the logs.', requestId }); });
  }
  let windowStart = Date.now(), count = 0;
  socket.on('command', (input, reply) => {
    if (typeof reply !== 'function') return;
    if (Date.now() - windowStart > 1000) { windowStart = Date.now(); count = 0; }
    if (++count > 10) return handle('lobby', input, reply, () => ({ ok: false, error: 'Too many commands.' }));
    handle('lobby', input, reply, () => lobby.command(socket.id, input));
  });
  socket.on('disconnect', () => { lobby.disconnect(socket.id); practice.disconnect(socket.id); });
  socket.on('practice', (input, reply) => {
    if (typeof reply !== 'function') return;
    if (Date.now() - windowStart > 1000) { windowStart = Date.now(); count = 0; }
    if (++count > 10) return handle('practice', input, reply, () => ({ ok: false, error: 'Too many commands.' }));
    handle('practice', input, reply, () => practice.command(socket.id, input));
  });
  socket.on('match', (input, reply) => {
    if (typeof reply !== 'function') return;
    if (Date.now() - windowStart > 1000) { windowStart = Date.now(); count = 0; }
    if (++count > 10) return handle('match', input, reply, () => ({ ok: false, error: 'Too many commands.' }));
    handle('match', input, reply, () => lobby.matchCommand(socket.id, input));
  });
  let accountWindow = Date.now(), accountCount = 0;
  socket.on('account', (input, reply) => {
    if (typeof reply !== 'function') return;
    if (Date.now() - accountWindow > 60000) { accountWindow = Date.now(); accountCount = 0; }
    if (++accountCount > 20) return handle('account', input, reply, () => ({ ok: false, error: 'Too many account requests. Wait one minute.' }));
    handle('account', input, reply, () => accounts.command(input));
  });
});
http.on('error', error => { diagnostics.exception(error, { feature: 'server' }); void diagnostics.flush().then(() => process.exit(1)); });
process.on('uncaughtException', error => { diagnostics.exception(error, { feature: 'process' }); void diagnostics.flush().then(() => process.exit(1)); });
process.on('unhandledRejection', error => { diagnostics.exception(error, { feature: 'process' }); void diagnostics.flush().then(() => process.exit(1)); });
http.listen(Number(process.env.PORT ?? 3001), process.env.HOST ?? '127.0.0.1', () => { console.log('Riftbound server listening'); diagnostics.record({ level: 'info', event: 'server_started' }); });
