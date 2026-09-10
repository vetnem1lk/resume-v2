// Turns one language of the resume into HTML strings: the language-specific <head>
// tags and the whole <body>. Pure string building, no DOM, so it runs in the build
// plugin and in tests alike. Every dynamic value passes through escape().
import { CV_FILES, ORIGIN, PROFILES } from '../content/shared.ts';
import type { Achievement, Content, Job, Link, Project, SectionId } from '../content/types.ts';
import { SECTION_IDS } from '../content/types.ts';
import type { IconId } from './icons.ts';
import { renderSprite } from './icons.ts';
import { ANCHOR_Y } from '../scene/sections.ts';

export function escape(s: string): string {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}
const e = escape;

const path = (c: Content) => (c.lang === 'ru' ? '/ru/' : '/');

export function renderHead(c: Content): string {
  const url = ORIGIN + path(c);
  return [
    `<title>${e(c.meta.title)}</title>`,
    `<meta name="description" content="${e(c.meta.description)}" />`,
    `<meta name="theme-color" content="#F4F1EA" />`,
    `<link rel="icon" href="/favicon.svg" type="image/svg+xml" />`,
    `<link rel="canonical" href="${url}" />`,
    `<link rel="alternate" hreflang="en" href="${ORIGIN}/" />`,
    `<link rel="alternate" hreflang="ru" href="${ORIGIN}/ru/" />`,
    `<link rel="alternate" hreflang="x-default" href="${ORIGIN}/" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:title" content="${e(c.meta.title)}" />`,
    `<meta property="og:description" content="${e(c.meta.description)}" />`,
    `<meta property="og:locale" content="${c.lang === 'ru' ? 'ru_RU' : 'en_US'}" />`,
    `<meta property="og:locale:alternate" content="${c.lang === 'ru' ? 'en_US' : 'ru_RU'}" />`,
  ].join('\n    ');
}

const icon = (id: IconId) => `<svg class="icon" width="20" height="20" aria-hidden="true"><use href="#i-${id}"></use></svg>`;
const link = (l: Link) => `<a href="${e(l.href)}">${e(l.label)}</a>`;
const visualCv = (c: Content) => CV_FILES.find((f) => f.key === c.lang)!;

function strip(c: Content): string {
  return `<header class="strip">
  <p class="strip__who"><span class="strip__name">${e(c.header.name)}</span> <span class="strip__role">${e(c.header.role)}</span></p>
  <p class="strip__quick">
    <a class="cv-button" href="${visualCv(c).file}" download>${icon('download')}<span>${e(c.ui.cvButton)}</span></a>
    <a class="icon-link" rel="me" href="${PROFILES.telegram}">${icon('telegram')}<span>${e(c.ui.icons.telegram)}</span></a>
    <a class="icon-link" rel="me" href="${PROFILES.github}">${icon('github')}<span>${e(c.ui.icons.github)}</span></a>
    <a class="icon-link" href="${PROFILES.email}">${icon('gmail')}<span>${e(c.ui.icons.email)}</span></a>
    <a class="lang" href="${c.ui.lang.href}" hreflang="${c.ui.lang.hreflang}" lang="${c.ui.lang.hreflang}" title="${e(c.ui.lang.title)}">${e(c.ui.lang.label)}</a>
  </p>
</header>`;
}

// The scene layer. Static in S1: the letterform, the contour field, the light strip and
// the reserved poster box the character will later occupy. aria-hidden: pure decoration.
// It sits after the header block inside <main>, not before it: on a phone it is a poster
// in flow, and ahead of the document it filled the whole first screen with decoration,
// leaving the name and role to the strip alone. Fixed on wide screens, where document
// order does not reach the layout.
// Every section carries `data-anchor`, the body height the camera frames there (design SSoT
// D4); the scroll keys themselves are measured at runtime, never written into the markup.
// Paint (fill, stroke, colour) is applied from doc.css: var() inside an SVG presentation
// attribute is not guaranteed to resolve, CSS rules are, and CSS beats the attribute.
// The letterform is an outline, not live <text>: Chrome records SVG text as a
// largest-contentful-paint candidate even inside a <mask> or a <clipPath> (measured), so
// as <text> this aria-hidden watermark took the LCP the spec pins to the H1, and the
// page's largest paint waited on the display face. As a <path> it is not a candidate,
// and the mark no longer changes shape when Onest swaps in. The d is the ink box of "VK"
// set at 900/560px with the -0.04em tracking, outlined from the bundled
// @fontsource-variable/onest 5.3.0 latin file (OFL) with fontkit, origin at the ink box's
// top-left, which is why the viewBox is exactly the glyph and not a box padded with the
// font's ascent. The hatch period is in user units, so it scales with the element: 10
// keeps the on-screen pitch under 8px at the desktop width, where the stripes fill the
// mark instead of competing with its silhouette.
function stage(): string {
  return `<div class="stage" aria-hidden="true">
  <svg class="stage__contour" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice"><filter id="contour" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.0022" numOctaves="3" seed="13" /><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 9 -4" /><feComponentTransfer><feFuncA type="discrete" tableValues="0 1 0 1 0 1 0 1 0 1 0 1 0 1 0" /></feComponentTransfer><feMorphology operator="erode" radius="0.6" /></filter><rect width="1600" height="900" filter="url(#contour)" /></svg>
  <svg class="stage__letterform" viewBox="0 -396.5 784 396.5"><defs><pattern id="hatch-vk" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="4" fill="currentColor" /></pattern></defs><path d="M142.24 0L0 -396.48L110.32 -396.48L208.32 -85.12L302.4 -396.48L412.16 -396.48L271.04 0ZM427.28 0L427.28 -396.48L528.64 -396.48L528.64 -244.16L582.96 -244.16L668.64 -396.48L784 -396.48L666.4 -206.64L782.88 0L665.28 0L585.2 -150.64L528.64 -150.64L528.64 0Z" /></svg>
  <div class="stage__light"></div>
  <div class="stage__poster"></div>
</div>`;
}

