# Two-phase multiplayer roadmap

1. **Frontend integration and complete multiplayer backend:** Gate B PR #2 is merged into dev. The approved architecture and local backend implementation are on `feat/supabase-multiplayer`; hosted staging configuration/verification is pending. Existing Auth0, art, sprites, cursor and the local demo are retained. Configured online mode adds account-backed profiles/onboarding, Greenhouses navigation, memberships/visits, session movement/presence, server grading and shared progression.
2. **End-to-end testing and release:** two real accounts in separate sessions/devices, hosted security/reconnection/duplicate-reward checks, fixes, reviewed backend integration into dev, then review and validation of dev into main. PR #1 remains open; no automatic main merge.

Start with [the approved architecture](docs/backend-architecture-proposal.md) and [staging setup / outstanding gates](docs/backend-staging-setup.md). No production database change has been applied. With no public Supabase environment configured, the application continues its explicitly labeled browser-local demo. Auth0 is the only login system.

The historical frontend and standalone-auth documentation below describes that local mode and the preserved prototypes.

# Sproutbound development branch

The Next.js greenhouse now uses the Auth0 popup login from `feature/sproutbound-auth`. All game routes wait for authentication. Login and signup open Auth0 Universal Login; a restored session opens the game on refresh. Use **Settings ? Sign out** to end the session.

## Integrated authentication setup

Run `npm install`, then `npm run dev`, and open `http://localhost:3000/`. Use the Auth0 settings below for both the integrated app and standalone prototype. The running app serves its Auth0 SDK, adapter, public configuration, and mascot from `public/auth/`. Edit `public/auth/config.js` for the integrated app. No client secret belongs in this file. The root HTML/JS files remain the original standalone prototype.

Add these values in your Auth0 SPA application dashboard (both hostname variants if you use both):

| Setting | Values |
| --- | --- |
| Allowed Callback URLs | `http://localhost:3000/` |
| Allowed Logout URLs | `http://localhost:3000/` |
| Allowed Web Origins | `http://localhost:3000` |

The default server uses `http://localhost:3000/`. Add the port 3000 URLs above in Auth0 before signing in. Production needs the matching HTTPS origin and root callback/logout URL. The app always uses the origin root as its callback, including visits to `/game` and `/learn`.

Verify login, signup, popup cancellation, refresh, direct `/game` and `/learn` visits, and Settings ? Sign out with a test account. This is a client-side SPA login gate; future server APIs must validate access tokens themselves. Progress still uses browser-local storage and is shared by accounts using that browser; this integration does not add account-specific or cloud saves.

# Sproutbound

A frontend-only, locally saved learning game built with Next.js App Router, TypeScript, React, PixiJS, Zustand, Motion, and Tailwind CSS.

## Run

```sh
npm install
npm run dev
```

Open http://localhost:3000/. `npm run build` creates a static export in `out/`; authentication uses Auth0, while gameplay has no server APIs or external AI calls.

## Play

1. Create a greenhouse, customize your avatar, and enter.
2. Click clear floor tiles to walk. Furniture and the central garden block movement.
3. Click your back-left study desk, or use **Learn**, to create a demo learning path.
4. Choose Programming, Mathematics, or Languages for a complete five-lesson course. Other topics use an explicitly labeled learning-skills template. Experience, goal, and duration are saved preferences; this prototype does not adapt the authored curriculum.
5. Read a lesson, answer its three questions, and collect 20 energy. Incorrect answers provide explanations and can be retried. Replays do not grant duplicate rewards.
6. Open **Settings → Show demo controls** and complete a lesson as Maya. Two different contributors unlock the Moonlight Flower. The initial 60 energy plus two completions reaches the first garden upgrade.
7. Continue learning or trigger more simulated completions to reach Bloom at 180 energy and Sanctuary at 300.
8. Refresh: avatar, preferences, lessons, contributions, and progression remain in this browser.

## Controls and accessibility

All essential activities have HTML navigation buttons independent of pointer movement. Escape closes panels; dialogs contain keyboard focus. Settings control reward sounds, ambient motion, interface size, and particles. System reduced-motion preferences are respected. Audio uses quiet synthesized chimes after user interaction. No sound files are required.

## Architecture

