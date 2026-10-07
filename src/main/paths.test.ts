// @vitest-environment node
/**
 * IPC path safety: no RelPath may reach a location outside the workspace root, whether by
 * "..", absolute paths, NUL bytes, backslashes or symlinks.
 */

import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IpcError, toResult } from './errors';
import {
  dedupeName,
  isInside,
  normalizeRel,
  resolveExisting,
  resolveForCreate,
  resolveLexical,
  rewritePath,
  validateName,
} from './paths';
import { WorkspaceFs } from './workspaceFs';
import { isHiddenRel, EchoFilter } from './watcher';
import { assetExtension, ASSET_NAME_RE, resolveAssetRequest } from './assets';

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    return (e as IpcError).code;
  }
  return undefined;
}

async function asyncCodeOf(fn: () => Promise<unknown>): Promise<string | undefined> {
  try {
    await fn();
  } catch (e) {
    return (e as IpcError).code;
  }
  return undefined;
}

describe('normalizeRel / resolveLexical', () => {
  const root = '/Users/me/ws';

  it('accepts ordinary relative paths and normalises them', () => {
    expect(normalizeRel('')).toBe('');
    expect(normalizeRel('a//b/./c/')).toBe('a/b/c');
    expect(resolveLexical(root, 'Product/Roadmap.wboard')).toBe('/Users/me/ws/Product/Roadmap.wboard');
    expect(resolveLexical(root, '')).toBe(root);
  });

  it.each([
    '../secret',
    'a/../../secret',
    'a/b/../../../etc/passwd',
    '..',
    '/etc/passwd',
    '~/Documents',
    'C:/Windows',
    'a\\..\\..\\x',
    'a\0b',
  ])('rejects %j', (rel) => {
    expect(codeOf(() => resolveLexical(root, rel))).toBe('OUTSIDE_WORKSPACE');
  });

  it('rejects ".." even when it would stay inside', () => {
    expect(codeOf(() => normalizeRel('a/../b'))).toBe('OUTSIDE_WORKSPACE');
  });

  it('does not treat a sibling with a common prefix as inside', () => {
    expect(isInside('/ws', '/ws-evil/file')).toBe(false);
    expect(isInside('/ws', '/ws/file')).toBe(true);
    expect(isInside('/ws', '/ws')).toBe(true);
    expect(isInside('/ws', '/')).toBe(false);
  });
});

describe('names', () => {
  it('validates bare names', () => {
    expect(validateName('Roadmap.wboard')).toBeNull();
    expect(validateName('Été 2026')).toBeNull();
    for (const bad of ['', ' ', ' lead', 'trail ', 'a/b', 'a\\b', '.hidden', 'a\0', 'a:b', 'x'.repeat(300)]) {
      expect(validateName(bad)).not.toBeNull();
    }
  });

  it('deduplicates with " 2", " 3"', async () => {
    const taken = new Set(['Untitled board.wboard', 'Untitled board 2.wboard']);
    expect(await dedupeName('Untitled board', '.wboard', async (n) => taken.has(n))).toBe('Untitled board 3.wboard');
    expect(await dedupeName('Fresh', '.md', async () => false)).toBe('Fresh.md');
  });

  it('rewrites paths after rename/move', () => {
    expect(rewritePath('a/b', 'a', 'z')).toBe('z/b');
    expect(rewritePath('a', 'a', 'z')).toBe('z');
    expect(rewritePath('ab/c', 'a', 'z')).toBeNull();
  });
});

