# Sproutbound art assets

Created with the built-in image generation tool using the user-supplied `Map to look like.jpeg` as the reference. No external API or API key is needed by the game.

- `greenhouse-room.png`: Preserve the exact reference composition, pixel-art style, glasshouse, water, boat, bookshelves, vines, and lantern light. Remove HUD, people, companion, central garden, and four study stations; fill removals with wooden flooring.
- `garden-stages.png`: Transparent 2×2 atlas of the same isometric circular stone garden in Seed, Sprout, Bloom, and Sanctuary stages, matching the reference’s pixel textures and magical light. No environment or people.
- `study-and-companions.png`: Transparent 2×2 atlas: two mirrored wooden study desks with books, lanterns, and stools; cream-white two-leaf companion; evolved gardening companion. Match reference style, isolated objects.
- `gardeners.png`: Transparent 4×2 atlas of four chibi pixel-art gardeners, standing above and reading below; teal/brown-haired, rose/curly-haired, lavender/witch-hat, ochre/apron silhouettes. Full bodies, separate cells, no environment.

These prompts are the production briefs used for the four built-in calls. The app renders atlas frames separately, performs avatar palette customization at runtime, and keeps game progress and interactions independent of the background artwork.

## Cozy study room

`cozy-study-room.png` was created with built-in image generation from the user's study-screen reference. Prompt: Preserve the warm pixel-art cabin, exact camera perspective, sunny windows, trailing plants, desk with laptop and notebooks, bookshelf, sleeping cat, rug, floor books, and honey afternoon light. Remove the title sign, navigation, subject panel, flashcard, chores, timer, speech bubble, and mascot; fill those areas seamlessly with the room. Keep the center quiet for a separate parchment interface. No text or UI. Landscape 16:9.

All study UI is live HTML: the subject cabinet, flashcards, lesson journey, stats, automatic chores, settings, and persistent focus timer.
## Generated loading and animation assets

Run `npm run assets:generate` after editing the source atlases, `src/lib/sproutling-run.ts`, or `src/lib/sprite-hover.ts`.

- `sproutling-run.png` contains twelve prebuilt running poses for each of the two growth stages. The evolved form uses a stronger, hip-anchored stride that remains visible at the in-game size.
- `desk-hover.png` and `src/lib/scene-assets.json` store the matching hover silhouettes and atlas coordinates.
- The `.webp` files are optimized delivery copies. Character and prop atlases use lossless encoding to preserve alpha hit testing and palette masks; room backgrounds and garden artwork use quality 90.

Keep the generated files with the source changes. The browser loads these assets directly instead of rebuilding sproutling frames and desk outlines at startup. Custom avatar colors are applied once per pose, and only the local player's stride frames are prepared after the scene can paint.
