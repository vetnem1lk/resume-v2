# resume.cryzothic.tech

Scroll-driven 3D resume of **Vladislav Klimentev** - C++/Qt developer moving into game
development (tools / gameplay track). The resume itself is plain HTML that works with
JavaScript disabled; the 3D scene on top of it is a progressive enhancement.

> Status: shipped so far - the zero-JS resume, the asset pipeline and the scroll rig;
> the three.js island is the next slice.
>
> Previous site, still live: https://me.cryzothic.tech

## What this repo is for

- **The document comes first.** Every section of the resume is real, selectable, printable
  text in `index.html`. The PDF is one click away from the first paint.
- **The scene is optional.** A vanilla three.js island loads after the document and drives a
  camera down a spiral around a game-ready character as you scroll. No WebGL, reduced motion,
  or a failed asset fetch all leave the resume intact.
- **The code is part of the portfolio.** Every source file opens with a short purpose
  header, modules stay small and single-purpose, and this README carries an annotated map
  of the repository so a reader can tell what lives where.

## Stack

- Vite 8 · TypeScript 6 · three.js r186 · vitest · oxlint
- No UI framework, no CSS framework, no scroll library: the page is one document with
  eight sections.

## Performance budget (binding)

- First-paint JavaScript <= 45 KB gzipped, containing no three.js
- Scene chunk loaded on demand; the 3D asset is fetched only after the document is readable,
  and on phones only on request
- LCP element is the heading or the poster, never the canvas; CLS < 0.05; INP < 200 ms
- Lighthouse >= 95 in every category for the document with JavaScript disabled
- `prefers-reduced-motion` respected: no camera motion, no autoplay

### Measured today

| entry JS | scene chunk | entry CSS | document EN / RU  | character GLB | poster (tall, 2x AVIF) |
| -------- | ----------- | --------- | ----------------- | ------------- | ---------------------- |
| 1 391 B  | 196 387 B   | 3 802 B   | 6 032 B / 6 789 B | 3 728 004 B   | 39 067 B               |

The scene chunk is the whole island: three.js, the GLTF / KTX2 / meshopt loaders, the renderer,
the character, the mirrored floor, the camera and the quality tier. The texture transcoder (a worker
script and its wasm, emitted as separate assets) is fetched by the worker only when the first texture
arrives and is not part of that figure.

The first four are gzip level 9 over the built file (`zlib.gzipSync(buf, { level: 9 }).length`),
never the build log's column; `budget.json` carries each one rounded up to the next kibibyte
above measured + 15 %, and `npm run gate` fails the build the moment a number passes it. The
character is not part of the build: its column is the brotli sidecar the host serves (4 081 816 B
on disk, 49 371 triangles and 17 embedded textures), measured by the assemble step. The poster is
the file the desktop `<picture>` serves at 2x, bytes on disk as `pipeline:poster` wrote it next to
the character it was captured from.

## Repository map

