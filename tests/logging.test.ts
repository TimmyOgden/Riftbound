import { expect, it } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { Diagnostics, safeCommand } from '../apps/server/src/logging.ts';
it('writes structured failures with request IDs and omits request secrets and error messages', async () => {
  const file = path.join(await mkdtemp(path.join(os.tmpdir(), 'riftbound-log-')), 'server.jsonl');
  const lines: string[] = [], logger = new Diagnostics(file, line => lines.push(line));
  const input = { type: 'login', password: 'private-password', token: 'bearer-secret', username: 'private-account' };
  const requestId = logger.requestId();
  logger.record({ level: 'warn', event: 'request_rejected', feature: 'account', command: safeCommand(input), requestId });
  logger.exception(Error('private-password bearer-secret'), { feature: 'account', command: 'login', requestId });
  await logger.flush(); const log = await readFile(file, 'utf8');
  expect(log).toContain(requestId); expect(log).toContain('request_exception');
  expect(log).not.toContain('private-password'); expect(log).not.toContain('bearer-secret'); expect(log).not.toContain('private-account');
  expect(lines).toHaveLength(2); expect(lines.map(line => JSON.parse(line).level)).toEqual(['warn', 'error']);
  expect(safeCommand({ type: 'bearer-secret' })).toBe('invalid');
});
