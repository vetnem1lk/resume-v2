# resume.cryzothic.tech

Scroll-driven 3D resume of **Vladislav Klimentev** - C++/Qt developer moving into game
development (tools / gameplay track). The resume itself is plain HTML that works with
JavaScript disabled; the 3D scene on top of it is a progressive enhancement.

> Status: first slice shipped: the zero-JS resume.
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

- Vite 8 · TypeScript 6 · three.js r185 · vitest · oxlint
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

| entry JS | entry CSS | document |
| -------- | --------- | -------- |
| 437 B    | 3 669 B   | 5 690 B  |

Every number is gzip level 9 over the built file (`zlib.gzipSync(buf, { level: 9 }).length`),
never the build log's column; `budget.json` carries each one rounded up to the next kibibyte
above measured + 15 %, and `npm run gate` fails the build the moment a number passes it.

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
    main.ts                  # progressive enhancement entry: ?lang= redirect, active pill
    content/types.ts         # Content shape + SECTION_IDS
    content/shared.ts        # language-independent facts: CV files + bytes, profile URLs, origin
    content/en.ts  content/ru.ts
    dom/render.ts            # Content -> { head, body } HTML strings, escaped
    dom/icons.ts             # inline SVG sprite: vk, telegram, github, gmail (simple-icons), download (Phosphor)
    dom/pills.ts             # IntersectionObserver -> aria-current on the anchor nav; pure helper mostVisible()
    scene/pchip.ts           # monotone cubic (PCHIP) interpolation for the camera anchor table;
                             # sanitizeKeys for live-measured keys
    scene/spiral.ts          # closed-form camera spiral: u -> position and look target, section keys land exactly (D4)
    build/pages.ts           # Vite plugin resumePages(): fills the shells per language (dev + build)
    styles/tokens.css        # design tokens, font imports, fallback-font metrics
    styles/doc.css           # layout, typography, stage (letterform / contour / light strip / poster), pills, print
    pipeline/inventory.ts    # Blender inventory JSON -> object rows, module-set totals, morph ranking, markdown
    pipeline/morphs.ts       # the ARKit-52 vocabulary and the keep-list tiers the morph budget is priced at
    pipeline/vram.ts         # exact morph-texture VRAM: the RGBA32F row wrap the naive verts*slots*16*N misses
    pipeline/ktx.ts          # KTX2 encode recipe per texture class, the texture plan and the tier-1 pick
    pipeline/glb.ts          # gltf-transform accounting of a GLB: decoded bytes per mesh/morph/clip next to the
                             # on-disk size, the JSON/BIN chunk split and the brotli-11 transfer size
  scripts/
    precompress.mjs          # brotli sidecars for every compressible file in dist/
    budget.mjs               # gz9 gates over dist/, entry purity, no inlined fonts, RU document, recruiter gate
    smoke.mjs                # every reachable URL answers with the right type
    nojs.mjs                 # writes dist-nojs/ = dist/ with every <script> removed (the Lighthouse "JS disabled" target)
    pipeline/paths.ts        # tool and raw-data locations, every one overridable through the environment
    pipeline/run-blender.ts  # one headless Blender job; hands back the job's S2_ sentinel line
    pipeline/run-ue.ts       # one headless UE python job; trusts its S2_RESULT line and the files it wrote
    pipeline/inventory.ts    # measures the whole FBX package, writes the per-file JSONs plus inventory.json/.md
    pipeline/face-proof.ts   # face proof end to end: the UE export, the two Blender jobs, the GLB copy for the viewer
    pipeline/textures.ts     # the used PNG set out of UE, resized and composited, encoded and validated, then priced
    pipeline/clips.ts        # measurement exports per morph tier plus the baked clips, priced into the tier-1 budget
    pipeline/blender/fbxlib.py       # shared Blender helpers: import, mesh stats, bound bones, shape-key deltas, GLB JSON
    pipeline/blender/inventory.py    # one fresh scene per FBX, one JSON per file, one sentinel line
    pipeline/blender/face_proof.py   # proves the shape-key f-curves survived the FBX, exports the GLB, writes the verdict
    pipeline/blender/measure.py      # export hygiene, morph pruning per tier, GLB exports and the name-keyed clip bake
    pipeline/blender/llf_csv.py      # Live Link Face CSV -> shape-key f-curves, no add-on, with a synthetic self-test
    pipeline/ue/face_proof_synth.py  # synthetic ARKit clip on the idle, exported to FBX with its blend-shape curves
    pipeline/ue/export_textures.py   # the texture set of the shipped look out of UE at source resolution
    pipeline/ue/export_clips.py      # the pack's body clips out of UE as bones-only FBX, one per clip
  test/
    content.test.ts  render.test.ts  shell.test.ts  pdf.test.ts  icons.test.ts  pills.test.ts
    pchip.test.ts            # every key hit exactly, monotone with no overshoot, the clamps and the key sanitiser
    spiral.test.ts           # every key lands exactly, the orbit is monotone, both eye rules, the clamps and the lag
    paths.test.ts            # path defaults and environment overrides
    repo.test.ts             # the guard: no licensed binary is ever tracked by git
    inventory.test.ts        # the inventory summary arithmetic and the morph keep-list tiers
    vram.test.ts             # the morph VRAM formula, pinned at and past the maxTextureSize wrap
    ktx.test.ts              # the encode recipes: sRGB colour, assigned-linear data, zstd only on UASTC
    glb.test.ts              # the byte budget: the accounting arithmetic, the GLB chunk/transfer sizes, the table
    fixtures/inventory-mini.json  # two hand-written FBX reports, a combine plus a module, that inventory.test.ts
                             # pins the summary arithmetic against
  tools/
    face-proof.html          # bare three.js viewer: plays the proof GLB and asserts the morph weights move;
                             # ?glb= opens any other export and falls back to its first clip when it has no
                             # weights track (the GLBs live in tools/assets/, gitignored with the rest of the asset)
```

## Gates

- `npm test` - unit tests (content invariants, render contract, PDF bytes, nav helper)
- `npm run lint` / `npm run typecheck`
- `npm run build` then `npm run gate` - gz9 byte budget from `budget.json`, entry purity, both documents present,
  and the recruiter gate in markup: name, role, one proof and a one-click CV button in each document
- `npm run nojs` then `npx vite preview --outDir dist-nojs` - the document with every script removed, the target of the Lighthouse >= 95 audit
- `npm run smoke -- http://localhost:4173 --local` - every reachable URL answers with the right type

## 3D character

The character is the "Mechanic Girl" model by IdaFaber (licensed content). The site ships
only an optimised runtime subset of it; the asset is not part of this repository and may not
be extracted or reused outside this site. The asset pipeline (FBX to glTF optimisation,
KTX2 textures, meshopt), the scroll choreography, the gaze rig and the loader are my own work.

## Asset pipeline

`scripts/pipeline/` turns the licensed FBX package into the optimised runtime subset. The
scripts run outside the site build and never write into the repository: Blender 5.2 does the
inventory, pruning and glTF export, Unreal Engine 5.8 exports textures and animation clips,
KTX-Software encodes textures, gltf-transform accounts the bytes. Tool locations are read from
the environment (`BLENDER`, `UE_CMD`, `UE_PROJECT`, `KTX`, `MG_RAW`, `GLTF_MODULES`), with
defaults for standard installs. `npm run pipeline:inventory` measures the package;
`pipeline:face-proof` proves that facial animation curves survive the whole chain into a
`weights` track that three.js plays (`tools/face-proof.html`); `pipeline:textures` and
`pipeline:clips` produce the byte budget the design decisions are made against.
