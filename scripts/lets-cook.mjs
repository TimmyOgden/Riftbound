import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const check = process.argv.includes('--check');
const children = [];
let stopping = false;
async function freePort(start) {
  for (let port = start; port < start + 20; port++) {
    const server = createServer();
    const available = await new Promise(resolve => { server.once('error', () => resolve(false)); server.listen(port, '127.0.0.1', () => server.close(() => resolve(true))); });
    if (available) return port;
  }
  throw Error(`No free local port near ${start}.`);
}
function shutdown(code = 0) {
  if (stopping) return; stopping = true;
  for (const child of children) if (child.exitCode === null && child.pid) child.kill();
  process.exitCode = code;
}
function start(label, args, env) {
  const child = spawn(process.execPath, args, { cwd: root, env: { ...process.env, ...env }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child);
  child.stdout.on('data', data => process.stdout.write(`[${label}] ${data}`));
  child.stderr.on('data', data => process.stderr.write(`[${label}] ${data}`));
  child.on('error', error => { console.error(`${label} failed to start: ${error.message}`); shutdown(1); });
  child.on('exit', code => { if (!stopping) { console.error(`${label} stopped (exit ${code}).`); shutdown(code || 1); } });
}
async function waitFor(url) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline && !stopping) {
    try { const response = await fetch(url, { signal: AbortSignal.timeout(1000) }); if (response.ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw Error(`Startup failed at ${url}. See server/client errors above.`);
}
async function openChrome(url) {
  if (process.platform !== 'win32') { console.log(`Open Chrome at ${url}`); return; }
  const candidates = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean).map(base => path.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'));
  for (const executable of candidates) {
    try { await access(executable); } catch { continue; }
    const browser = spawn(executable, ['--new-tab', url], { detached: true, windowsHide: false, stdio: 'ignore' });
    browser.on('error', error => console.error(`Could not open Chrome: ${error.message}. Open ${url} manually.`)); browser.unref(); return;
  }
  console.log(`Chrome was not found automatically. Open Chrome at ${url}`);
}
process.on('SIGINT', () => shutdown()); process.on('SIGTERM', () => shutdown());
try {
  await access(path.join(root, 'node_modules/tsx'));
  const serverPort = await freePort(3001), clientPort = await freePort(5174);
  const clientUrl = `http://localhost:${clientPort}`, serverUrl = `http://localhost:${serverPort}`;
  console.log("Let's cook! Starting Riftbound…");
  start('server', ['--import', 'tsx', 'apps/server/src/index.ts'], { HOST: '127.0.0.1', PORT: String(serverPort), CLIENT_ORIGIN: clientUrl });
  start('client', ['node_modules/vite/bin/vite.js', '--config', 'apps/desktop/vite.config.ts', '--host', '127.0.0.1', '--port', String(clientPort), '--strictPort'], { VITE_SERVER_URL: serverUrl });
  await Promise.all([waitFor(`http://127.0.0.1:${serverPort}/health`), waitFor(`http://127.0.0.1:${clientPort}`)]);
  console.log(`\nReady: ${clientUrl}\nServer: ${serverUrl}\nPress Ctrl+C here to stop both services.\n`);
  if (check) { console.log('Startup check passed.'); shutdown(); } else await openChrome(clientUrl);
} catch (error) { console.error(error.message); shutdown(1); }