```
resume-v2/
  index.html                 # page shell (EN); the resume body is rendered into it by src/build/pages.ts
  ru/index.html              # identical shell; the plugin keys the language off the path (test pins identity)
  package.json               # scripts: dev, build, preview, test, lint, typecheck, gate, smoke, pipeline:*
  package-lock.json
  tsconfig.json              # one project: src, test, scripts/pipeline, vite.config.ts
  vite.config.ts             # plugin registration, MPA input, assetsInlineLimit, vitest include
  .gitignore                 # build output plus the mesh, scene and texture-container extensions of the licensed
                             # asset; images anywhere outside tools/ are caught by test/repo.test.ts instead
  .oxlintrc.json
  budget.json                # gz9 byte gates read by scripts/budget.mjs
  README.md                  # repository map + budget + gates
  public/
    cv/Klimentev_Vladislav_CPP_Developer_{EN,RU}{,_ATS}.pdf   # the four CV files, bytes pinned by a test
    favicon.svg              # "VK" monogram in oxide on paper
    robots.txt
  src/
    main.ts                  # progressive enhancement entry: ?lang= redirect, active pill, the gated island
                             # import() with one late-mount retry, dev-only ?debug overlay import
    content/types.ts         # Content shape + SECTION_IDS
    content/shared.ts        # language-independent facts: CV files + bytes, profile URLs, origin
    content/en.ts  content/ru.ts
    dom/render.ts            # Content -> { head, body } HTML strings, escaped; the static art-directed poster picture;
                             # data-anchor on sections, data-beat on clickables, external links in a new tab
    dom/icons.ts             # inline SVG sprite: vk, telegram, github, gmail (simple-icons), download (Phosphor)
    dom/pills.ts             # IntersectionObserver -> aria-current on the anchor nav; pure helper mostVisible()
    scene/gate.ts            # whether this page gets the scene at all: breakpoint, WebGL2, data saver - pure
    scene/boot.ts            # the entry decision with the chunk loader injected: one attempt, never a rejection;
                             # readEnv() is the one impure line of the gate
    scene/loadstate.ts       # the loader as a pure state machine: bytes, parse, compile, two warm frames, then the
                             # poster gives way; the 92 % hold, and a failure from any phase that keeps the poster
    scene/assets.ts          # the served runtime subset by its public versioned path, and the decoded byte counts
                             # the progress bar counts against; the tier-2 swap table
    scene/pchip.ts           # monotone cubic (PCHIP) interpolation for the camera anchor table;
                             # sanitizeKeys for live-measured keys
    scene/spiral.ts          # closed-form camera spiral: u -> position and look target, section keys land exactly (D4)
    scene/sections.ts        # ANCHOR_Y per section, the measured scroll keys (landing / centre rule), the DOM read;
                             # the reference keys the camera falls back to when the measurement collapses
    scene/letterform.ts      # parallax pose of the hatched mark (turn, rise, zoom) - pure;
                             # letterformVars() are the CSS custom properties doc.css composes into the transform
    scroll/progress.ts       # scroll progress, camera-settle detection and damping - pure
    scroll/driver.ts         # rAF driver: reads scrollY first, dirty-flag layout, snap on hashchange, visibility resync;
                             # loop: false and the measure moment hand the stepping to a scene loop
    scroll/media.ts          # reduced-motion and fine-pointer queries
    beat/bus.ts              # BEATS vocabulary, Beat, BeatBus (one EventTarget, one event type), the page bus
    beat/clicks.ts           # click delegation: plain-activation filter, the 600 ms hold with a synthetic-click replay
    beat/scroll.ts           # scroll beats from raw u: arrivals both ways, teleport, edges with hysteresis, fling - pure
    island/island.ts         # the scene island, lazily imported behind the gate: mounts the renderer on the stage,
                             # streams the character in, runs the one loop (scroll rig, idle, beats, render, the
                             # quality tier once the scene is live and the tab is on screen), unmounts
    island/character.ts      # the parsed character made ready: coverage-tested cut-outs, the idle action, the blink
                             # through the morph dictionary, the reduced-motion freeze (seek first, then pause)
    island/floor.ts          # the mirrored floor: detached-bind twins sharing skeleton, geometry, morph weights and
                             # material names (the quality tier swaps their textures with the original's), unlit and
                             # faded with depth below the floor, plus the contact-shadow quad
    island/camera.ts         # the spiral camera: the strip-x view offset and its parser (pure), the stage read,
                             # the per-frame pose on the spiral
    island/loaders.ts        # the page-lifetime loader stack: the KTX2 worker pool and transcoder, the streamed
                             # fetch that reports real bytes, and the parsed character every mount re-uses
    island/renderer.ts       # the WebGL2 probe and the tier, exact device-pixel sizing, the renderer + lit scene +
                             # camera handle: environment deferred behind rAF -> setTimeout, context-loss rebuild, teardown
    island/lights.ts         # the paper look: RoomEnvironment PMREM at 128, hemisphere fill, warm key, cool rim;
                             # every chosen value in LIGHTS, overridable per mount for the taste round
    island/patch.ts          # one GLSL patch helper: per-key slots composed in order, a joined program key, owned
                             # uniforms re-bound on every recompile; applied after any clone
    island/poster.ts         # the stage class that cross-fades the poster out under the live canvas; the column's
                             # crop rectangle (pure) and the dev-only capture of the frame on screen for pipeline:poster
    island/tiers.ts          # the desktop quality tier: the KTX2 files fetched outside the GLB and adopted one per
                             # frame once the scene is live, the sampler state carried over, the texture they
                             # replace disposed once every holder of it points at the new one
    debug/overlay.ts         # ?debug overlay (dev server only): measured section keys, the camera spiral;
                             # the scroll driver, the letterform parallax and the beat log drawn over the page
    build/pages.ts           # Vite plugin resumePages(): fills the shells per language (dev + build)
    build/assets.ts          # Vite plugin assetHost(): serves the licensed subset from outside the repo at
                             # /g2/ in dev and preview, immutable header and brotli sidecars (never in build)
    styles/tokens.css        # design tokens, font imports, fallback-font metrics
    styles/doc.css           # layout, typography, stage (letterform / contour / light strip / poster and the canvas
                             # it cross-fades to, opacity only), pills, print;
                             # the letterform transform composes the rig's custom properties, identity without JS
    pipeline/inventory.ts    # Blender inventory JSON -> object rows, module-set totals, morph ranking, markdown
    pipeline/morphs.ts       # the ARKit-52 vocabulary, the keep-list tiers the morph budget is priced at, the shipped 24
    pipeline/vram.ts         # exact morph-texture VRAM: the RGBA32F row wrap the naive verts*slots*16*N misses
    pipeline/ktx.ts          # KTX2 encode recipes per texture class and per tier, the texture plan, the two
                             # tier picks and their file names, the BC7 resident-bytes formula, the manifest row
    pipeline/glb.ts          # gltf-transform accounting of a GLB: decoded bytes per mesh/morph/clip next to the
                             # on-disk size, the JSON/BIN chunk split and the brotli-11 transfer size
    pipeline/look.ts         # the production material table: which texture key feeds which slot of which exported
                             # material, and the alpha, face and metal rules the FBX import gets wrong
    pipeline/band.ts         # the mobile band's head-and-shoulders window inside the captured poster column: a share
                             # of the column around the head's own centre, never of the figure the viewport cuts off
  scripts/
    precompress.mjs          # brotli sidecars for every compressible file in dist/
    budget.mjs               # gz9 gates over dist/: entry, the lazy scene chunk, orphan walk, source purity,
                             # both documents, recruiter gate
    smoke.mjs                # every reachable URL answers with the right type, and the served character
                             # subset answers a HEAD with its media type and an immutable cache header
    nojs.mjs                 # writes dist-nojs/ = dist/ with every <script> removed (the Lighthouse "JS disabled" target)
    pipeline/paths.ts        # tool and raw-data locations, every one overridable through the environment
    pipeline/run-blender.ts  # one headless Blender job; hands back the job's sentinel line
    pipeline/run-ue.ts       # one headless UE python job; trusts its S2_RESULT line and the files it wrote
    pipeline/inventory.ts    # measures the whole FBX package, writes the per-file JSONs plus inventory.json/.md
    pipeline/face-proof.ts   # face proof end to end: the UE export, the two Blender jobs, the GLB copy for the viewer
    pipeline/textures.ts     # the used PNG set out of UE, resized and composited, every tier pick encoded,
                             # validated and cached by its arguments and input bytes, then both tiers priced
    pipeline/clips.ts        # measurement exports per morph tier plus the baked clips, priced into the tier-1 budget
    pipeline/clip-sources.ts # every clip's origin, licence, route onto the skeleton and measured facts; what may ship
    pipeline/ue-template.ts  # copies the engine mannequin example assets into the project, never overwriting
    pipeline/idle.ts         # the engine idle onto the character skeleton: backup, template copy, export, rig parity
    pipeline/assemble.ts     # the served subset end to end: the Blender assemble, the look and the tier-1 KTX2 files
                             # wired onto it, meshopt, validation, one immutable build directory and the pinned block
    pipeline/gltf.ts         # opens the gltf-transform packages inside the global CLI tree and declares their shapes
    pipeline/poster.ts       # the captured first frame into the poster set: the tall column and its head-and-shoulders
                             # band, AVIF + WebP at 1x and 2x with alpha; refuses a capture older than the character
    pipeline/manifest.ts     # one row per served file, bytes on disk and over the wire, brotli sidecar where it helps
    pipeline/blender/fbxlib.py       # shared Blender helpers: import, the look's export hygiene and glTF flag sets,
                                     # morph pruning, mesh stats, bound bones, shape-key deltas, GLB JSON
    pipeline/blender/inventory.py    # one fresh scene per FBX, one JSON per file, one sentinel line
    pipeline/blender/face_proof.py   # proves the shape-key f-curves survived the FBX, exports the GLB, writes the verdict
    pipeline/blender/measure.py      # GLB exports per morph tier and the name-keyed clip bake (the S2 measurement)
    pipeline/blender/assemble.py     # the shipped look: pruned to the shipped morphs, joined by material, the idle
                                     # baked rotation-only with a measured ground-contact offset, exported float32
    pipeline/blender/rig_parity.py   # rest-pose parity of a clip rig against the look rig, and the rotation-only bake
    pipeline/blender/llf_csv.py      # Live Link Face CSV -> shape-key f-curves, no add-on, with a synthetic self-test
    pipeline/ue/face_proof_synth.py  # synthetic ARKit clip on the idle, exported to FBX with its blend-shape curves
    pipeline/ue/export_textures.py   # the texture set of the shipped look out of UE at source resolution
    pipeline/ue/export_clips.py      # clips out of UE as bones-only FBX, parameterised per clip: the asset,
                                     # the preview mesh to pin and the compatible-skeleton mark it needs first,
                                     # which it saves only onto the backed-up skeleton the job names
  test/
    content.test.ts  render.test.ts  shell.test.ts  pdf.test.ts  icons.test.ts  pills.test.ts
    gate.test.ts             # every gate signal alone keeps the poster, and reduced motion is not one of them
    boot.test.ts             # a refused gate, a rejecting import and a throwing mount all leave the poster
    three-node.test.ts       # the pinned version pair and the rig's damping against three's own
    loadstate.test.ts        # the phase order, out-of-order events ignored, the hold, failure and the terminal states
    loaders.test.ts          # the byte stream against the pinned denominator, a 404 and an offline reload, the retry
    patch.test.ts            # the patch helper on a fake material: slot order, joined keys, a repeated key, a missing chunk
    camera.test.ts           # the view offset that lands the character's axis in the poster column, the strip-x parser
    poster.test.ts           # the poster's two crops: the column centred on strip-x and scaled by the ratio, and the
                             # band's head-and-shoulders window, which cuts the figure instead of containing it
    tiers.test.ts            # the tier pump on fake materials: the sampler copy, one adoption per tick, every holder
                             # of a shared texture swapped before it is disposed, a rejected entry skipped for good
    mirror.test.ts           # three under Node: a detached-bind twin reflects through the floor, an attached one does not
    assets.test.ts           # the asset host's path rule: the prefix, inside the root, the served types
    pchip.test.ts            # every key hit exactly, monotone with no overshoot, the clamps and the key sanitiser
    spiral.test.ts           # every key lands exactly, the orbit is monotone, both eye rules, the clamps and the lag
    sections.test.ts         # the anchor table, both key rules on a hand-written layout, the collapsed-section guard
    letterform.test.ts       # the identity at the top, the clamped ends, monotone turn and rise, the fixed-decimal vars
    progress.test.ts         # the clamps and the NaN guards, the settle hold, frame-rate-independent damping
    driver.test.ts           # the rAF loop under a fake window: the stepped mode, the measure moments,
                             # the rejected options and a throwing consumer
    bus.test.ts              # the closed vocabulary, named and wildcard delivery, signal unsubscribe, nesting order
    clicks.test.ts           # the click decisions without a DOM: plain activation, holdable links, the hold clamp
    scroll-beats.test.ts     # arrivals both ways, one arrival on a teleport, edge hysteresis, the fling window
    paths.test.ts            # path defaults and environment overrides
    clip-sources.test.ts     # the clip registry: unique ids, the shipped idle's measured facts, the refusals
    repo.test.ts             # the guard: no licensed binary is ever tracked by git
    inventory.test.ts        # the inventory summary arithmetic and the morph keep-list tiers
    vram.test.ts             # the morph VRAM formula, pinned at and past the maxTextureSize wrap
    ktx.test.ts              # the encode recipes: sRGB colour, assigned-linear data, zstd only on UASTC
    look.test.ts             # every exported material has a look, every slot a planned tier-1 key, cut-outs masked
    manifest.test.ts         # the wire size is the sidecar only where it shrinks the file, and the totals add up
    glb.test.ts              # the byte budget: the accounting arithmetic, the GLB chunk/transfer sizes, the table
    fixtures/inventory-mini.json  # two hand-written FBX reports, a combine plus a module, that inventory.test.ts
                             # pins the summary arithmetic against
  tools/                     # dev-server pages, never bundled and outside tsconfig: they may resolve bare `three`
                             # through node_modules; "three only under src/island/" is a rule about the bundle.
    tier1-proof.html         # render proof of the assembled character: plays the Idle off the asset host and reads
                             # draw calls, triangles, skins and morph targets back into window.__proof
    face-proof.html          # bare three.js viewer: plays the proof GLB and asserts the morph weights move;
                             # ?glb= opens any other export and falls back to its first clip when it has no
                             # weights track (the GLBs live in tools/assets/, gitignored with the rest of the asset)
```

