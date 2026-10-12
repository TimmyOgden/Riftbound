import React, { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { Deck, Format, LobbyView, Reply } from '../../../packages/shared/src/index.ts';
import type { PracticeView } from '../../../packages/game-engine/src/practice.ts';
import { GameTable } from './GameTable.tsx';
import { Decks } from './RiftboundDecks.tsx';
import { CardArt } from './CardArt.tsx';
import { RiftSigil } from './RuneIcon.tsx';
import { riftboundStarters } from '../../../packages/riftbound-content/src/index.ts';
export function App() {
  const [page, setPage] = useState<'play' | 'decks' | 'friends' | 'settings' | 'account' | 'collection'>('play');
  const [server, setServer] = useState(import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001');
  const [socket, setSocket] = useState<Socket>(), [connected, setConnected] = useState(false);
  const [status, setStatus] = useState('Connecting to your server…');
  const [nickname, setNickname] = useState(''), [password, setPassword] = useState(''), [code, setCode] = useState('');
  const [format, setFormat] = useState<Format>('duel'), [lobby, setLobby] = useState<LobbyView>();
  const [friendMatch, setFriendMatch] = useState<PracticeView>(), [friendStarter, setFriendStarter] = useState(riftboundStarters[0].id);
  const [playerId, setPlayerId] = useState(''), [selectedDeck, setSelectedDeck] = useState<Deck>();
  function connect() {
    try { const url = new URL(server); if (!['http:', 'https:'].includes(url.protocol)) throw Error(); } catch { setStatus('Enter an http or https server address.'); return; }
    socket?.disconnect(); setConnected(false); setLobby(undefined); setFriendMatch(undefined); setSelectedDeck(undefined); setStatus('Connecting…');
    const next = io(server); setSocket(next);
    next.on('lobby', setLobby);
    next.on('match', setFriendMatch);
    next.on('connect_error', () => { setConnected(false); setStatus('Could not connect. Check the server address and that lets cook is running.'); });
    next.on('disconnect', () => { setConnected(false); setStatus('Connection lost. Reconnecting…'); });
    next.on('connect', () => {
      setConnected(true); setStatus('Your server is online.');
      const token = sessionStorage.getItem(`session:${server}`);
      if (token) next.emit('command', { type: 'resume', token }, (reply: Reply) => { if (reply.ok) setPlayerId(reply.playerId!); else sessionStorage.removeItem(`session:${server}`); });
    });
  }
  useEffect(() => { connect(); }, []);
  useEffect(() => () => { socket?.disconnect(); }, [socket]);
  function command(input: unknown) {
    socket?.timeout(5000).emit('command', input, (error: Error | null, reply: Reply) => {
      if (error) { setStatus('Server did not respond.'); return; }
      setStatus(reply.ok ? 'Lobby updated.' : `${reply.error ?? 'Command failed.'}${reply.requestId ? ` Reference: ${reply.requestId}` : ''}`);
      if (reply.token) sessionStorage.setItem(`session:${server}`, reply.token);
      if (reply.playerId) setPlayerId(reply.playerId);
    });
  }
  return <div className="app-shell"><header className="app-header"><button className="brand" onClick={() => setPage('play')} aria-label="Riftbound home"><span className="brand-mark"><RiftSigil /></span><span>RIFTBOUND<small>THE PRACTICE TABLE</small></span></button><nav aria-label="Main navigation">{(['play','decks','collection','account','friends'] as const).map(tab => <button key={tab} className={page === tab ? 'active' : ''} onClick={() => setPage(tab)}>{tab === 'play' ? 'Play' : tab === 'decks' ? 'My decks' : tab === 'collection' ? 'My cards' : tab === 'account' ? 'Account' : 'With friends'}</button>)}</nav><button className="connection-indicator" onClick={() => setPage('settings')}><i className={connected ? 'online' : ''} />{connected ? 'Online' : 'Connecting'}<span>⚙</span></button></header>
    <main className="app-main"><div className="app-page" hidden={page !== 'play'}><GameTable serverKey={server} visible={page === 'play'} key={socket ? server : 'connecting'} socket={socket} connected={connected} selectedDeck={selectedDeck} onConnect={connect} /></div>
      <div className="app-page deck-page" hidden={!['decks','account','collection'].includes(page)}><div className="page-heading"><span className="overline">YOUR RIFTBOUND</span><h1>{page === 'account' ? 'Your account.' : page === 'collection' ? 'Your card collection.' : 'Your decks. Your next game.'}</h1><p>{page === 'account' ? 'Manage your profile and email address.' : page === 'collection' ? 'Keep track of the cards you own.' : 'Your saved decks, starter builds and next ideas, all in one place.'}</p></div><div className="deck-studio">{socket ? <Decks onNavigate={setPage} key={server} serverKey={server} page={page === 'account' || page === 'collection' ? page : 'decks'} socket={socket} onSelect={deck => { setSelectedDeck(deck); }} /> : <section><p>Connecting to your server…</p><button onClick={connect}>Reconnect</button></section>}</div></div>
      <div className="app-page friends-page" hidden={page !== 'friends'}><div className="page-heading"><span className="overline">BRING YOUR RIVAL</span><h1>A table for friends.</h1><p>Create a private room, or join your friend's table.</p></div><div hidden={!!friendMatch} className="friends-layout"><div className="friends-illustration"><CardArt cardId={riftboundStarters[0].deck.champion} /><CardArt cardId={riftboundStarters[2].deck.champion} /><span>YOUR NEXT RIVAL<br />IS ONE INVITE AWAY.</span></div><section className="lobby-panel">{!lobby ? <><h2>Private room</h2><label>Your nickname<input maxLength={24} value={nickname} onChange={e => setNickname(e.target.value)} /></label><label>Room password<input type="password" maxLength={64} value={password} onChange={e => setPassword(e.target.value)} /></label><label>Format<select value={format} onChange={e => setFormat(e.target.value as Format)}><option value="duel">Duel · 2 players</option><option value="teams">Teams · 4 players</option><option value="free-for-all">Free for all · 4 players</option></select></label><button className="primary-button" disabled={!connected || !nickname.trim()} onClick={() => command({ type: 'create', nickname, password, format })}>Create room ↗</button><div className="form-divider">OR JOIN A ROOM</div><label>Room code<input maxLength={6} value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="ABC234" /></label><button disabled={!connected || !nickname.trim() || code.length !== 6} onClick={() => command({ type: 'join', nickname, password, code })}>Join room</button></> : <><span className="overline">YOUR PRIVATE ROOM</span><h2 className="room-code">{lobby.code}</h2><p>Share the server address, this code, and the password with your friend.</p><ul>{lobby.players.map(p => <li key={p.id}>{p.nickname}{p.id === lobby.host ? ' · host' : ''} · {p.connected ? p.ready ? 'ready' : 'choosing deck' : 'offline'}</li>)}</ul><label>Friend match deck<select value={friendStarter} onChange={e => setFriendStarter(e.target.value)}>{riftboundStarters.map(s => <option value={s.id} key={s.id}>{s.deck.name}</option>)}{selectedDeck && <option value="custom">{selectedDeck.name} · saved deck</option>}</select></label><button disabled={!connected || lobby.matchStarted} onClick={() => command({ type: 'ready', ready: !lobby.players.find(p => p.id === playerId)?.ready, deck: friendStarter === 'custom' ? selectedDeck : riftboundStarters.find(s => s.id === friendStarter)!.deck })}>Toggle ready</button>{lobby.host === playerId && <button className="primary-button" disabled={!connected || lobby.players.length !== 2 || lobby.players.some(p => !p.ready || !p.connected) || lobby.format !== 'duel' || lobby.matchStarted} onClick={() => command({ type: 'start' })}>Start friend match</button>}<p>Duel matches use interactive beta rules. Four-player match play is still in development.</p></>}<p role="status">{status}</p></section></div>{friendMatch && <><p className="friend-presence">Room {lobby?.code} · {lobby?.players.filter(p => p.id !== playerId).map(p => `${p.nickname}: ${p.connected ? 'connected' : 'offline — match saved, waiting for reconnect'}`).join(', ')}</p>{friendMatch.winner !== undefined && <button onClick={() => setFriendMatch(undefined)}>Back to room</button>}<GameTable serverKey={server} mode="friends" remoteView={friendMatch} socket={socket} connected={connected} onConnect={connect} visible={page === 'friends'} /></>}</div>
      <div className="app-page settings-page" hidden={page !== 'settings'}><div className="page-heading"><span className="overline">CONNECTION</span><h1>Your table, your server.</h1></div><section><label>Server address<input value={server} onChange={e => setServer(e.target.value)} /></label><button className="primary-button" onClick={connect}>Connect</button><p role="status">{status}</p><p>For a friend-hosted table, enter their private server address. Local play connects automatically when you use lets cook.</p></section></div>
    </main><footer className="app-footer"><span>Unofficial fan project · AI practice beta</span><span>Original card art from Riot's gallery</span></footer></div>;
}
