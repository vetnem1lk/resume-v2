// Vite 8 + vitest 5 in one config: two HTML entries as the top-level `input`, no SPA
// fallback (a missing path must 404, not answer the English document), fonts never
// base64-inlined, no modulepreload polyfill (the scene chunk needs none).
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import { assetHost } from './src/build/assets.ts';
import { resumePages } from './src/build/pages.ts';

const root = import.meta.dirname;

export default defineConfig({
  // Fills index.html and ru/index.html from src/content, in dev and in build; serves the licensed
  // subset from outside the repository in dev and preview only.
  plugins: [resumePages(), assetHost()],
  // Vite 8: the top-level `input` feeds dev, build and optimizeDeps; build.rollupOptions
  // is deprecated. Keys are ignored for HTML; the path relative to root decides the
  // output, so this yields dist/index.html and dist/ru/index.html.
  input: {
    main: resolve(root, 'index.html'),
    ru: resolve(root, 'ru/index.html'),
  },
  // 'mpa' keeps the HTML middlewares and drops the SPA fallback: /robots.txt and a typo
  // like /ru answer 404 instead of the English page (Lighthouse's robots-txt audit
  // otherwise parses the fallback document as robots.txt and scores 0).
  appType: 'mpa',
  build: {
    // The only assets are the woff2 subsets. Vite's default 4096 would base64-inline the
    // two cyrillic-ext files (2 028 B and 2 264 B) into the render-blocking stylesheet
    // and defeat unicode-range for every visitor. 0 = never inline anything.
    assetsInlineLimit: 0,
    // The island is the first production dynamic import, so Vite's preload helper now ships in the
    // entry (measured: the whole gated entry is 1 381 B gz9). Keep the polyfill OFF: `{ polyfill:
    // true }` costs more bytes, `modulePreload: false` is byte-identical, and no modulepreload link
    // is emitted for a lazy chunk anyway. No chunk group either: a named group that contains a
    // nested import() pulls the helper into the group and the document loads the scene eagerly.
    modulePreload: { polyfill: false },
    // The scene chunk is ~725 KB raw by construction (three + loaders); the 500 kB notice is noise.
    chunkSizeWarningLimit: 800,
  },
  test: { include: ['test/**/*.test.ts'] },
});