## Gates

- `npm test` - unit tests: content invariants, render contract, PDF bytes, nav helper, the pure scroll rig
  (interpolant, spiral, section keys, letterform, progress, bus, clicks, beats) and the pipeline arithmetic
- `npm run lint` / `npm run typecheck`
- `npm run build` then `npm run gate` - gz9 byte budget from `budget.json` for the entry and the lazy scene chunk,
  entry and source purity (three.js only under `src/island/`), no orphan chunk, both documents present, and the
  recruiter gate in markup: name, role, one proof and a one-click CV button in each document
- `npm run nojs` then `npx vite preview --outDir dist-nojs` - the document with every script removed, the target of the Lighthouse >= 95 audit
- `npm run smoke -- http://localhost:4173 --local` - every reachable URL answers with the right type,
  and the served character subset answers a HEAD with its media type and an immutable cache header

## 3D character

The character is the "Mechanic Girl" model by IdaFaber (licensed content). The site ships
only an optimised runtime subset of it; the asset is not part of this repository and may not
be extracted or reused outside this site. Each build of that subset is one immutable directory
under `/g2/v2/<build>/` - the GLB, its brotli sidecar, the desktop texture swaps and a manifest -
so a new character can never invalidate a cached old one. The asset pipeline (FBX to glTF
optimisation, KTX2 textures, meshopt), the scroll choreography, the gaze rig and the loader are
my own work.

