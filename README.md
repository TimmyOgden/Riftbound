# Riftbound Practice Table

An unofficial Riftbound app with a visual AI practice table, 13 official starter decks (Origins, Proving Grounds, Spiritforged, Unleashed and Vendetta), accounts or guest play, and saved deck building. Private two-player friend matches use interactive beta rules. Four-player match play remains in development. Practice uses a beta rules subset; open **Beta rules** on the table for its limits.

On macOS, Linux or Windows, install Node.js 22 and pnpm 10.18.3, then run:

```sh
pnpm install --frozen-lockfile
pnpm start
```

The launcher prints the local app URL (normally `http://localhost:5174`) and starts both services. Open that URL in Chrome on macOS/Linux. Keep the terminal open; Ctrl+C stops the app. `pnpm check:startup` verifies both services can start and then stops them.

On Windows, you can also start everything by typing `lets cook` in a new PowerShell terminal. It starts the server and client, selects free local ports, matches the browser origin, fills in the correct server address, and opens Chrome. Keep that terminal open; Ctrl+C stops both services. The command works from any directory after running `scripts/install-lets.ps1` once. You can also run `node scripts/lets-cook.mjs` from the project directory. `npm run build` builds the renderer and Electron entry points.

## Joining from another computer

Use a private Tailscale network on both computers. On the host, set `HOST` to the host's Tailscale IP and `CLIENT_ORIGIN` to the exact browser origin your friend will use, then run the server. Your friend runs the desktop client locally and enters `http://HOST_TAILSCALE_IP:3001`, followed by the room code and password. Allow inbound TCP port 3001 on the private interface in Windows Firewall. Localhost only works on the same computer. Browser clients each need their own local Vite server; the default allowed origin is `http://localhost:5173`.

Keep this server on a private network. Public hosting requires HTTPS and operational hardening. Accounts, email addresses, owned-card counts and decks persist in `.runtime/accounts.sqlite` (override with `ACCOUNTS_FILE`). Practice matches, private rooms, lobby sessions and in-progress response/combat choices persist as atomic snapshots in `.runtime/matches` (override with `MATCHES_DIR`; a custom `ACCOUNTS_FILE` gets its own adjacent snapshot directory). Account login sessions still expire on server restart. Back up the account file and match directory while the server is stopped.

## Interactive matches and recovery

All games use interactive rules. There is no simplified-mode switch. Spells and non-resource activated abilities wait on a visible chain. The controller gets priority first; **Pass priority** lets the opponent respond. After both players pass, the newest item resolves, then priority returns for any remaining items. Closed chains allow Reaction effects; open showdowns also allow Action effects. Resource abilities such as Lux's spell energy resolve immediately.

Moving into a battlefield you do not control opens a showdown. When opposing units remain, both players pass before assigning combat damage. Each player orders the opposing units; damage fills them to lethal in that order, with Tank first and Backline last. Both sides' damage resolves simultaneously. **Move units together** selects ready units from one location for a group move. AI practice and friend matches both use these rules.

Selected interactive effects include Jinx's discard choice (with Scrapheap draws), Annie's spell-return choice, Lux's expensive-spell draw, Viktor's off-turn Recruit trigger, Garen's four-unit conquest draw, Wraith's first-death draw, and Udyr's four once-per-turn activated choices. Meditation offers an exhaust-a-unit additional cost; Flash and Singularity offer one or two targets. Card inspectors show Supported, Partial or Unsupported. Trigger effects currently resolve with simplified ordering; hidden cards, equipment and many printed effects remain pending.

For a friend duel, both players open **With friends**, join the same private Duel room, choose a starter or saved deck and press **Toggle ready**. The host then presses **Start friend match**. Each table shows its owner's hand and hides the opponent's. The room status shows a disconnected opponent; the match waits when their response is needed. Finished matches can return to the room for another game.

Refreshing or reconnecting resumes your current match using a token stored in the browser tab's session storage. Server restart recovery uses the same token and saved snapshots, including unresolved chains and damage choices. Closing the tab or clearing session storage loses that tab's resume token; entering another practice match replaces its active token. Tokens are stored as hashes on the server and are never published in match views. Corrupted snapshot files stop startup with a restore-from-backup message.

Enable **Guide my first match**, or **Guide** on the table, for contextual instructions. Selecting a card shows energy/power costs, ready runes, matching runes and restricted spell energy. Touch players retain click controls, explicit Accelerate and larger action buttons.

