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
| 437 B    | 3 674 B   | 5 581 B  |

Every number is gzip level 9 over the built file (`zlib.gzipSync(buf, { level: 9 }).length`),
never the build log's column; `budget.json` carries each one rounded up to the next kibibyte
above measured + 15 %, and `npm run gate` fails the build the moment a number passes it.

## Repository map

```
resume-v2/
  index.html                 # page shell (EN); the resume body is rendered into it by src/build/pages.ts
  ru/index.html              # identical shell; the plugin keys the language off the path (test pins identity)
  package.json               # scripts: dev, build, preview, test, lint, typecheck, gate, smoke
  package-lock.json
  tsconfig.json              # one project: src, test, vite.config.ts
  vite.config.ts             # plugin registration, MPA input, assetsInlineLimit, vitest include
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
    build/pages.ts           # Vite plugin resumePages(): fills the shells per language (dev + build)
    styles/tokens.css        # design tokens, font imports, fallback-font metrics
    styles/doc.css           # layout, typography, stage (letterform / contour / light strip / poster), pills, print
  scripts/
    precompress.mjs          # brotli sidecars for every compressible file in dist/
    budget.mjs               # gz9 gates over dist/, entry purity, no inlined fonts, RU document present
    smoke.mjs                # every reachable URL answers with the right type
    nojs.mjs                 # writes dist-nojs/ = dist/ with every <script> removed (the Lighthouse "JS disabled" target)
  test/
    content.test.ts  render.test.ts  shell.test.ts  pdf.test.ts  icons.test.ts  pills.test.ts
```

## Gates

- `npm test` - unit tests (content invariants, render contract, PDF bytes, nav helper)
- `npm run lint` / `npm run typecheck`
- `npm run build` then `npm run gate` - gz9 byte budget from `budget.json`, entry purity, both documents present
- `npm run nojs` then `npx vite preview --outDir dist-nojs` - the document with every script removed, the target of the Lighthouse >= 95 audit
- `npm run smoke -- http://localhost:4173 --local` - every reachable URL answers with the right type

## 3D character

The character is the "Mechanic Girl" model by IdaFaber (licensed content). The site ships
only an optimised runtime subset of it; the asset is not part of this repository and may not
be extracted or reused outside this site. The asset pipeline (FBX to glTF optimisation,
KTX2 textures, meshopt), the scroll choreography, the gaze rig and the loader are my own work.
