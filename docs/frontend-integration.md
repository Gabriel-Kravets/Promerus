# Gate B — Frontend integration

Base reviewed: latest `origin/dev`, `1bacce5534bb5a9ae4be5c76fdb24e107cce0939`.
Working branch: `Jojo_dev_update`. PR #1 (`dev` → `main`) remains awaiting team approval.

## Requirements already completed in dev

| Area | Existing implementation retained |
| --- | --- |
| Greenhouse composition | Four original desks in mirrored pairs around the central garden; synchronized seats and obstacles in `world-layout.ts`. |
| Movement | Half-tile routes, fractional rerouting, obstacle avoidance, preferred chair/fireplace approach tiles, acceleration, braking, facing and depth sorting. |
| World interaction | Shared interaction definitions, alpha-tested desks/Sproutling, restrained outlines, floor markers, bounded tooltips; decorative effects do not capture clicks. |
| Character art | Existing avatar palettes, protected skin/accessory pixels, reading poses, prebuilt run frames, chair alignment and Sproutling growth stages. |
| Cursor | Leaf default, interactive, walk, blocked and pressed states; native text editing cursor preserved. |
| Party | Four matching head portraits and activity labels; simulated presence explicitly labeled; offline gardeners disappear from the scene. |
| UI and navigation | Bronze/parchment controls, selected/focus/hover states, social panels, garden gallery, profile customization, fullscreen study and keyboard access to activities. |
| Environment | Masked water motion, reflections/ripples, foliage, lantern flicker, stove flames, particles and companion reactions; background ticker suspension and cleanup. |
| Gameplay | Auth0 entry, learning journeys, quizzes, +20 energy for new lessons, duplicate reward protection, cosmetic garden stages and local progress persistence. |

No older world files or art were restored from `Jojo_test_frontend`. No furniture coordinates, collision shapes, navigation geometry, assets, Auth0 files, dependencies or progression rules were changed.

## Remaining defects fixed

- Daily quests stayed stale when the mounted greenhouse received flashcard/focus progress. Study saves now emit a same-tab notification; the widget also refreshes on storage/focus/visibility changes and day rollover. Unchanged visible quest values retain their existing state rather than rerendering every timer tick.
- Daily rollover could repeatedly reset the lesson baseline, losing the next completed lesson from the quest. The normalized baseline is persisted, and an open study room rolls daily counters forward while preserving timer settings/session state. Invalid negative baselines fall back safely.
- The nonmodal quest widget lacked Escape/focus restoration and a labeled section. Escape now minimizes it when no dialog is active, and keyboard focus returns to its launcher when appropriate. The study button's broken separator was corrected.
- Sproutling continued autonomous roaming with ambient motion disabled. Roaming now pauses with ambient/system reduced motion; system reduced motion also suppresses gait bob/lean/stride, while user-directed navigation remains available. The achievement light pulse respects the same motion preference.

A suspected roster-tab defect was investigated and excluded: the existing dialog flow already resets that view on reopening. No duplicate social implementation was added.

## Validation

- `npm run typecheck`: passed.
- `npm test`: 43 tests passed, including five new regression tests for quest notifications, daily rollover/baselines, corrupt saves and reduced-motion gait. Existing route, obstacle, fireplace, seating, sprite, presence, reward and Auth0 adapter tests pass.
- `npm run build`: passed; static routes `/`, `/game`, `/learn` exported successfully.
- No standalone lint script or ESLint configuration exists; the Next build's validation completed. This is not a separate ESLint pass.
- Literal artwork references in frontend TSX/CSS: 11 checked, none missing. `git diff --check` passed.

Browser checks used the production export on a separate loopback-only server with a fictional authentication adapter. The fixture was outside the repository; it did not alter production Auth0, use real account data or connect to a backend.

Browser-observed flows:

- Avatar creation; greenhouse, sprites and portraits rendered.
- Three Science reveals immediately showed `3 / 3 cards` on return.
- Complete Python lesson quiz awarded +20 energy and showed `1 / 1 lesson`.
- Every desk selected the correct station, walked to its chair and opened study; fireplace arrived at `11.5,-0.5` and opened its existing quiet-breath panel.
- A water click did not change destination or player position.
- Mock Maya presence rendered a second avatar; a simulated teammate lesson advanced the garden to Sprout and retained offline roster slots.
- Focus timer started, counted down and paused; progress and motion preference survived reload.
- Escape minimized quests and returned keyboard focus to Quests, including after reloading the final build.
- Two still-motion greenhouse screenshots, three seconds apart, were pixel-identical.
- No captured browser console errors. Views were inspected at 1280×720 and 1744×1034.

## Limits and deferred work

Real Auth0 sign-in was confirmed by the user during Gate A; Gate B browser gameplay used the fictional adapter, and Auth0 itself was not reauthenticated here. The 20-minute focus threshold and midnight behavior were tested through fixtures rather than waiting for real elapsed time. Phone layouts and system-wide reduced-motion switching were not exhaustively browser-tested; gait suppression has automated coverage.

Progress, friends and presence remain local/demo data. Authentication persistence redesign, onboarding, Greenhouse Worlds, Supabase, live multiplayer, shared authoritative energy and powerups are deliberately deferred. No backend packages, schemas or integrations were added.