## Play and build

On **Play**, choose your starter and the AI's deck, then **Enter the Rift**. Select a hand card/chosen champion and press **Play card**; targeted spells highlight eligible units. Select a ready unit and choose a highlighted battlefield or base. **End turn** lets the AI act. Hover/focus cards to inspect them; **History** shows the log and trash.

AI turns play out one move at a time. Use **Pause**, **Next move**, **Speed** or **Skip AI turn** to follow the sequence at your pace. **Enlarge card** opens a readable card detail view. Playback pauses while you inspect cards, view history or switch sections. The playback and card-detail checkpoint has passed Chrome verification, as recorded in `IMPLEMENTATION_PLAN.md`.

Drag a card from your hand/champion zone into **Your base** to play it; drag targeted spells onto highlighted unit cards. Two-target spells keep the first target selected until you choose the second. Drag a ready unit onto a highlighted battlefield or back to your base. Hold **Shift** while dropping a card to use its legal Accelerate option. Drop elsewhere or press **Escape** to cancel. Mouse and touch dragging are supported; click/keyboard controls remain available, including the Accelerate button for touch users.

**Accelerate** pays an extra 1 energy and 1 matching power to play a unit ready. Lee Sin's legend can buff a friendly unit, and Viktor's can create an exhausted Recruit (each costs 1 energy and exhausts the legend until your next turn). Select a ready Lux, Crownguard on the table to exhaust her for 2 spell-only energy; unused energy expires at end of turn. Lee Sin and Viktor activate during your main phase. In interactive mode their abilities use the chain; Lux can also add spell energy during response windows. Scoring tracks each battlefield once per turn: at seven points, a conquest draws instead unless you have scored both battlefields that turn; holding can win your last point.

A server-side coin toss randomly decides who starts each match. The animated reveal can be skipped. Both players draw four opening cards and draw again at the start of their turn; the second player channels three runes on their first turn instead of two, following Riftbound's duel rules. If the AI starts, it completes its opening turn before your controls become available.

Cards fly from the deck into your hand and turn face up; AI draws stay face down. Played cards travel from hand to table with a landing glow. Runes have six distinct domain glyphs, crystal surfaces, channeling effects and exhausted states. Movement, buffs, damage and scoring also have visual feedback. Draw events reveal card identities only to their owner. Reduced-motion preferences disable movement effects.

Open **Account** to register with a username, email address and a password of at least six characters. Email addresses are validated, normalized and saved; mail delivery and email verification are planned for later. Existing users can sign in without an email and add one on their Account page. New accounts receive all seven starter deck templates once. Open **My cards** to search the card gallery and record owned quantities. Collection counts start at zero; starter templates do not grant physical cards. Counts persist per account across sign-ins and server restarts.

Open **My decks** for a visual library of your saved decks with champion artwork, domain labels, deck sizes and collection progress. Search by deck/champion or filter by domain; select a deck for play directly from its tile. Browse the starter gallery to create a fresh build. **Open deck** takes you to a separate editor; **Back to my decks** returns to the library. **Resume editing** keeps your current draft available when you switch between Account, My cards and My decks in the same tab. In the editor, filter by owned cards or card type, sort by name or energy cost, and check which copies are missing from your collection. Practice decks can still use cards you do not own. Load a saved deck, make a copy or build from scratch, adjust card counts and save. **Use this deck** makes it available for play and lobby readiness. Retail starter counts include the chosen champion in the 40-card main deck, plus 12 runes. Proving Grounds templates use their supplied single battlefield for casual practice.

Card artwork currently loads from Riot's gallery and requires internet access. Click **Online** for connection settings; **With friends** contains the private lobby.

## Checks and diagnostics

`npm run typecheck`, `npm test` and `npm run build` check types, engine/network behavior and production builds. `npm run test:e2e` runs an isolated Chrome test for champion play, movement, starter grants, saved decks and mobile layout. Screenshots appear in `.runtime/browser-test`; failures retain screenshots and traces in `test-results`.

Server logs: `.runtime/logs/server.jsonl` (override with `LOG_FILE`). Requests include IDs, timing and success/rejection records; exceptions include sanitized stack frames. UI failures show the request ID for lookup. Passwords, tokens, room passwords and raw request payloads are excluded. Artwork failures log `card_art_failed` with a public card ID in Chrome's console.
