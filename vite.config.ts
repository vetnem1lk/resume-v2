// Vite 8 + vitest 5 in one config: two HTML entries as the top-level `input`, no SPA
// fallback (a missing path must 404, not answer the English document), fonts never
// base64-inlined, no modulepreload polyfill (nothing is imported dynamically).
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import { resumePages } from './src/build/pages.ts';

const root = import.meta.dirname;

export default defineConfig({
  // Fills index.html and ru/index.html from src/content, in dev and in build.
  plugins: [resumePages()],
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
    // The only dynamic import is the debug overlay behind `import.meta.env.DEV`, which is replaced
    // by `false` at build time: no chunk is emitted and the entry carries no preload helper. Keep
    // the polyfill off when S4 adds a real island: measured, `{ polyfill: true }` costs more
    // entry bytes than `{ polyfill: false }`, not fewer.
    modulePreload: { polyfill: false },
  },
  test: { include: ['test/**/*.test.ts'] },
});
