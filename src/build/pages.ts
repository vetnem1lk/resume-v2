// Vite plugin: fills the page shells from the content files, in dev and in build.
// The language is the path: /ru/... renders Russian, everything else English.
// Both documents therefore ship as complete static HTML - no copy in JS.
import type { Plugin } from 'vite';
import { en } from '../content/en.ts';
import { ru } from '../content/ru.ts';
import { renderBody, renderHead } from '../dom/render.ts';

export function resumePages(): Plugin {
  return {
    name: 'resume-pages',
    transformIndexHtml: {
      order: 'pre',
      // dev: once per served HTML request, ctx.path = the rewritten URL ('/ru/index.html');
      // build: once per input, ctx = { path, filename } only (a 'pre' hook sees no bundle).
      handler(html, ctx) {
        const c = ctx.path.startsWith('/ru/') ? ru : en;
        const fill = (src: string, marker: string, value: string) => {
          if (!src.includes(marker)) throw new Error(`resume-pages: ${ctx.path} has no ${marker}`);
          // Function replacer: a string replacement expands $& and $' inside the rendered HTML.
          return src.replace(marker, () => value);
        };
        const withLang = fill(html, '<html lang="en">', `<html lang="${c.lang}">`);
        return fill(fill(withLang, '<!--head-->', renderHead(c)), '<!--resume-->', renderBody(c));
      },
    },
  };
}