function pills(c: Content): string {
  const items = SECTION_IDS.map((id) => `<a href="#${id}">${e(c.ui.nav[id])}</a>`).join('');
  return `<nav class="pills" aria-label="${e(c.ui.navLabel)}">${items}</nav>`;
}

const block = (id: Exclude<SectionId, 'top'>, c: Content, inner: string) =>
  `<section class="block" id="${id}" data-anchor="${ANCHOR_Y[id]}" aria-labelledby="h-${id}"><h2 class="block__head" id="h-${id}">${e(c.ui.sections[id])}</h2>${inner}</section>`;

function header(c: Content): string {
  const meta = c.header.meta.map((m, i) => `<li${i === 0 ? ' class="meta--level"' : ''}>${e(m)}</li>`).join('');
  return `<section class="block block--top" id="top" data-anchor="${ANCHOR_Y.top}"><h1>${e(c.header.name)}</h1><p class="role">${e(c.header.role)}</p><ul class="meta">${meta}</ul></section>`;
}

function project(p: Project): string {
  const bullets = p.bullets.length ? `<ul>${p.bullets.map((b) => `<li>${e(b)}</li>`).join('')}</ul>` : '';
  const tail = p.link ? ` <span class="proj__link">${link(p.link)}</span>` : '';
  const tech = p.tech ? `<p class="tech">${e(p.tech)}</p>` : '';
  return `<article class="proj"><p class="proj__head"><strong class="proj__name">${e(p.name)}</strong> <span class="proj__tagline">${e(p.tagline)}</span>${tail}</p>${bullets}${tech}</article>`;
}

function job(j: Job): string {
  const when = j.place ? `${e(j.place)} · ${e(j.when)}` : e(j.when);
  const titles = j.titles.length
    ? `<ul class="titles">${j.titles.map((t) => `<li${t.current ? ' class="titles--current"' : ''}><span>${e(t.title)}</span><span class="job__when">${e(t.when)}</span></li>`).join('')}</ul>`
    : '';
  const tech = j.tech ? `<p class="tech">${e(j.tech)}</p>` : '';
  return `<article class="job"><p class="job__head"><strong class="job__co">${e(j.company)}</strong><span class="job__when">${when}</span></p><p class="job__sub">${e(j.sub)}</p>${titles}<ul>${j.bullets.map((b) => `<li>${e(b)}</li>`).join('')}</ul>${tech}</article>`;
}

function achievement(a: Achievement): string {
  const l = a.link ? ` <span class="ach__link">${link(a.link)}</span>` : '';
  return `<li class="ach"><strong class="ach__title">${e(a.title)}</strong> <span class="ach__detail">${e(a.detail)}</span>${l}</li>`;
}

function card(c: Content): string {
  const cv = CV_FILES.map((f, i) => `<li><a href="${f.file}" download>${e(c.ui.cvFiles[i])}</a></li>`).join('');
  return `<div class="card">
  <p class="card__name">${e(c.contact.card)}</p>
  <ul class="card__icons">
    <li><a class="icon-link" rel="me" href="${PROFILES.vk}">${icon('vk')}<span>${e(c.ui.icons.vk)}</span></a></li>
    <li><a class="icon-link" rel="me" href="${PROFILES.telegram}">${icon('telegram')}<span>${e(c.ui.icons.telegram)}</span></a></li>
    <li><a class="icon-link" rel="me" href="${PROFILES.github}">${icon('github')}<span>${e(c.ui.icons.github)}</span></a></li>
    <li><details class="cv-menu"><summary class="icon-link">${icon('download')}<span>${e(c.ui.cvMenu)}</span></summary><ul>${cv}</ul></details></li>
    <li><a class="icon-link" href="${PROFILES.email}">${icon('gmail')}<span>${e(c.ui.icons.email)}</span></a></li>
  </ul>
  <p class="card__v1"><a href="${PROFILES.v1}">${e(c.ui.icons.v1)}</a></p>
</div>`;
}

export function renderBody(c: Content): string {
  const chips = c.skills.map((s) => `<li class="chip${s.hi ? ' chip--hi' : ''}">${e(s.label)}</li>`).join('');
  const edu = c.education;
  return `${renderSprite()}
<a class="skip" href="#profile">${e(c.ui.skip)}</a>
${strip(c)}
${pills(c)}
<main class="doc">
${header(c)}
${stage()}
${block('profile', c, `<p class="profile">${e(c.profile)}</p>`)}
${block('projects', c, `${c.projects.map(project).join('')}<p class="more">${e(c.projectsMore.text)} → ${link(c.projectsMore.link)}</p>`)}
${block('experience', c, c.jobs.map(job).join(''))}
${block('skills', c, `<ul class="chips">${chips}</ul>`)}
${block('education', c, `<p class="edu"><strong>${e(edu.school)}</strong><span class="job__when">${e(edu.year)}</span></p><p class="edu__program">${e(edu.program)} <span class="edu__place">${e(edu.place)}</span></p><p class="certs"><span class="certs__label">${e(edu.certs.label)}</span> ${edu.certs.items.map(e).join(' · ')}</p>`)}
${block('achievements', c, `<ul class="achs">${c.achievements.map(achievement).join('')}</ul>`)}
${block('contact', c, card(c))}
</main>`;
}