## Scroll rig

The camera is a read-only function of the document scroll. `src/scene/` holds the pure
mathematics (a monotone anchor interpolant, the closed-form spiral, the section anchor table
whose scroll keys are measured from the live layout), `src/scroll/` the frame driver (scroll
progress, camera settle, damping), and `src/beat/` the interaction bus that the character
subscribes to (clicks on `data-beat` anchors, with a bounded hold before external links open,
and scroll-derived beats). Every motion is a pure pose function of the frame; the page's
letterform, for instance, turns and rises with the camera through three CSS custom properties.
None of it imports three.js. In development, `/?debug` draws the whole rig over the page.
The scene island (`src/island/`) is the rig's production consumer: its one animation loop steps
the driver, the camera rides the spiral at the damped progress with a view offset that keeps the
character's axis in the poster column, the idle plays on a mirrored floor, and reduced motion
freezes the idle on a settled pose while the camera cuts instead of gliding.

## Asset pipeline

`scripts/pipeline/` turns the licensed FBX package into the optimised runtime subset. The
scripts run outside the site build and never write into the repository: Blender 5.2 does the
inventory, pruning and glTF export, Unreal Engine 5.8 exports textures and animation clips,
KTX-Software encodes textures, gltf-transform accounts the bytes. Tool locations are read from
the environment (`BLENDER`, `UE_CMD`, `UE_ENGINE`, `UE_PROJECT`, `KTX`, `MG_RAW`, `GLTF_MODULES`), with
defaults for standard installs. `npm run pipeline:inventory` measures the package;
`pipeline:face-proof` proves that facial animation curves survive the whole chain into a
`weights` track that three.js plays (`tools/face-proof.html`); `pipeline:textures` encodes both
texture tiers - the set the loader waits for, and the four desktop swaps that replace four of its
textures once the scene is live - and prices each tier over the wire and as resident BC7; `pipeline:clips`
produces the animation half of the byte budget the design decisions are made against;
`pipeline:idle` brings the engine idle onto the character skeleton - template copy, compatible
skeleton, bones-only export - and measures the rest-pose parity of the two rigs; `pipeline:assemble`
builds the served subset itself - the look joined by material, the morphs cut to the shipped list,
the idle baked onto the rig, the tier-1 textures embedded, meshopt compression, the glTF validator -
and prints the byte counts `src/scene/assets.ts` pins; `pipeline:poster` encodes the captured first
frame into the poster set the document references - the tall column and its head-and-shoulders band,
AVIF and WebP at 1x and 2x, with alpha - and refuses a capture older than the character it shows.

Textures, re-measured with the corrected mip recipe (clamped edges, one resampler end to end):
tier 1 is 3 392 136 B over the wire and 11 971 696 B resident once the GPU has it as BC7 - 8 393 B
(0.25 %) under the first encode of the same pick, which generated its small mips with the wrong
wrap and filter. The four tier-2 swaps cost 2 730 007 B more and take the resident set to
24 554 608 B: three 2K colour maps, plus the one ORM whose codec was measurably wrong at 1K. They
are fetched only after the scene is live and adopted one per frame, each replaced texture disposed
as the new one lands - the live texture count does not move while the tier arrives.
