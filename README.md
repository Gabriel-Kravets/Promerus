# SproutBound

A cozy study game built with Next.js App Router, TypeScript, React, PixiJS, Zustand, Motion, and Tailwind CSS. Auth0 handles identity through Universal Login; gameplay and progress remain local to this browser. Supabase is deferred.

## Run

```sh
npm install
cp .env.example .env.local
npm run dev
```

If `.env.local` already exists, add the two public Auth0 values to it rather than replacing it. Open `http://localhost:3000/`. `.env.example` contains the existing hackathon SPA's public Domain and Client ID. Use your environment's application values as needed. No client secret is used or permitted in browser configuration.

`NEXT_PUBLIC_AUTH0_DOMAIN` is the bare tenant hostname, without `https://` or a trailing slash. `NEXT_PUBLIC_AUTH0_CLIENT_ID` identifies the SPA. Restart development after edits. For Vercel, set both variables for the relevant Preview/Production environment before building; public variables are embedded at build time, so rebuild after changes. See [Next.js environment variables](https://nextjs.org/docs/pages/guides/environment-variables).

`npm run build` produces a production Next.js application in `.next/`, including `/`, `/game`, `/learn`, and the questionnaire's `/api/study` endpoint. Run `npm start` for a local production smoke test at `http://127.0.0.1:3000/` (allowlist that origin in Auth0), or `npm start -- --hostname localhost` to use the documented localhost Auth0 URLs. Production requires a Next.js server, such as Vercel's Next.js preset; static `out/` hosting cannot run the study API.

Development builds use `.next-dev/` and production builds use `.next/`, so `npm run build` does not overwrite a running development server's chunks.

## Authentication

The root layout's `AuthGate` withholds all game routes until the Auth0 SPA SDK restores or establishes a session. Login and signup open Universal Login in a popup directly from the click. **Need a hand signing in? → Continue sign-in in this tab** offers an explicit redirect fallback and retains the last attempted signup intent. It returns to `/`; popup login retains the current route. **Settings → Sign out** ends the Auth0 session and returns to the login screen.

A single loader (`src/lib/auth-client.ts`) loads the vendored official SDK 2.27.0 and the adapter (`public/auth/auth.js`). Concurrent startup checks share initialization so redirect callbacks are consumed once. Loading, request states, retries, safe errors, popup cleanup, and bounded timeouts are integrated into the ivy-framed parchment screen, with a quiet forest-green background and reduced-motion-aware ambient fireflies. The separate HTML prototype and its duplicate SDK/configuration have been retired; run only the Next.js app. See the retained SDK license in `public/auth/LICENSE.auth0-spa-js`.

In the existing Auth0 **Single Page Application**, keep teammates' URLs and add:

| Dashboard setting | Local value | Production value |
| --- | --- | --- |
| Allowed Callback URLs | `http://localhost:3000/` | Actual HTTPS origin plus `/` |
| Allowed Logout URLs | `http://localhost:3000/` | Actual HTTPS origin plus `/` |
| Allowed Web Origins | `http://localhost:3000` | Actual HTTPS origin |

If you use `127.0.0.1` or another port, allowlist its matching URLs separately. Callback/logout always use the current origin root, including from `/game` and `/learn`. For Vercel previews, add each trusted preview origin explicitly or use a stable preview hostname; do not use wildcard callbacks.

Keep the database connection and signup enabled as appropriate. **Google, passkeys, and hosted branding remain unverified** and require dashboard configuration. Both buttons leave provider selection to Universal Login. Follow [the Auth0 dashboard, Google, passkey, and branding guide](docs/auth0-setup.md).

The application has a client-side login gate. The study API currently checks request origin but does not validate Auth0 access tokens; the gate does not provide server-side authorization. Server APIs must validate tokens and enforce ownership before being treated as account-protected services. Auth0 `sub` is preserved unchanged for a future backend; email is not an account key. The SDK retains its existing localStorage token cache for refresh restoration, with the associated exposure to successful XSS. Game saves are still browser-local and shared by accounts on the same browser/origin. Signing out does not erase them. No Supabase, cloud saves, or account-specific persistence is implemented.

## Verify authentication locally

```sh
npm run typecheck
npm test
npm run build
```

Automated tests mock Auth0; they do not verify live credentials, dashboard configuration, Google, or passkeys.

1. In a signed-out browser, open `/`, `/game`, and `/learn`. Each should show sign-in and withhold the game.
2. Choose **Enter the Greenhouse** and sign in with a test account. The popup should close and show avatar creation or your saved greenhouse. Refresh to check session restoration.
3. Use **Settings → Sign out**. Confirm the login screen returns; direct game URLs should remain gated.
4. Choose **Create an account** and complete Universal Login signup with a disposable test account. The game should open afterward.
5. Close or block a login/signup popup. Check the safe message and enabled retry controls. Expand the help and choose **Continue sign-in in this tab**; after signup failure it should retain signup intent. Complete login and confirm a clean root callback URL without code/state.
6. Cancel the Auth0 redirect and check recovery without raw provider details. Simulate offline/failed `/auth/` script requests, reconnect, then use **Retry connection**.
7. Check Google and database passkey enrollment/login only after enabling them in the tenant. Use a real supported browser/device and approve its prompts yourself.
8. Enter the greenhouse, walk, study, earn nutrients, and refresh. Confirm existing browser saves remain intact, including after logout/login. Repeat with a real HTTPS deployment and its configured allowlists.

## Play

1. Create a greenhouse, customize your avatar, and enter.
2. Click clear floor tiles to walk. Furniture and the central garden block movement.
3. Click your back-left study desk, or use **Learn**, to create a demo learning path.
4. Choose Programming, Mathematics, or Languages for a complete five-lesson course. Other topics use an explicitly labeled learning-skills template. Experience, goal, and duration are saved preferences; this prototype does not adapt the authored curriculum.
5. Read a lesson, answer its three questions, and collect 20 nutrients. Incorrect answers provide explanations and can be retried. Replays do not grant duplicate rewards.
6. Open **Settings → Show demo controls** and complete a lesson as Maya. Two different contributors unlock the Moonlight Flower. The initial 60 nutrients plus two completions reaches the first garden upgrade.
7. Continue learning or trigger more simulated completions to reach Bloom at 180 nutrients and Sanctuary at 300.
8. Refresh: avatar, preferences, lessons, contributions, and progression remain in this browser.

## Topic and difficulty questionnaires

In **My Desk**, enter a learning topic, choose Beginner, Intermediate, or Advanced, and select **Start studying**. Gemini generates four multiple-choice questions and one short answer. Submit all five answers for a score and explanations; matching cards appear in **Flashcards**. The existing offline five-lesson courses remain available through **Offline lessons** in the desk heading. In **Flashcards**, use **Flashcard deck** to switch between **Current quiz** and the six built-in decks without discarding your quiz.

Add `GEMINI_API_KEY=your_key` to `.env.local` without replacing the public Auth0 settings. Optionally set `GEMINI_MODEL` to a model supported by your Gemini account. Restart the server after changing these settings. The Gemini key stays on the server; generation and short-answer grading require Gemini access and quota.

Each correct answer grants 10/20/30 nutrients by difficulty, plus one coin per five nutrients. Nutrients advance the greenhouse tree; coins appear in study Stats. Quiz rewards are granted once per quiz, including replays. Questions, answers, topic history, rewards, and completed lessons are saved in this browser. Switching study tabs preserves the active quiz. Saved signed quizzes can be reopened for grading; in-memory sessions last two hours and can be restored from the saved signed quiz while the signing key remains unchanged.

Online study-time tracking runs only after authentication and stops on sign-out. Existing browser-local saves and the Auth0 login flow are retained.

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

Click a study desk or **Learn** to enter the illustrated cabin. **Flashcards** has six subject decks and answer reveal; **My Desk** offers topic quizzes alongside the full lesson journey and nutrients rewards. **Stats** and **Settings** are functional. Quests now open over the greenhouse from its Quests button or the quest board. The focus clock starts, pauses, resets, and supports 5/15/25/45-minute sessions. Flashcard review and active focus time update daily chores automatically; repeat reveals do not count twice. Study-room state is stored separately under `sproutbound-study-room` so existing game progression remains intact.

## Greenhouse polish

Classmates start offline, leaving their desks visible and unoccupied. Toggle their simulated presence in **Settings → Show demo controls**. Your avatar can still walk around the greenhouse, and the Sproutling remains present. The telescope, hearth, plant shelf, and entrance offer additional room interactions. The garden gallery previews all four cosmetic stages; progression never locks lessons or study tools.

## World interaction and atmosphere

World input is dispatched once in scene coordinates: tight object geometry takes priority over the walkable floor, and decorative sprites never receive pointer events. Desks and Sproutling use atlas alpha checks; the garden uses a stone-bed ellipse instead of a canopy rectangle. Hover and selection feedback fades over 150 ms, with a contextual tooltip, approach tile, and nearby interaction symbol.

Navigation uses a half-tile mesh traced to the visible platform, with a seven-pixel avatar clearance, separate furniture and circular garden collision, connected-region validation, and Dijkstra paths weighted by screen distance. Occupied floor clicks resolve to a reachable edge; water and off-platform clicks are ignored. Objects activate after arrival, and new movement cancels a pending interaction.

The existing Pixi ticker also drives masked water-texture shimmer, wavelets, ripples, anchored plant and tree-leaf patches, layered pixel flames, independent lantern/crystal/garden light, and a fixed pool of 48 motes, dust, embers, leaves, and reward particles. Ambient motion and the system reduced-motion preference stop nonessential motion; Simple atmosphere removes extra particles and light flicker. The ticker pauses when the tab is hidden. Existing atlas art has one standing and one reading pose per avatar, so walking uses four generated stride frames with independent leg motion, directional mirroring, and a small body bob. Actual scene-coordinate changes advance the cycle; stopping, opening a menu, and reduced-motion settings restore the idle pose.

## Cohesive world and party interface

The four original 178px study desks start in a mirrored layout around the center tree: two on the left and two on the right. Drag an original desk, the shared garden, or a placed Collection item to move it; releasing in a valid spot saves immediately. Invalid drops retain the editable preview and original saved placement. Cancel move/Escape restores it before a successful drop. Holding still for 500 ms opens item options. `studyStations` in `world-layout.ts` owns each station's default atlas cell, position, seat, alternative approaches, and visible contour. Saved fixture positions move the artwork, seats, interaction shapes, and navigation obstacles together without adding Collection copies. Every desk opens the existing study room after walking and a brief reading-pose transition.

Move mode has a quest-style X button to return the piece to Collection and a Flip button to mirror its sprite. Flips save with the drop or the optional Place here button; cancelling restores the previous orientation. Original room pieces can also be stored and re-placed, with their positions and orientations retained. Desk placement footprints are larger and lower than their walking collision shapes. Potted-tree collisions follow the pot rim; the shared tree uses an ellipse around its visible ground bed, excluding canopy and glow. A ten-pixel buffer keeps projecting feet and pots away from the bottom railing.

A valid placement can nudge gardeners and the Sproutling to separate nearby clear spots, up to 96 scene pixels away. The entire relocation plan is checked against floor edges, existing furniture, and other occupants before anything is saved or moved. Crowded spots with no safe short step remain invalid. Previewing and cancelling do not move occupants.

The stove now has a traced visible outline, an extended adjoining floor boundary, a preferred front approach at tile `(11.5, -0.5)`, reachable fallbacks, and a look-at point. Preferred chair and stove approaches are honored before considering alternatives. Visible floor tiles show a thin hover diamond; blocked tiles use a subdued unavailable mark. Opening a menu cancels pending world movement so a delayed interaction cannot replace it.

Five lightweight 32px SVG leaf cursors provide default, walking, interaction, blocked, and pressed feedback with a `(3, 2)` hotspot and native fallbacks. Text inputs retain native text cursors.

A compact party roster crops customized standing sprites to head portraits without changing the atlas. It opens the existing Friends menu with that member's details selected. Offline classmates remain listed but do not render in the world. Presence and simulated activities can be adjusted in Settings demo controls. Local activity updates when walking, studying, and resting; offline presence overrides saved activity labels. Older saved games receive safe activity defaults.

Shared UI primitives provide icon tooltips, head portraits, panel headings, status badges, and progress meters. The Friends menu retains its demo code, Copy action, contributions, activity feed, and Moonlight Bloom objective, now using the same walnut, bronze, parchment, and botanical framing as the greenhouse. No networking or powerups are implemented.


## Room updates

Hair recoloring uses per-pose atlas masks for the full crown, bangs and long locks, preserving face and accessory colors. Garden stage buttons show a large clipped visual preview without changing nutrients or the active stage.

The greenhouse Quests popup shows daily flashcard, focus, and lesson goals using the same persisted study data. The study page no longer contains quest navigation or the chores sidebar.

Friends contains separate **Room members** and **Friends List** views. Accept the explicitly labeled demo requests to save friends independently of room membership; Rowan demonstrates a friend outside the greenhouse. Accepted friends persist under `sproutbound-friends`. These remain local simulations, not networked friendship requests.