describe('real file system containment', () => {
  let tmp: string;
  let root: string;
  let outside: string;

  beforeEach(async () => {
    tmp = await realpath(await mkdtemp(path.join(os.tmpdir(), 'wc-paths-')));
    root = path.join(tmp, 'ws');
    outside = path.join(tmp, 'outside');
    await mkdir(path.join(root, 'Product'), { recursive: true });
    await mkdir(outside);
    await writeFile(path.join(outside, 'secret.md'), 'secret');
    await writeFile(path.join(root, 'Product', 'Notes.md'), '# Notes\n');
    await symlink(outside, path.join(root, 'escape'));
    await symlink(path.join(outside, 'secret.md'), path.join(root, 'leak.md'));
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it('resolves existing files inside the root', async () => {
    expect(await resolveExisting(root, 'Product/Notes.md')).toBe(path.join(root, 'Product', 'Notes.md'));
  });

  it('rejects symlinks that point outside', async () => {
    expect(await asyncCodeOf(() => resolveExisting(root, 'escape/secret.md'))).toBe('OUTSIDE_WORKSPACE');
    expect(await asyncCodeOf(() => resolveExisting(root, 'leak.md'))).toBe('OUTSIDE_WORKSPACE');
    expect(await asyncCodeOf(() => resolveForCreate(root, 'escape/new.md'))).toBe('OUTSIDE_WORKSPACE');
  });

  it('never reads, writes or creates outside through the WorkspaceFs API', async () => {
    const ws = await WorkspaceFs.open(root, { trash: async () => undefined });
    const attempts: (() => Promise<unknown>)[] = [
      () => ws.readFile('../outside/secret.md'),
      () => ws.readFile('escape/secret.md'),
      () => ws.readFile('leak.md'),
      () => ws.writeFile('../outside/secret.md', 'pwned'),
      () => ws.writeFile('escape/secret.md', 'pwned'),
      () => ws.writeFile('/tmp/pwned.md', 'pwned'),
      () => ws.createFile('../outside', 'x', '.md', 'pwned'),
      () => ws.createFile('', '../x', '.md', 'pwned'),
      () => ws.createFolder('escape', 'x'),
      () => ws.rename('Product/Notes.md', '../../outside/x.md'),
      () => ws.move('Product/Notes.md', '../outside'),
      () => ws.move('Product/Notes.md', 'escape'),
      () => ws.duplicate('Product/Notes.md', 'escape'),
      () => ws.trash('../outside/secret.md'),
      () => ws.stat('escape'),
    ];
    for (const attempt of attempts) {
      const result = await toResult(attempt);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(['OUTSIDE_WORKSPACE', 'INVALID_NAME', 'NOT_FOUND']).toContain(result.code);
    }
    expect(await readFile(path.join(outside, 'secret.md'), 'utf8')).toBe('secret');
  });

  it('writes atomically, detects conflicts and keeps names unique', async () => {
    const ws = await WorkspaceFs.open(root, { trash: async () => undefined });
    const first = await ws.writeFile('Product/Notes.md', 'v1\n');
    expect(first.hash).toMatch(/^[0-9a-f]{64}$/);
    await writeFile(path.join(root, 'Product', 'Notes.md'), 'external\n');
    expect(await toResult(() => ws.writeFile('Product/Notes.md', 'v2\n', { expectedHash: first.hash! }))).toMatchObject(
      {
        ok: false,
        code: 'CONFLICT',
      },
    );
    expect(await ws.createFile('Product', 'Notes', '.md', '')).toBe('Product/Notes 2.md');
    expect(await ws.duplicate('Product/Notes.md')).toBe('Product/Notes copy.md');
    expect(await ws.createFolder('', 'Product')).toBe('Product 2');
  });

  it('lists the tree without hidden entries or escaping symlinks', async () => {
    const ws = await WorkspaceFs.open(root, { trash: async () => undefined });
    await mkdir(path.join(root, '.whimsical'));
    await writeFile(path.join(root, '.DS_Store'), '');
    const tree = await ws.listTree();
    const names = (tree.children ?? []).map((c) => c.name);
    expect(names).toEqual(['Product']);
    expect(tree.children?.[0]?.children?.[0]).toMatchObject({ path: 'Product/Notes.md', kind: 'doc', type: 'file' });
  });

  it('rewrites favourites on rename and drops them on trash', async () => {
    const trashed: string[] = [];
    const ws = await WorkspaceFs.open(root, { trash: async (p) => void trashed.push(p) });
    await ws.writeMeta({
      version: 1,
      favorites: ['Product/Notes.md'],
      fileIcons: { Product: { icon: 'Star' } },
      manualOrder: {},
    });
    const renamed = await ws.rename('Product', 'Plans');
    expect(renamed).toBe('Plans');
    expect((await ws.readMeta()).favorites).toEqual(['Plans/Notes.md']);
    expect(Object.keys((await ws.readMeta()).fileIcons)).toEqual(['Plans']);
    await ws.trash('Plans/Notes.md');
    expect((await ws.readMeta()).favorites).toEqual([]);
    expect(trashed).toEqual([path.join(root, 'Plans', 'Notes.md')]);
    expect(await asyncCodeOf(() => ws.move('Plans', 'Plans'))).toBe('INVALID_NAME');
  });
});

describe('watcher helpers', () => {
  it('ignores hidden segments relative to the root only', () => {
    expect(isHiddenRel('.whimsical/workspace.json')).toBe(true);
    expect(isHiddenRel('Product/.Notes.md.tmp-abc')).toBe(true);
    expect(isHiddenRel('Product/Notes.md')).toBe(false);
  });

  it('drops echoes of own writes within 2 s only', () => {
    let now = 0;
    const echo = new EchoFilter(() => now);
    echo.record('a.md', 'h1');
    expect(echo.isEcho('a.md', 'h1')).toBe(true);
    expect(echo.isEcho('a.md', 'h2')).toBe(false);
    now = 2500;
    expect(echo.isEcho('a.md', 'h1')).toBe(false);
  });
});

describe('asset protocol', () => {
  it('only serves strict content-addressed names', async () => {
    expect(assetExtension('Photo.JPEG')).toBe('jpg');
    expect(assetExtension('noext')).toBe('bin');
    expect(ASSET_NAME_RE.test('0123456789abcdef.png')).toBe(true);
    expect(await resolveAssetRequest('wsasset://..%2F..%2Fetc%2Fpasswd', ['/tmp'])).toBeNull();
    expect(await resolveAssetRequest('wsasset://0123456789abcdef.png/../../x', ['/nonexistent'])).toBeNull();
  });
});