- `src/components/GameCanvas.tsx`: independent PixiJS scene, layered procedural artwork, depth ordering, hit targets, avatars, movement, particles.
- `src/lib/movement.ts`: 2:1 projection and collision-aware breadth-first shortest-path navigation on a small tile grid.
- `src/lib/art.ts`: original composable SVG character assets shared between previews and world textures.
- `src/components/Learning.tsx`: complete fullscreen learning flow.
- `src/lib/courses.ts`: fifteen authored lessons, 45 multiple-choice questions, and a general demo template.
- `src/store/game.ts`: local persistence, unique reward claims, identity and settings.

The world uses a detailed environment plate edited from the supplied reference, with independent pixel-art desk, garden, companion, and character sprites. The original procedural renderer is retained in `src/components/ProceduralWorld.tsx` as a development reference. Generated assets are stored in `public/assets/`; characters use compatible illustrated silhouettes with runtime palette customization. Classmates and their activities are local simulations; the copied room code does not provide networking.

## Verify

```sh
npm run typecheck
npm test
npm run build
```

Tests cover coordinate conversion, obstacle avoidance, interactive approach points, lesson completeness, reward idempotency, distinct quest contributors, and stage boundaries.

## Cozy study room

Click a study desk or **Learn** to enter the illustrated cabin. **Flashcards** has six subject decks and answer reveal; **My Desk** retains the full lesson journey and energy rewards. **Stats** and **Settings** are functional. Quests now open over the greenhouse from its Quests button or the quest board. The focus clock starts, pauses, resets, and supports 5/15/25/45-minute sessions. Flashcard review and active focus time update daily chores automatically; repeat reveals do not count twice. Study-room state is stored separately under `sproutbound-study-room` so existing game progression remains intact.

## Greenhouse polish

Classmates start offline, leaving their desks visible and unoccupied. Toggle their simulated presence in **Settings → Show demo controls**. Your avatar can still walk around the greenhouse, and the Sproutling remains present. The telescope, hearth, plant shelf, and entrance offer additional room interactions. The garden gallery previews all four cosmetic stages; progression never locks lessons or study tools.

## World interaction and atmosphere

World input is dispatched once in scene coordinates: tight object geometry takes priority over the walkable floor, and decorative sprites never receive pointer events. Desks and Sproutling use atlas alpha checks; the garden uses a stone-bed ellipse instead of a canopy rectangle. Hover and selection feedback fades over 150 ms, with a contextual tooltip, approach tile, and nearby interaction symbol.

Navigation uses a half-tile mesh traced to the visible platform, with a seven-pixel avatar clearance, separate furniture and circular garden collision, connected-region validation, and Dijkstra paths weighted by screen distance. Occupied floor clicks resolve to a reachable edge; water and off-platform clicks are ignored. Objects activate after arrival, and new movement cancels a pending interaction.

The existing Pixi ticker also drives masked water-texture shimmer, wavelets, ripples, anchored plant and tree-leaf patches, layered pixel flames, independent lantern/crystal/garden light, and a fixed pool of 48 motes, dust, embers, leaves, and reward particles. Ambient motion and the system reduced-motion preference stop nonessential motion; Simple atmosphere removes extra particles and light flicker. The ticker pauses when the tab is hidden. Existing atlas art has one standing and one reading pose per avatar, so walking uses four generated stride frames with independent leg motion, directional mirroring, and a small body bob. Actual scene-coordinate changes advance the cycle; stopping, opening a menu, and reduced-motion settings restore the idle pose.

## Cohesive world and party interface

The four original 178px study desks use a fixed mirrored layout around the center tree: two on the left and two on the right. `studyStations` in `world-layout.ts` owns each station's atlas cell, position, seat, alternative approaches, and visible contour. Collision derives from these same positions. Every desk opens the existing study room after walking and a brief reading-pose transition.

The stove now has a traced visible outline, an extended adjoining floor boundary, a preferred front approach at tile `(11.5, -0.5)`, reachable fallbacks, and a look-at point. Preferred chair and stove approaches are honored before considering alternatives. Visible floor tiles show a thin hover diamond; blocked tiles use a subdued unavailable mark. Opening a menu cancels pending world movement so a delayed interaction cannot replace it.

Five lightweight 32px SVG leaf cursors provide default, walking, interaction, blocked, and pressed feedback with a `(3, 2)` hotspot and native fallbacks. Text inputs retain native text cursors.

