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

Click a study desk or **Learn** to enter the illustrated cabin. **Flashcards** has six subject decks and answer reveal; **My Desk** retains the full lesson journey and energy rewards. **Stats**, **Quests**, and **Settings** are functional. The focus clock starts, pauses, resets, and supports 5/15/25/45-minute sessions. Flashcard review and active focus time update daily chores automatically; repeat reveals do not count twice. Study-room state is stored separately under `sproutbound-study-room` so existing game progression remains intact.

## Greenhouse polish

Classmates start offline, leaving their desks visible and unoccupied. Toggle their simulated presence in **Settings → Show demo controls**. Your avatar can still walk around the greenhouse, and the Sproutling remains present. The telescope, hearth, plant shelf, and entrance offer additional room interactions. The garden gallery previews all four cosmetic stages; progression never locks lessons or study tools.

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
