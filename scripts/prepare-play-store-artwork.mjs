import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const outputDirectory = resolve('play-store/generated');
mkdirSync(outputDirectory, { recursive: true });

function run(command, args, input) {
  const result = spawnSync(command, args, {
    input,
    encoding: 'buffer',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${command} failed (${result.status}): ${result.stderr?.toString('utf8') || 'no diagnostic output'}`,
    );
  }
  return result.stdout;
}

function validatePng(buffer, expectedWidth, expectedHeight) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(signature)) {
    throw new Error('Generated app icon is not a valid PNG file.');
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const bitDepth = buffer[24];
  const colorType = buffer[25];
  if (width !== expectedWidth || height !== expectedHeight) {
    throw new Error(`PNG dimensions must be ${expectedWidth}x${expectedHeight}, got ${width}x${height}.`);
  }
  if (bitDepth !== 8 || colorType !== 6) {
    throw new Error('Google Play app icon must be an 8-bit RGBA PNG.');
  }
  return { width, height, bitDepth, colorType, bytes: buffer.length };
}

function validateJpeg(buffer, expectedWidth, expectedHeight) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    throw new Error('Generated feature graphic is not a JPEG file.');
  }
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) break;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      const height = buffer.readUInt16BE(offset + 3);
      const width = buffer.readUInt16BE(offset + 5);
      if (width !== expectedWidth || height !== expectedHeight) {
        throw new Error(`JPEG dimensions must be ${expectedWidth}x${expectedHeight}, got ${width}x${height}.`);
      }
      return { width, height, bytes: buffer.length };
    }
    offset += segmentLength;
  }
  throw new Error('Could not read feature graphic JPEG dimensions.');
}

const iconSource = resolve('resources/icon-only.svg');
const iconBackgroundSource = resolve('resources/icon-background.svg');
const featureSource = resolve('play-store/feature-graphic.svg');
const iconBackgroundMarkup = readFileSync(iconBackgroundSource, 'utf8');
const featureMarkup = readFileSync(featureSource, 'utf8');
if (!/width="1024"\s+height="1024"/.test(iconBackgroundMarkup)) {
  throw new Error('App icon background SVG must define a 1024x1024 canvas.');
}
if (!/width="1024"\s+height="500"/.test(featureMarkup)) {
  throw new Error('Feature graphic SVG must define a 1024x500 canvas.');
}

// Google Play applies its own rounded mask and expects a full, opaque artwork
// background. Composite the transparent foreground artwork over the same dark
// warehouse background used by the Android adaptive launcher icon.
const iconBackgroundPng = run('rsvg-convert', ['--width', '512', '--height', '512', iconBackgroundSource]);
const iconForegroundPng = run('rsvg-convert', ['--width', '512', '--height', '512', iconSource]);
const iconBackgroundPath = resolve(outputDirectory, '.app-icon-background.tmp.png');
const iconForegroundPath = resolve(outputDirectory, '.app-icon-foreground.tmp.png');
let iconPng;
try {
  writeFileSync(iconBackgroundPath, iconBackgroundPng);
  writeFileSync(iconForegroundPath, iconForegroundPng);
  iconPng = run('convert', [
    iconBackgroundPath,
    iconForegroundPath,
    '-compose', 'over',
    '-composite',
    '-define', 'png:color-type=6',
    '-depth', '8',
    'png:-',
  ]);
} finally {
  try { unlinkSync(iconBackgroundPath); } catch { /* No temp file was created. */ }
  try { unlinkSync(iconForegroundPath); } catch { /* No temp file was created. */ }
}
const opacity = run('identify', ['-format', '%[opaque]', 'png:-'], iconPng).toString('utf8').trim().toLowerCase();
if (opacity !== 'true') {
  throw new Error('Google Play app icon must have a fully opaque background (no transparent pixels).');
}
const iconInfo = validatePng(iconPng, 512, 512);
if (iconInfo.bytes > 1024 * 1024) {
  throw new Error('Google Play app icon must not exceed 1 MiB.');
}
const iconPath = resolve(outputDirectory, 'app-icon-512.png');
writeFileSync(iconPath, iconPng);

const featurePng = run('rsvg-convert', ['--width', '1024', '--height', '500', featureSource]);
const featureJpeg = run('convert', [
  'png:-', '-alpha', 'off', '-depth', '8', '-strip', '-quality', '92', 'jpg:-',
], featurePng);
const featureInfo = validateJpeg(featureJpeg, 1024, 500);
const featurePath = resolve(outputDirectory, 'feature-graphic-1024x500.jpg');
writeFileSync(featurePath, featureJpeg);

console.log(JSON.stringify({
  appIcon: { path: iconPath, ...iconInfo, format: '8-bit RGBA PNG' },
  featureGraphic: { path: featurePath, ...featureInfo, format: 'JPEG 24-bit, no alpha' },
}, null, 2));
