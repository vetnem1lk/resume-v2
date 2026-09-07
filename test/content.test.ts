// Invariants over the two content files: the CV copy survives intact, the three
// founder fixes are present, nothing banned leaked in, and both languages have the
// same shape so the render never diverges by language.
import { describe, expect, test } from 'vitest';
import { en } from '../src/content/en.ts';
import { ru } from '../src/content/ru.ts';
import { CV_FILES, PROFILES } from '../src/content/shared.ts';
import { SECTION_IDS, type SectionId } from '../src/content/types.ts';

const both = [en, ru];
const flat = (c: unknown) => JSON.stringify(c);

describe.each(both)('content $lang', (c) => {
  test('no em-dash anywhere', () => { expect(flat(c)).not.toMatch(/\u2014/); });
  test('no phone number, no hh, no salary', () => {
    expect(flat(c)).not.toMatch(/\+7[ (-]*9\d{2}[ )-]*\d{3}[ -]*\d{2}[ -]*\d{2}|hh\.ru|salary|зарплат/i);
  });
  test('no percentage in the Sed-Pro entry', () => { expect(flat(c.jobs[0])).not.toMatch(/%/); });
  test('eight sections labelled', () => {
    for (const id of SECTION_IDS) expect(c.ui.nav[id]).toBeTruthy();
    // slice() widens the readonly tuple back to the full union; the tail is exactly the
    // keys of ui.sections, so name that instead of branching around the expect.
    for (const id of SECTION_IDS.slice(1) as Exclude<SectionId, 'top'>[]) expect(c.ui.sections[id]).toBeTruthy();
  });
  test('three projects, two jobs, four achievements, four certificates', () => {
    expect(c.projects).toHaveLength(3);
    expect(c.jobs).toHaveLength(2);
    expect(c.achievements).toHaveLength(4);
    expect(c.education.certs.items).toHaveLength(4);
  });
});

test('same shape in both languages', () => {
  expect(ru.jobs.map((j) => j.bullets.length)).toEqual(en.jobs.map((j) => j.bullets.length));
  expect(ru.projects.map((p) => p.bullets.length)).toEqual(en.projects.map((p) => p.bullets.length));
  expect(ru.skills.map((s) => s.hi)).toEqual(en.skills.map((s) => s.hi));
  expect(ru.header.meta).toHaveLength(en.header.meta.length);
});

test('fix 1: the FCC paper is co-authored', () => {
  expect(en.achievements[2].title).toMatch(/^Co-authored paper/);
  expect(ru.achievements[2].title).toMatch(/^Статья в соавторстве/);
});
test('fix 2: EN Sed-Pro sub-line mirrors RU (separate software company, bureau = main user)', () => {
  expect(en.jobs[0].sub).toBe('Software development for the design industry; the platform\'s main user is the architecture & engineering bureau Investproekt.');
  expect(en.jobs[0].sub).not.toMatch(/division/i);
});
test('fix 3: EN skills gain OOP, order mirrors RU', () => {
  expect(en.skills.map((s) => s.label)).toEqual(['C++17/20', 'Qt', 'OpenGL', 'EASTL', 'raylib', 'CMake', 'STL', 'Boost', 'SQL', 'Git', 'OOP', 'Data structures & algorithms', 'Unreal Engine']);
  expect(ru.skills.map((s) => s.label)).toEqual(['C++17/20', 'Qt', 'OpenGL', 'EASTL', 'raylib', 'CMake', 'STL', 'Boost', 'SQL', 'Git', 'ООП', 'Алгоритмы и структуры данных', 'Unreal Engine']);
});

test('lens test 4: literal keywords present in EN', () => {
  const text = flat(en);
  for (const k of ['C++17/20', 'Qt Widgets', 'QML', 'OpenGL', 'CMake', 'Unreal Engine', 'glTF', 'MySQL', 'Git', 'WebSocket']) expect(text).toContain(k);
});

test('lens test 5: one ownership clause per project', () => {
  expect(en.projects[0].tagline).toContain('solo');
  expect(en.projects[2].tagline).toContain('solo');
  expect(ru.projects[0].tagline).toContain('соло');
  expect(ru.projects[2].tagline).toContain('соло');
});

test('shared facts', () => {
  expect(CV_FILES.map((f) => f.file)).toEqual([
    '/cv/Klimentev_Vladislav_CPP_Developer_EN.pdf',
    '/cv/Klimentev_Vladislav_CPP_Developer_RU.pdf',
    '/cv/Klimentev_Vladislav_CPP_Developer_EN_ATS.pdf',
    '/cv/Klimentev_Vladislav_CPP_Developer_RU_ATS.pdf',
  ]);
  expect(PROFILES.vk).toBe('https://vk.ru/vetnem1lk');
  expect(PROFILES.telegram).toBe('https://t.me/cryzoth');
  expect(PROFILES.github).toBe('https://github.com/vetnem1lk');
  expect(PROFILES.email).toBe('mailto:klimentev.vlad@gmail.com');
  expect(PROFILES.v1).toBe('https://me.cryzothic.tech');
  expect(en.contact.card).toBe('Vlad Klimentev C++/Qt');
  expect(ru.contact.card).toBe('Vlad Klimentev C++/Qt');
});
