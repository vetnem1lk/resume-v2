// The two shells are byte-identical and carry the two markers exactly once; the
// pages plugin turns them into the EN and RU documents by path.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { resumePages } from '../src/build/pages.ts';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const shell = read('index.html');

test('ru/index.html is a copy of index.html', () => {
  expect(read('ru/index.html')).toBe(shell);
});
test('markers present once', () => {
  expect(shell.match(/<!--head-->/g)).toHaveLength(1);
  expect(shell.match(/<!--resume-->/g)).toHaveLength(1);
  expect(shell).toContain('<html lang="en">');
});
test('plugin renders per path', () => {
  const hook = resumePages().transformIndexHtml as { handler: (html: string, ctx: { path: string }) => string };
  const enPage = hook.handler(shell, { path: '/index.html' });
  const ruPage = hook.handler(shell, { path: '/ru/index.html' });
  expect(enPage).toContain('<html lang="en">');
  expect(enPage).toContain('Vladislav Klimentev');
  expect(ruPage).toContain('<html lang="ru">');
  expect(ruPage).toContain('Климентьев Владислав');
  expect(enPage).not.toContain('<!--resume-->');
  expect(ruPage).not.toContain('<!--head-->');
});
