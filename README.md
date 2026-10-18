# Two-phase multiplayer roadmap

1. **Frontend integration and complete multiplayer backend:** Gate B PR #2 is merged into dev. The approved architecture and local backend implementation are on `feat/supabase-multiplayer`; hosted staging configuration/verification is pending. Existing Auth0, art, sprites, cursor and the local demo are retained. Configured online mode adds account-backed profiles/onboarding, Greenhouses navigation, memberships/visits, session movement/presence, server grading and shared progression.
2. **End-to-end testing and release:** two real accounts in separate sessions/devices, hosted security/reconnection/duplicate-reward checks, fixes, reviewed backend integration into dev, then review and validation of dev into main. PR #1 was merged by Gabriel-Kravets during backend development; future main promotion still requires team approval.

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

# SproutBound authentication component

This branch contains the standalone authentication component for the team's Next.js game. It keeps the existing parchment card, navy background, green entry button, fonts, and seated sprout mascot. The official Auth0 SPA SDK **2.27.0** still handles authentication through Universal Login.

## What is ready

- Existing popup login, signup, logout, and SDK session restoration.
- One Universal Login flow for every enabled method: email/password, Google, and database passkeys. No provider is forced, so email/password remains available. Google/passkey availability must be configured in Auth0; it cannot be inferred from the public Client ID.
- Disabled controls during startup/requests, accessible status messages, retry, and safe error wording. Background SDK HTTP/authorization timeouts are 15 seconds; interactive popups retain their 120-second timeout.
- An optional **Need a hand signing in? → Continue sign-in in this tab** fallback using the same SDK. It preserves signup intent after a failed signup popup and never redirects automatically.
- A stable origin-root callback/logout URL, matching the integrated game on `dev`.

**Google, passkeys, and hosted branding are not enabled by these repository changes.** Complete [the dashboard setup and macOS test procedure](docs/auth0-setup.md). No Auth0 dashboard was accessed.

## Run the component

From this directory, with port 3000 free:

```sh
python3 -m http.server 3000 --bind localhost
```

Open `http://localhost:3000/` in Safari or Chrome for the standalone prototype. For the integrated Next.js game, use `npm run dev` instead. Run one server at a time on this port.

In the existing Auth0 SPA application, add these values without removing teammates' valid URLs:

| Setting | Local value |
| --- | --- |
| Allowed Callback URLs | `http://localhost:3000/` |
| Allowed Logout URLs | `http://localhost:3000/` |
| Allowed Web Origins | `http://localhost:3000` |

If you still use port 4173 for the standalone component, add its matching root callback/logout URLs and origin too. Deployed applications need their actual HTTPS URLs. Configuration stays in `config.js`; only the Domain and public SPA Client ID belong there.

## Checks

Requires Node.js 18 or newer; no dependency installation is needed for these tests.

```sh
node --test tests/*.test.cjs
node --check auth.js
node --check app.js
node --check config.js
```

Tests mock the SDK and DOM to exercise provider-neutral profiles, popup timing/cleanup, failures, callback cleanup, retry, signup fallback, and logout. They do not authenticate against the tenant or prove passkey/Touch ID enrollment. Use the manual matrix in [the setup guide](docs/auth0-setup.md) for those checks.

## Teammate integration

- `auth.js`: existing adapter methods `isConfigured`, `initialize`, `login`, `signup`, `logout`; adds `loginInTab(signup = false)` and `errorMessage(error)`.
- `app.js`, `index.html`, `styles.css`: standalone auth UI and temporary welcome screen.
- `config.js`: unchanged public Auth0 settings.
- `auth0-spa-js.production.js`, `LICENSE.auth0-spa-js`: unchanged vendored official SDK and license.
- `sprout-mascot.png`: unchanged existing branding asset.
- `docs/auth0-setup.md`: dashboard instructions, branding palette, macOS checks, security and Supabase handoff.

The integrated game loads its adapter from **`public/auth/auth.js`**, not root `auth.js`. The teammate adapter improvements and explicit fallback/help are now integrated there and in `AuthGate.tsx`; the served adapter also retains `getToken(expectedSubject)` for the Auth0-backed Supabase boundary. Root `app.js` targets this HTML's elements and should not be injected into the React game. The existing `initialize/login/signup/logout` contract remains compatible; all methods continue returning the SDK's original user profile without rewriting `sub`.

Scopes remain `openid profile email`; no audience, claims, Auth0 domain, Client ID, refresh-token policy, or token-cache setting was changed. Existing localStorage caching persists across reloads but is exposed to successful XSS. Client UI gating does not authorize backend requests. The approved backend validates Auth0 ID tokens and enforces actor-scoped access; its staging configuration and live verification remain pending. See [staging setup](docs/backend-staging-setup.md).
