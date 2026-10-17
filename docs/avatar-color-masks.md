# Editing avatar color masks

The source artwork is public/assets/gardeners.png. It has four 384-pixel-wide columns:
0 = tousled gardener, 1 = glasses, 2 = witch, 3 = bun.
Standing cells occupy y=0..537; reading cells start at atlas y=538.

Edit src/lib/avatar-hair.ts:
- standing / reading: polygons where hair recoloring is allowed.
- facesStanding / facesReading: face outlines that always exclude hair tint.
- faceProtection: extra exclusion polygons for difficult forehead or ear edges.
- ribbonStanding / ribbonReading: bun ribbon and bow exclusions; these preserve the original fabric colors.
- FACE_EDGE_PADDING: safety margin around protected face outlines (six pixels).

Each polygon is a flat list [x1,y1,x2,y2,...] in cell-local pixels.
For the reading row, subtract 538 from the atlas y coordinate. Subtract
384 times the column index from atlas x. Add a polygon under the relevant
faceProtection character and pose to protect a patch from hair tint.
Protection takes priority over every hair polygon.

src/lib/avatar-palette.ts preserves ribbon pixels first, then applies skin, hair and outfit colors.
The witch cheek and ear are separate protected shapes so the lock between them stays hair.
The hairPixel function uses a separate luminance baseline for each character and blends highlights toward white to prevent clipping.
src/lib/sprite-assets.ts applies the masks to previews, portraits, standing,
reading and walking frames. Reload the page after edits to clear sprite caches.
Use cyan or magenta hair to make accidental face recoloring easy to see.
