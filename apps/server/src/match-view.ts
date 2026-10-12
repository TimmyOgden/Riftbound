import { practiceProject, type PracticeState } from '../../../packages/game-engine/src/practice.ts';
// The table always places its viewer below the opponent. Commands still use stable
// instance IDs and the server binds the acting player to their lobby session.
export function matchView(state: PracticeState, viewer: number) {
  if (!viewer) return practiceProject(state, 0);
  const s = structuredClone(state), flip = (n: number) => 1 - n;
  s.players.reverse(); s.active = flip(s.active); s.firstPlayer = flip(s.firstPlayer);
  if (s.winner !== undefined) s.winner = flip(s.winner);
  if (s.priority !== undefined) s.priority = flip(s.priority);
  s.units.forEach(u => u.owner = flip(u.owner));
  s.fields.forEach(f => { if (f.controller !== undefined) f.controller = flip(f.controller); });
  s.events.forEach(e => e.player = flip(e.player));
  s.chain?.forEach(item => item.player = flip(item.player));
  if (s.task) s.task.player = flip(s.task.player);
  if (s.showdown) { s.showdown.attacker = flip(s.showdown.attacker); s.showdown.focus = flip(s.showdown.focus); s.showdown.assignments.reverse(); }
  return practiceProject(s, 0);
}
