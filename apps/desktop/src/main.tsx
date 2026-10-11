import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io, type Socket } from 'socket.io-client';
import type { LobbyView, Reply, Format } from '../../../packages/shared/src/index.ts';
import './style.css';
import './riftbound.css';
import { Decks } from './RiftboundDecks.tsx';
import type { Deck } from '../../../packages/shared/src/index.ts';
import { Practice } from './Practice.tsx';
function App() {
  const [server, setServer] = useState(import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001');
  const [socket, setSocket] = useState<Socket>();
  const [status, setStatus] = useState('Enter the server address to connect.');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [format, setFormat] = useState<Format>('duel');
  const [lobby, setLobby] = useState<LobbyView>();
  const [playerId, setPlayerId] = useState('');
  const [selectedDeck, setSelectedDeck] = useState<Deck>();
  useEffect(() => () => { socket?.disconnect(); }, [socket]);
  function connect() {
    try { const url = new URL(server); if (!['http:', 'https:'].includes(url.protocol)) throw Error(); } catch { setStatus('Enter an http or https server address.'); return; }
    socket?.disconnect(); setLobby(undefined); setSelectedDeck(undefined);
    const next = io(server); setSocket(next);
    next.on('lobby', setLobby);
    next.on('connect_error', () => setStatus('Cannot connect. Check the address and that the server is running.'));
    next.on('disconnect', () => setStatus('Disconnected. Attempting to reconnect…'));
    next.on('connect', () => {
      setStatus('Connected. Create or join a private room.');
      const token = sessionStorage.getItem(`session:${server}`);
      if (token) next.emit('command', { type: 'resume', token }, (reply: Reply) => { if (reply.ok) setPlayerId(reply.playerId!); else sessionStorage.removeItem(`session:${server}`); });
    });
  }
  function command(input: unknown) {
    socket?.timeout(5000).emit('command', input, (error: Error | null, reply: Reply) => {
      if (error) { setStatus('Server did not respond.'); return; }
      setStatus(reply.ok ? 'Lobby updated.' : `${reply.error ?? 'Command failed.'}${reply.requestId ? ` Reference: ${reply.requestId}` : ''}`);
      if (reply.token) sessionStorage.setItem(`session:${server}`, reply.token);
      if (reply.playerId) setPlayerId(reply.playerId);
    });
  }
  return <main><p className="eyebrow">LEAGUE OF LEGENDS TCG</p><h1>Riftbound Companion</h1><p>Build decks, practise against AI, and connect with friends. Unofficial fan project.</p>
    <section><h2>Connect with friends</h2><label>Server address<input value={server} onChange={e => setServer(e.target.value)} /></label><button onClick={connect}>Connect</button><p role="status">{status}</p></section>
    {!lobby ? <section><h2>Private lobby</h2><label>Nickname<input maxLength={24} value={nickname} onChange={e => setNickname(e.target.value)} /></label><label>Room password<input type="password" maxLength={64} value={password} onChange={e => setPassword(e.target.value)} /></label><label>Format<select value={format} onChange={e => setFormat(e.target.value as Format)}><option value="duel">Duel · 2 players</option><option value="teams">Teams · 4 players</option><option value="free-for-all">Free for all · 4 players</option></select></label><button disabled={!socket?.connected || !nickname.trim()} onClick={() => command({ type: 'create', nickname, password, format })}>Create room</button><label>Room code<input maxLength={6} value={code} onChange={e => setCode(e.target.value.toUpperCase())} /></label><button disabled={!socket?.connected || !nickname.trim() || code.length !== 6} onClick={() => command({ type: 'join', nickname, password, code })}>Join room</button></section> : <section><h2>Room {lobby.code}</h2><p>Share the server address, room code, and password with your friend.</p><p>Format: {lobby.format}</p><ul>{lobby.players.map(p => <li key={p.id}>{p.nickname}{p.id === lobby.host ? ' · host' : ''} · {p.connected ? p.ready ? 'ready' : 'choosing deck' : 'offline'}</li>)}</ul><button disabled={!selectedDeck} onClick={() => command({ type: 'ready', ready: !lobby.players.find(p => p.id === playerId)?.ready, deck: selectedDeck })}>Toggle ready{selectedDeck ? ` with ${selectedDeck.name}` : ' · select a deck below'}</button><p>Match launch is under development.</p></section>}
    <Practice key={socket?.id ?? server} socket={socket} selectedDeck={selectedDeck} />
    {socket && <Decks key={socket.id ?? server} socket={socket} onSelect={setSelectedDeck} />}
  </main>;
}
createRoot(document.getElementById('root')!).render(<App />);
