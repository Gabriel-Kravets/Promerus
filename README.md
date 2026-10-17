# Sproutbound

A frontend-only, locally saved learning game built with Next.js App Router, TypeScript, React, PixiJS, Zustand, Motion, and Tailwind CSS.

## Run

```sh
npm install
npm run dev
```

Open http://127.0.0.1:3000. `npm run build` creates a static export in `out/`; there are no server APIs, accounts, credentials, or external AI calls.

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

## World interaction and atmosphere

World input is dispatched once in scene coordinates: tight object geometry takes priority over the walkable floor, and decorative sprites never receive pointer events. Desks and Sproutling use atlas alpha checks; the garden uses a stone-bed ellipse instead of a canopy rectangle. Hover and selection feedback fades over 150 ms, with a contextual tooltip, approach tile, and nearby interaction symbol.

Navigation uses a half-tile mesh traced to the visible platform, with a seven-pixel avatar clearance, separate furniture and circular garden collision, connected-region validation, and Dijkstra paths weighted by screen distance. Occupied floor clicks resolve to a reachable edge; water and off-platform clicks are ignored. Objects activate after arrival, and new movement cancels a pending interaction.

The existing Pixi ticker also drives masked water-texture shimmer, wavelets, ripples, anchored plant and tree-leaf patches, layered pixel flames, independent lantern/crystal/garden light, and a fixed pool of 48 motes, dust, embers, leaves, and reward particles. Ambient motion and the system reduced-motion preference stop nonessential motion; Simple atmosphere removes extra particles and light flicker. The ticker pauses when the tab is hidden. Existing atlas art has one standing and one reading pose per avatar, so walking uses directional mirroring and a restrained step animation rather than newly drawn directional frames.

## Cohesive world and party interface

The four original 178px study desks now sit in a left nook, rear window station, fireplace-side corner, and front-right perimeter station. `studyStations` in `world-layout.ts` owns each station's atlas cell, position, seat, alternative approaches, and visible contour. Collision derives from these same positions. Every desk opens the existing study room after walking and a brief reading-pose transition.

The stove now has a traced visible outline, an extended adjoining floor boundary, a preferred front approach at tile `(11.5, -0.5)`, reachable fallbacks, and a look-at point. Preferred chair and stove approaches are honored before considering alternatives. Visible floor tiles show a thin hover diamond; blocked tiles use a subdued unavailable mark. Opening a menu cancels pending world movement so a delayed interaction cannot replace it.

Five lightweight 32px SVG leaf cursors provide default, walking, interaction, blocked, and pressed feedback with a `(3, 2)` hotspot and native fallbacks. Text inputs retain native text cursors.

A compact party roster crops customized standing sprites to head portraits without changing the atlas. It opens the existing Friends menu with that member's details selected. Offline classmates remain listed but do not render in the world. Presence and simulated activities can be adjusted in Settings demo controls. Local activity updates when walking, studying, and resting; offline presence overrides saved activity labels. Older saved games receive safe activity defaults.

Shared UI primitives provide icon tooltips, head portraits, panel headings, status badges, and progress meters. The Friends menu retains its demo code, Copy action, contributions, activity feed, and Moonlight Bloom objective, now using the same walnut, bronze, parchment, and botanical framing as the greenhouse. No networking or powerups are implemented.