A compact party roster crops customized standing sprites to head portraits without changing the atlas. It opens the existing Friends menu with that member's details selected. Offline classmates remain listed but do not render in the world. Presence and simulated activities can be adjusted in Settings demo controls. Local activity updates when walking, studying, and resting; offline presence overrides saved activity labels. Older saved games receive safe activity defaults.

Shared UI primitives provide icon tooltips, head portraits, panel headings, status badges, and progress meters. The Friends menu retains its demo code, Copy action, contributions, activity feed, and Moonlight Bloom objective, now using the same walnut, bronze, parchment, and botanical framing as the greenhouse. No networking or powerups are implemented.

---

# Sproutbound authentication prototype

This is the existing Sproutbound login page with Auth0 popup authentication. Its artwork, typography, colors, and layout remain local to Sproutbound. Auth0 Universal Login opens in a separate window to collect credentials; the original page stays visible. The page does not collect a password.

## Auth0 application settings

The Domain and Client ID for the hackathon Single Page Application are already in `config.js`. These identifiers are public; never add a Client Secret to browser code. Confirm these settings in the Auth0 application's dashboard:

| Auth0 setting | Local value |
| --- | --- |
| Allowed Callback URLs | `http://localhost:3000/` |
| Allowed Logout URLs | `http://localhost:3000/` |
| Allowed Web Origins | `http://localhost:3000` |

Enable the database and/or social connections you want players to use. Auth0's hosted login screen includes its own **Reset password** link for database users; the old local Forgot password link was removed because the page no longer asks for an email. When deployed, add the matching HTTPS callback, logout URL, and web origin for the final host.

The current Auth0 popup says **SwampHacks Study Tool**. To keep the player experience consistent, update the application name and Universal Login branding in the Auth0 dashboard when your team is ready.

## Run and test

Continue serving this folder at `http://localhost:3000/`. If that server is stopped, run `python3 -m http.server 3000` from this folder. No framework or package install is required.

1. Open `http://localhost:3000/` in a regular browser tab. Select **Enter the Greenhouse**. Auth0 should open in a popup while the Sproutbound page stays visible.
2. Sign in with a test account. The popup should close and Sproutbound should show the temporary welcome panel with the account's name or email.
3. Refresh the Sproutbound tab. The welcome panel should return while the SDK's cached session is valid.
4. Select **Sign out**. Auth0 clears the session and returns to the login page.
5. Select **Create an account**. The popup should open Auth0's signup screen. Complete this with a disposable test account if you want to verify the whole flow.
6. To check password recovery, open the login popup and choose **Reset password** inside Auth0.

The SDK uses `loginWithPopup()` for both login and signup. It opens the popup directly from the button click to avoid browser popup blocking and uses `screen_hint: "signup"` for account creation. If your browser still blocks the window, allow popups for `localhost:3000`. Closing the popup before finishing shows a gentle cancellation message on Sproutbound. Logout uses Auth0's hosted logout and returns to the same page.

The Auth0 SDK's local storage cache restores a valid token after refresh. For the final game, the team should review the cache choice and any API authorization with its production security model. Expired sessions may need an Auth0 silent session check, which can depend on browser privacy settings.

## Files for integration

- `index.html` and `styles.css`: existing fantasy-themed page and temporary welcome panel.
- `config.js`: public Auth0 application settings.
- `auth.js`: reusable Auth0 adapter (`initialize`, `login`, `signup`, `logout`). It leaves protocol handling to the official SDK.
- `app.js`: button interactions, errors, and signed-in rendering.
- `auth0-spa-js.production.js`: official Auth0 SPA SDK browser bundle, version 2.27, from `https://cdn.auth0.com/js/auth0-spa-js/2.27/auth0-spa-js.production.js`; its license is in `LICENSE.auth0-spa-js`.

The prototype contains no database, game dashboard, or progression system. The welcome panel can be replaced by the game's authenticated route when the team integrates it.

## Room updates

Hair recoloring uses per-pose atlas masks for the full crown, bangs and long locks, preserving face and accessory colors. Garden stage buttons show a large clipped visual preview without changing energy or the active stage.

The greenhouse Quests popup shows daily flashcard, focus, and lesson goals using the same persisted study data. The study page no longer contains quest navigation or the chores sidebar.

Friends contains separate **Room members** and **Friends List** views. Accept the explicitly labeled demo requests to save friends independently of room membership; Rowan demonstrates a friend outside the greenhouse. Accepted friends persist under `sproutbound-friends`. These remain local simulations, not networked friendship requests.
