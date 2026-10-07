#!/usr/bin/env node
/**
 * Mirrors the English locale structure into every other locale folder.
 * - Missing keys are added with "" (empty strings fall back to English at runtime).
 * - Existing translations are kept.
 * - Keys that no longer exist in English are removed.
 * Usage: npm run i18n:sync [-- <lng> ...]   (default: every folder next to "en", or "fr")
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'shared', 'i18n', 'locales');
const enDir = join(root, 'en');

function mirror(en, existing) {
  const out = {};
  for (const [key, value] of Object.entries(en)) {
    const prev = existing && typeof existing === 'object' ? existing[key] : undefined;
    if (value && typeof value === 'object') out[key] = mirror(value, prev);
    else out[key] = typeof prev === 'string' ? prev : '';
  }
  return out;
}

const requested = process.argv.slice(2);
const languages = requested.length
  ? requested
  : [...new Set(['fr', ...readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)])].filter(
      (l) => l !== 'en',
    );

for (const lng of languages) {
  const dir = join(root, lng);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  for (const file of readdirSync(enDir).filter((f) => f.endsWith('.json'))) {
    const en = JSON.parse(readFileSync(join(enDir, file), 'utf8'));
    const target = join(dir, file);
    const existing = existsSync(target) ? JSON.parse(readFileSync(target, 'utf8')) : {};
    writeFileSync(target, `${JSON.stringify(mirror(en, existing), null, 2)}\n`);
  }
  console.log(`synced ${lng}`);
}
