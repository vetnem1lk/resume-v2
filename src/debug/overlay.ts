// The ?debug overlay: draws the whole scroll rig over the live page - the measured section keys,
// the camera spiral, the driver's frame, the letterform parallax and the beat log. Dev server only:
// reached through the DEV-guarded import in main.ts, so none of it is a shipped byte.
import { bus, type Beat } from '../beat/bus.ts';
import { wireClicks } from '../beat/clicks.ts';
import { initialScrollBeatState, scrollBeats, type ScrollBeatState } from '../beat/scroll.ts';
import { LETTERFORM_DEFAULTS, letterformPose, letterformVars, type LetterformParams } from '../scene/letterform.ts';
import { measureSections, sectionKeys, type KeyRule, type SectionKey } from '../scene/sections.ts';
import { SPIRAL_DEFAULTS, spiral, type EyeRule, type Spiral, type SpiralParams } from '../scene/spiral.ts';
import { createScrollDriver, type ScrollDriver, type ScrollFrame } from '../scroll/driver.ts';
import { REDUCED_MOTION, watchMedia } from '../scroll/media.ts';

// Two square panels side by side, CSS px: the top view on the left, the side view on the right.
const PANEL = 260;
const WIDTH = 2 * PANEL;
const HEIGHT = PANEL;
/** Top view: px per metre, origin at the panel centre, x right, z down. */
const TOP_SCALE = 30;
/** Side view: u along x, metres along y with the floor at the bottom. */
const SIDE = { left: PANEL + 24, right: WIDTH - 10, floor: HEIGHT - 16, top: 16 } as const;
const SIDE_METRES = 3.2;
const SAMPLES = 240;
const BODY_METRES = 1.72;
/** Half of the spec's 32 degree vertical field of view. */
const HALF_FOV = (16 * Math.PI) / 180;
const LOG_SIZE = 6;
const MARK_VARS = ['--mark-rotate', '--mark-rise', '--mark-scale'] as const;

const topX = (x: number): number => PANEL / 2 + x * TOP_SCALE;
const topZ = (z: number): number => PANEL / 2 + z * TOP_SCALE;
const sideX = (u: number): number => SIDE.left + u * (SIDE.right - SIDE.left);
const sideY = (metres: number): number => SIDE.floor - (metres / SIDE_METRES) * (SIDE.floor - SIDE.top);

// Query flags, read once: the two rules and the spiral and letterform numbers tuned on this canvas.
const query = new URLSearchParams(location.search);

