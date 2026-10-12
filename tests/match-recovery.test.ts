import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PracticeMatches } from '../apps/server/src/practice.ts';
import { Lobby } from '../apps/server/src/lobby.ts';
import type { LobbyView } from '../packages/shared/src/index.ts';
import type { PracticeView } from '../packages/game-engine/src/practice.ts';
import { riftboundStarters } from '../packages/riftbound-content/src/index.ts';
const file = (name: string) => path.join(mkdtempSync(path.join(os.tmpdir(), 'riftbound-match-')), name);
it('recovers practice after disconnect and server restart using an owner token, rejects stale and invalid requests', () => {
  const snapshot = file('practice.json'); let matches = new PracticeMatches(() => 0, items => [...items], snapshot);
  const start = matches.command('first', { type: 'start', deck: riftboundStarters[1].deck, opponent: riftboundStarters[2].id, interactive: true });
  expect(start.ok).toBe(true); expect(start.token).toHaveLength(64); expect(readFileSync(snapshot, 'utf8')).not.toContain(start.token);
  const pending = matches.command('first', { type: 'action', revision: start.view!.revision, action: { type: 'activate', source: 'legend' } }); expect(pending.view!.chain).toHaveLength(1);
  matches.disconnect('first'); expect(matches.command('first', { type: 'view' }).ok).toBe(false);
  matches = new PracticeMatches(() => 0, items => [...items], snapshot);
  expect(matches.command('stranger', { type: 'resume', token: 'a'.repeat(64) }).ok).toBe(false);
  const resume = matches.command('second', { type: 'resume', token: start.token }); expect(resume.view).toEqual(pending.view);
  const next = matches.command('second', { type: 'action', revision: resume.view!.revision, action: { type: 'pass' } }); expect(next.ok).toBe(true);
  expect(matches.command('second', { type: 'action', revision: resume.view!.revision, action: { type: 'end' } }).ok).toBe(false);
  expect(matches.command('third', { type: 'resume', token: start.token }).ok).toBe(true); expect(matches.command('second', { type: 'view' }).ok).toBe(false);
  matches = new PracticeMatches(() => 0, items => [...items], snapshot);
  expect(matches.command('fourth', { type: 'resume', token: start.token }).view).toEqual(next.view);
});
it('fails explicitly on corrupted snapshots instead of silently deleting match progress', () => {
  const snapshot = file('broken.json'); writeFileSync(snapshot, '{broken');
  expect(() => new PracticeMatches(undefined, undefined, snapshot)).toThrow('Invalid match snapshot');
});
it('starts a ready private duel, publishes owner-only hands, validates host/turn/revision and resumes after restart', () => {
  const snapshot = file('lobby.json'); let room: LobbyView; const views = new Map<string, PracticeView>();
  const make = () => new Lobby((_, view) => { room = view; }, (socket, view) => views.set(socket, view), snapshot);
  let lobby = make(); const host = lobby.command('host', { type: 'create', nickname: 'Host', password: 'secret', format: 'duel' });
  const guest = lobby.command('guest', { type: 'join', nickname: 'Guest', password: 'secret', code: room!.code });
  expect(lobby.command('guest', { type: 'start' }).ok).toBe(false); expect(lobby.command('host', { type: 'start' }).ok).toBe(false);
  for (const [i, socket] of ['host','guest'].entries()) expect(lobby.command(socket, { type: 'ready', ready: true, deck: riftboundStarters[i].deck }).ok).toBe(true);
  expect(lobby.command('host', { type: 'start' }).ok).toBe(true);
  const hostView = views.get('host')!, guestView = views.get('guest')!;
  expect(hostView.players[0].name).toBe('Host'); expect(guestView.players[0].name).toBe('Guest');
  expect(hostView.players[1].hand).toBeUndefined(); expect(guestView.players[1].hand).toBeUndefined();
  expect(hostView.active).toBe(1 - guestView.active);
  const actor = hostView.active === 0 ? 'host' : 'guest', idle = actor === 'host' ? 'guest' : 'host';
  expect(lobby.matchCommand(idle, { type: 'action', revision: 0, action: { type: 'end' } }).ok).toBe(false);
  const next = lobby.matchCommand(actor, { type: 'action', revision: 0, action: { type: 'end' } }); expect(next.ok).toBe(true);
  expect(lobby.matchCommand(actor, { type: 'action', revision: 0, action: { type: 'end' } }).ok).toBe(false);
  expect(lobby.command('host', { type: 'ready', ready: false, deck: riftboundStarters[0].deck }).ok).toBe(false);
  const saved = readFileSync(snapshot, 'utf8'); expect(saved).not.toContain(host.token); expect(saved).not.toContain(guest.token); expect(saved).not.toContain('secret');
  const expected = views.get('host'); lobby = make();
  expect(lobby.command('resumed', { type: 'resume', token: host.token }).ok).toBe(true); expect(views.get('resumed')).toEqual(expected);
  expect(lobby.matchCommand('outsider', { type: 'view' }).ok).toBe(false);
  expect(lobby.command('newguest', { type: 'resume', token: guest.token }).ok).toBe(true);
});

it('always uses interactive rules even when an old client requests simplified mode', () => {
  const matches = new PracticeMatches(() => 0, items => [...items]);
  const input = { type: 'start', deck: riftboundStarters[1].deck, opponent: riftboundStarters[2].id };
  const start = matches.command('default', input);
  expect(start.view!.interactive).toBe(true);
  const ability = matches.command('default', { type: 'action', revision: start.view!.revision, action: { type: 'activate', source: 'legend' } });
  expect(ability.view!.chain).toHaveLength(1);
  const simplified = matches.command('simple', { ...input, interactive: false });
  expect(simplified.view!.interactive).toBe(true);
});

it('upgrades older saved practice matches to interactive rules on restart', () => {
  const snapshot = file('legacy.json');
  const matches = new PracticeMatches(() => 0, items => [...items], snapshot);
  const start = matches.command('first', { type: 'start', deck: riftboundStarters[1].deck, opponent: riftboundStarters[2].id });
  const saved = JSON.parse(readFileSync(snapshot, 'utf8'));
  saved.matches[0].state.interactive = false;
  writeFileSync(snapshot, JSON.stringify(saved));
  const restarted = new PracticeMatches(() => 0, items => [...items], snapshot);
  const restored = restarted.command('restored', { type: 'resume', token: start.token });
  expect(restored.view!.interactive).toBe(true);
  expect(restored.view!.revision).toBe(start.view!.revision + 1);
  expect(restarted.command('restored', { type: 'action', revision: start.view!.revision, action: { type: 'end' } }).ok).toBe(false);
});
