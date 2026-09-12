// Encodes the captured first frame into the poster set the document references: the tall column and
// its head-and-shoulders band, AVIF and WebP at 1x and 2x with alpha, into the build's poster
// directory - and refuses a capture older than the character it must show.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { POSTER } from '../../src/scene/assets.ts';
import { PATHS } from './paths.ts';

// sharp is vendored inside the gltf-transform CLI tree (the textures step's pattern): loaded by URL,
// the operations this script uses declared here.
interface Region { left: number; top: number; width: number; height: number }
interface Image {
  trim(options: { background: { r: number; g: number; b: number; alpha: number } }): Image;
  extract(region: Region): Image;
  resize(width: number, height: number, options: { fit: 'cover'; kernel: 'lanczos3' }): Image;
  png(): Image;
  avif(options: { quality: number; effort: number }): Image;
  webp(options: { quality: number; effort: number; alphaQuality: number }): Image;
  toBuffer(): Promise<Buffer>;
  toBuffer(options: { resolveWithObject: true }): Promise<{ info: { height: number; trimOffsetTop?: number } }>;
}
const { default: sharp } = await import(`file:///${PATHS.gltfModules}sharp/lib/index.js`) as { default: (input: Buffer) => Image };

const flag = process.argv.indexOf('--build');
const build = flag === -1 ? undefined : process.argv[flag + 1];
if (build === undefined) throw new Error('usage: pipeline:poster -- --build <build>');
const s4 = resolve(PATHS.build, 's4');
const png = resolve(s4, 'poster', 'first-frame@2x.png');
const buildDir = resolve(s4, 'deploy', 'g2', 'v2', build);
const glb = resolve(buildDir, 'mg.glb');
if (!existsSync(glb)) throw new Error(`no build at ${buildDir}`);
if (!existsSync(png)) throw new Error(`capture the poster first: ${png}`);
// A poster captured before the character was assembled shows a character that no longer ships.
if (statSync(png).mtimeMs < statSync(glb).mtimeMs) throw new Error(`${png} predates ${glb}: capture it again`);

const source = readFileSync(png);
const W = POSTER.width * 2;
const H = POSTER.height * 2;
/** The band is this share of the column's height. */
const BAND = 0.55;
/** The band starts this share of its own height above the first opaque row. */
const HEADROOM = 0.1;
const RESIZE = { fit: 'cover', kernel: 'lanczos3' } as const;
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

// The column at 2x (a capture at another size is resampled onto it), then the band window: it opens
// a headroom above the head, but never reaches below the last opaque row - where the capture's own
// edge cut the figure, the band's edge cuts it too, instead of a hard line inside the band.
const column = await sharp(source).resize(W, H, RESIZE).png().toBuffer();
const { info } = await sharp(column).trim({ background: TRANSPARENT }).toBuffer({ resolveWithObject: true });
const bandH = Math.round(H * BAND);
const head = -(info.trimOffsetTop ?? 0);
const top = Math.max(0, Math.min(head - Math.round(bandH * HEADROOM), head + info.height - bandH, H - bandH));
const band = await sharp(column).extract({ left: 0, top, width: W, height: bandH }).png().toBuffer();
console.log(`column ${W}x${H}, opaque rows ${head}..${head + info.height}, band ${W}x${bandH} from row ${top}`);

const outDir = resolve(buildDir, 'poster');
mkdirSync(outDir, { recursive: true });
const files: Record<string, number> = {};
const crops: [string, Buffer, number, number][] = [
  ['tall-2x', column, W, H], ['tall-1x', column, W / 2, H / 2],
  ['band-2x', band, W, bandH], ['band-1x', band, W / 2, bandH / 2],
];
for (const [name, input, width, height] of crops) {
  const resized = sharp(input).resize(width, height, RESIZE);
  const encoded = {
    avif: await resized.avif({ quality: 60, effort: 4 }).toBuffer(),
    webp: await resized.webp({ quality: 80, effort: 6, alphaQuality: 90 }).toBuffer(),
  };
  for (const [ext, bytes] of Object.entries(encoded)) {
    writeFileSync(resolve(outDir, `${name}.${ext}`), bytes);
    files[`${name}.${ext}`] = bytes.byteLength;
    console.log(`${name}.${ext} ${width}x${height} -> ${bytes.byteLength} B`);
  }
}
writeFileSync(resolve(outDir, 'poster.json'), JSON.stringify({ files, source: createHash('sha256').update(source).digest('hex').slice(0, 16) }, null, 1));