/** A finite number from the query, or undefined so the module default stands. */
function numberParam(name: string): number | undefined {
  const raw = query.get(name);
  if (raw === null || raw.trim() === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

const keyRule: KeyRule = query.get('key') === 'centre' ? 'centre' : 'landing';
const eye: EyeRule = query.get('eye') === 'absolute' ? 'absolute' : SPIRAL_DEFAULTS.eye;
const turns = numberParam('turns');
const theta0 = numberParam('theta0');
const lag = numberParam('lag');
const overrides: Partial<SpiralParams> = {
  eye,
  ...(turns === undefined ? {} : { turns }),
  ...(theta0 === undefined ? {} : { theta0: (theta0 * Math.PI) / 180 }),
  ...(lag === undefined ? {} : { lookLag: lag }),
};
const markParams: LetterformParams = {
  turn: numberParam('turn') ?? LETTERFORM_DEFAULTS.turn,
  rise: numberParam('rise') ?? LETTERFORM_DEFAULTS.rise,
  zoom: numberParam('zoom') ?? LETTERFORM_DEFAULTS.zoom,
};
const markOn = query.get('mark') !== 'off';

// The two elements, styled inline from the page's tokens (no stylesheet for a development tool);
// on a narrow viewport both shrink to fit, the canvas keeping its 2:1 box.
const tokens = getComputedStyle(document.documentElement);
const token = (name: string): string => tokens.getPropertyValue(name).trim();
const INK = token('--ink');
const DIM = token('--dim');
const RULE = token('--rule');
const OXIDE = token('--oxide');
const FONT = `9px ${token('--font-mono')}`;
const SHEET = [
  'position:fixed', 'left:12px', 'z-index:10', 'margin:0', 'pointer-events:none', 'max-width:calc(100vw - 24px)',
  'background:color-mix(in srgb, var(--paper) 92%, transparent)', 'color:var(--ink)',
  'font:11px/1.4 var(--font-mono)',
].join(';');
const canvas = document.createElement('canvas');
canvas.style.cssText = `${SHEET};bottom:12px;width:${WIDTH}px;height:auto`;
const hud = document.createElement('pre');
hud.style.cssText = `${SHEET};bottom:calc(20px + min(${HEIGHT}px, (100vw - 24px) / 2));width:${WIDTH}px;padding:6px 10px;box-sizing:border-box;white-space:pre-wrap`;
for (const el of [canvas, hud]) el.setAttribute('aria-hidden', 'true');
const ctx = canvas.getContext('2d')!;
const mark = document.querySelector<SVGElement>('.stage__letterform');

// What a frame reads: the rig, rebuilt on every layout change, the beat ring and the motion flag.
let keys: SectionKey[] = [];
let rig: { readonly active: Spiral; readonly other: Spiral } | null = null;
let rigError = '';
let reduced = false;
let arrived = '-';
let beatState: ScrollBeatState | null = null;
let driver: ScrollDriver | null = null;
const log: Pick<Beat, 'name' | 'source' | 'at' | 'data'>[] = [];

/** One layout read, then the spiral under the active eye rule and under the other one (the dashed
 *  curve). Fewer than two keys is reported on the HUD, never thrown out of the module. */
function rebuild(): void {
  const { boxes, layout } = measureSections();
  keys = sectionKeys(boxes, layout, keyRule);
  try {
    const active = spiral(keys, overrides);
    const other = spiral(keys, { ...overrides, eye: eye === 'absolute' ? 'aboveAnchor' : 'absolute' });
    rig = { active, other };
    rigError = '';
  } catch (error) {
    rig = null;
    rigError = error instanceof Error ? error.message : String(error);
  }
}

/** The ring keeps a beat's fields and never the element it came from. */
function record(beat: Beat): void {
  const section = beat.data?.section;
  if (beat.name === 'scroll:arrive' && section !== undefined) arrived = section;
  log.push({ name: beat.name, source: beat.source, at: beat.at, data: beat.data === undefined ? undefined : { ...beat.data } });
  if (log.length > LOG_SIZE) log.shift();
}

function line(x0: number, y0: number, x1: number, y1: number): void {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

function dot(x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 2 * Math.PI);
  ctx.fill();
}

/** Strokes a curve sampled over u in [0,1]. */
function polyline(point: (u: number) => readonly [number, number]): void {
  ctx.beginPath();
  for (let i = 0; i <= SAMPLES; i += 1) {
    const [x, y] = point(i / SAMPLES);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

/** Paints inside one panel: a key outside [0,1] or a wide orbit never crosses into the other. */
function panel(left: number, paint: () => void): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(left, 0, PANEL, HEIGHT);
  ctx.clip();
  paint();
  ctx.restore();
}

function drawTop(active: Spiral, uSmooth: number): void {
  // The character: a 0.25 m circle at the origin with its facing tick along -Z, which is up here.
  ctx.strokeStyle = INK;
  ctx.beginPath();
  ctx.arc(topX(0), topZ(0), 0.25 * TOP_SCALE, 0, 2 * Math.PI);
  ctx.stroke();
  line(topX(0), topZ(-0.25), topX(0), topZ(-0.55));
  ctx.strokeStyle = DIM;
  polyline((u) => {
    const [x, , z] = active.position(u);
    return [topX(x), topZ(z)];
  });
  ctx.fillStyle = INK;
  // Labels alternate above and below their dot and face the panel centre, so two keys on the same
  // bearing one turn apart, or a key near the edge, stay readable.
  for (const [i, key] of keys.entries()) {
    const [x, , z] = active.key(i).position;
    dot(topX(x), topZ(z), 2.5);
    ctx.textAlign = x < 0 ? 'left' : 'right';
    ctx.fillText(key.id, topX(x) + (x < 0 ? 5 : -5), topZ(z) + (i % 2 === 0 ? -4 : 11));
  }
  const [cx, , cz] = active.position(uSmooth);
  const [lx, , lz] = active.look(uSmooth);
  ctx.strokeStyle = OXIDE;
  ctx.fillStyle = OXIDE;
  line(topX(cx), topZ(cz), topX(lx), topZ(lz));
  dot(topX(cx), topZ(cz), 4);
  dot(topX(lx), topZ(lz), 2);
}

function drawSide(active: Spiral, other: Spiral, frame: ScrollFrame): void {
  ctx.strokeStyle = RULE;
  line(sideX(0), sideY(0), sideX(1), sideY(0));
  // At every key: the 1.72 m silhouette, then the vertical frame extent centred on the look height.
  for (const [i, key] of keys.entries()) {
    const x = sideX(key.u);
    const { position, look } = active.key(i);
    ctx.strokeStyle = RULE;
    ctx.lineWidth = 5;
    line(x, sideY(0), x, sideY(BODY_METRES));
    const distance = Math.hypot(position[0] - look[0], position[1] - look[1], position[2] - look[2]);
    const half = distance * Math.tan(HALF_FOV);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    line(x, sideY(look[1] - half), x, sideY(look[1] + half));
    line(x - 3, sideY(look[1] - half), x + 3, sideY(look[1] - half));
    line(x - 3, sideY(look[1] + half), x + 3, sideY(look[1] + half));
  }
  // Camera height under the other eye rule (dashed) and the active one (solid), then the look height.
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = DIM;
  polyline((u) => [sideX(u), sideY(other.position(u)[1])]);
  ctx.setLineDash([]);
  ctx.strokeStyle = INK;
  polyline((u) => [sideX(u), sideY(active.position(u)[1])]);
  ctx.strokeStyle = OXIDE;
  polyline((u) => [sideX(u), sideY(active.look(u)[1])]);
  // Cursors: the raw scroll in dim, the damped camera in oxide.
  ctx.strokeStyle = DIM;
  line(sideX(frame.u), sideY(0), sideX(frame.u), sideY(SIDE_METRES));
  ctx.strokeStyle = OXIDE;
  line(sideX(frame.uSmooth), sideY(0), sideX(frame.uSmooth), sideY(SIDE_METRES));
}

function hudText(frame: ScrollFrame, scrollY: number, markLine: string): string {
  const lines = [
    `u ${frame.u.toFixed(4)}  uSmooth ${frame.uSmooth.toFixed(4)}  scrollY ${Math.round(scrollY)}  settled ${frame.settled}`,
    `section ${arrived}  key ${keyRule}  eye ${eye}  motion ${reduced ? 'reduced' : 'normal'}`,
    `mark ${markLine}`,
    `keys ${keys.length === 0 ? '-' : keys.map((k) => `${k.id} ${k.u.toFixed(3)}`).join('  ')}`,
    ...(rig === null ? [`spiral ${rigError}`] : []),
    `beats${log.length === 0 ? ' -' : ''}`,
    ...log.map((b) => `  ${b.name} ${b.data?.section ?? ''}`.trimEnd()),
  ];
  return lines.join('\n');
}

function draw(frame: ScrollFrame, scrollY: number, markLine: string): void {
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(WIDTH * dpr)) {
    canvas.width = Math.round(WIDTH * dpr);
    canvas.height = Math.round(HEIGHT * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.font = FONT;
  ctx.lineWidth = 1;
  ctx.strokeStyle = RULE;
  line(PANEL, 0, PANEL, HEIGHT);
  ctx.fillStyle = DIM;
  ctx.fillText(`top view, ${TOP_SCALE} px per m`, 8, 12);
  ctx.fillText(`side view, u across, 0 to ${SIDE_METRES} m up`, PANEL + 8, 12);
  const current = rig;
  if (current !== null) {
    panel(0, () => drawTop(current.active, frame.uSmooth));
    panel(PANEL, () => drawSide(current.active, current.other, frame));
  }
  const text = hudText(frame, scrollY, markLine);
  if (hud.textContent !== text) hud.textContent = text;
}

function onSettle(settled: boolean, u: number): void {
  bus.emit({ name: settled ? 'scroll:settle' : 'scroll:start', source: 'scroll', at: performance.now(), data: { u } });
}

function onFrame(frame: ScrollFrame): void {
  // Read before the style write below, while the driver's own read has left the layout clean.
  const scrollY = window.scrollY;
  beatState ??= initialScrollBeatState(frame.u);
  const step = scrollBeats(beatState, frame.u, frame.dt, keys, frame.now);
  beatState = step.state;
  for (const beat of step.beats) bus.emit(beat);
  const vars = letterformVars(letterformPose(frame.uSmooth, markParams));
  if (markOn && !reduced && mark !== null) for (const [name, value] of Object.entries(vars)) mark.style.setProperty(name, value);
  draw(frame, scrollY, !markOn ? 'off' : reduced ? 'static (reduced motion)' : Object.values(vars).join(' '));
}

document.body.append(hud, canvas);
wireClicks(bus);
bus.on('*', record);
rebuild();
new ResizeObserver(rebuild).observe(document.documentElement);
// The driver is rebuilt on every motion-preference change: Infinity makes uSmooth follow u exactly.
watchMedia(REDUCED_MOTION, (matches) => {
  reduced = matches;
  if (matches && mark !== null) for (const name of MARK_VARS) mark.style.removeProperty(name);
  driver?.stop();
  driver = createScrollDriver({ onFrame, onSettle, lambda: matches ? Infinity : undefined });
  driver.start();
});
