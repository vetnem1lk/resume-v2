// Encodes the captured first frame into the poster set the document references: the tall column and
// its head-and-shoulders band, AVIF and WebP at 1x and 2x with alpha, into the build's poster
// directory - and refuses a capture older than the character it must show.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ASPECT, bandWindow, HEAD, type Box } from '../../src/pipeline/band.ts';
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
  toBuffer(options: { resolveWithObject: true }): Promise<{ info: { width: number; height: number; trimOffsetLeft?: number; trimOffsetTop?: number } }>;
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
const RESIZE = { fit: 'cover', kernel: 'lanczos3' } as const;
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

/** The opaque bounding box of a PNG buffer, in that buffer's own pixels. */
async function opaqueBox(buffer: Buffer): Promise<Box> {
  const { info } = await sharp(buffer).trim({ background: TRANSPARENT }).toBuffer({ resolveWithObject: true });
  return { left: -(info.trimOffsetLeft ?? 0), top: -(info.trimOffsetTop ?? 0), width: info.width, height: info.height };
}

// The column at 2x (a capture at another size is resampled onto it), then the band: the head and
// shoulders cut out of the column. A 1:1 slice cannot be that crop - the column frames a whole
// standing figure in a 100svh box, so the slice is taller than the figure itself and a phone gets
// the whole body under a third of a screen of empty paper. The band ships at the window's own
// resolution: enlarging it here would only store an upscale the browser can do for free.
const column = await sharp(source).resize(W, H, RESIZE).png().toBuffer();
const figure = await opaqueBox(column);
const headSlice = await sharp(column)
  .extract({ left: 0, top: figure.top, width: W, height: Math.round(H * HEAD) })
  .png().toBuffer();
const head = await opaqueBox(headSlice);
const headCentre = head.left + head.width / 2;
const crop = bandWindow({ width: W, height: H }, figure.top, headCentre, ASPECT);
// Even, so the 1x of the pair is a whole number of pixels.
const bandW = crop.width + (crop.width % 2);
const bandH = crop.height + (crop.height % 2);
const band = await sharp(column).extract(crop).resize(bandW, bandH, RESIZE).png().toBuffer();
console.log(`column ${W}x${H}, figure ${figure.width}x${figure.height} at ${figure.left},${figure.top}, head centre ${headCentre}`);
console.log(`band window ${crop.width}x${crop.height} at ${crop.left},${crop.top} -> ${bandW}x${bandH}`);

const outDir = resolve(buildDir, 'poster');
mkdirSync(outDir, { recursive: true });
const files: Record<string, number> = {};
const crops: [string, Buffer, number, number][] = [
  ['tall-2x', column, W, H], ['tall-1x', column, W / 2, H / 2],
  ['band-2x', band, bandW, bandH], ['band-1x', band, bandW / 2, bandH / 2],
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
