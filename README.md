# Riftbound Practice Table

An unofficial Riftbound app with a visual AI practice table, seven official Origins/Proving Grounds starter decks, accounts and saved deck building. Private friend lobbies work; multiplayer match play remains in development. Practice uses a beta rules subset; open **Beta rules** on the table for its limits.

Start everything by typing `lets cook` in a new PowerShell terminal. It starts the server and client, selects free local ports, matches the browser origin, fills in the correct server address, and opens Chrome. Keep that terminal open; Ctrl+C stops both services. The command works from any directory after running `scripts/install-lets.ps1` once. You can also run `node scripts/lets-cook.mjs` from the project directory. `npm run build` builds the renderer and Electron entry points.

## Joining from another computer

Use a private Tailscale network on both computers. On the host, set `HOST` to the host's Tailscale IP and `CLIENT_ORIGIN` to the exact browser origin your friend will use, then run the server. Your friend runs the desktop client locally and enters `http://HOST_TAILSCALE_IP:3001`, followed by the room code and password. Allow inbound TCP port 3001 on the private interface in Windows Firewall. Localhost only works on the same computer. Browser clients each need their own local Vite server; the default allowed origin is `http://localhost:5173`.

Keep this server on a private network. Public hosting requires HTTPS and operational hardening. Lobby and account sessions reside in memory and disappear on server restart; accounts and decks persist in `.runtime/accounts.sqlite` (override with `ACCOUNTS_FILE`). Back up that file while the server is stopped.

## Play and build

On **Play**, choose your starter and the AI's deck, then **Enter the Rift**. Select a hand card/chosen champion and press **Play card**; targeted spells highlight eligible units. Select a ready unit and choose a highlighted battlefield or base. **End turn** lets the AI act. Hover/focus cards to inspect them; **History** shows the log and trash.

AI turns play out one move at a time. Use **Pause**, **Next move**, **Speed** or **Skip AI turn** to follow the sequence at your pace. **Enlarge card** opens a readable card detail view. Playback pauses while you inspect cards, view history or switch sections. The latest playback/card-detail polish is saved as a paused checkpoint; final Chrome verification is still outstanding, as recorded in `IMPLEMENTATION_PLAN.md`.

Drag a card from your hand/champion zone into **Your base** to play it; drag targeted spells onto highlighted unit cards. Two-target spells keep the first target selected until you choose the second. Drag a ready unit onto a highlighted battlefield or back to your base. Hold **Shift** while dropping a card to use its legal Accelerate option. Drop elsewhere or press **Escape** to cancel. Mouse and touch dragging are supported; click/keyboard controls remain available, including the Accelerate button for touch users.

**Accelerate** pays an extra 1 energy and 1 matching power to play a unit ready. Lee Sin's legend can buff a friendly unit, and Viktor's can create an exhausted Recruit (each costs 1 energy and exhausts the legend until your next turn). Select a ready Lux, Crownguard on the table to exhaust her for 2 spell-only energy; unused energy expires at end of turn. These activations currently resolve during your main phase. Scoring tracks each battlefield once per turn: at seven points, a conquest draws instead unless you have scored both battlefields that turn; holding can win your last point.

A server-side coin toss randomly decides who starts each match. The animated reveal can be skipped. Both players draw four opening cards and draw again at the start of their turn; the second player channels three runes on their first turn instead of two, following Riftbound's duel rules. If the AI starts, it completes its opening turn before your controls become available.

Cards fly from the deck into your hand and turn face up; AI draws stay face down. Played cards travel from hand to table with a landing glow. Runes have six distinct domain glyphs, crystal surfaces, channeling effects and exhausted states. Movement, buffs, damage and scoring also have visual feedback. Draw events reveal card identities only to their owner. Reduced-motion preferences disable movement effects.

Open **My decks** to create an account (password minimum 10 characters). New accounts receive all seven starters once. Load a saved deck, make a copy or build from scratch, adjust card counts and save. **Use this deck** makes it available for play and lobby readiness. Retail starter counts include the chosen champion in the 40-card main deck, plus 12 runes. Proving Grounds templates use their supplied single battlefield for casual practice.

AI matches do not survive disconnects or server restarts. Card artwork currently loads from Riot's gallery and requires internet access. Click **Online** for connection settings; **With friends** contains the private lobby.

## Checks and diagnostics

`npm run typecheck`, `npm test` and `npm run build` check types, engine/network behavior and production builds. `npm run test:e2e` runs an isolated Chrome test for champion play, movement, starter grants, saved decks and mobile layout. Screenshots appear in `.runtime/browser-test`; failures retain screenshots and traces in `test-results`.

Server logs: `.runtime/logs/server.jsonl` (override with `LOG_FILE`). Requests include IDs, timing and success/rejection records; exceptions include sanitized stack frames. UI failures show the request ID for lookup. Passwords, tokens, room passwords and raw request payloads are excluded. Artwork failures log `card_art_failed` with a public card ID in Chrome's console.
