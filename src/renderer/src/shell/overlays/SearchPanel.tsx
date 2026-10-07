/**
 * Search sidebar on the right (Whimsical: Cmd+J workspace, Cmd+F this file / folder).
 * Workspace mode matches file names and document text (read locally, cached by mtime);
 * file mode matches the open document's text or the folder's file names.
 * Up/Down navigate, Return opens, Escape closes, Cmd+Return switches to workspace.
 */

import Fuse from 'fuse.js';
import { clsx } from 'clsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { kindFromPath } from '@shared/fileKinds';
import type { RelPath } from '@shared/ipc';
import { formatCombo } from '@shared/keys';
import { FileIcon, IconButton, SegmentedControl } from '@renderer/ui';
import { openPath } from '../fileActions';
import { extractText, findMatches, type TextChunk, type TextMatch } from '../searchText';
import { pluginFor, useDocuments } from '../state/documents';
import { useResolvedTheme } from '../state/prefs';
import { useActiveTab, useTabs } from '../state/tabs';
import { useUi, type SearchMode } from '../state/ui';
import { useWorkspace } from '../state/workspace';
import { displayName, isWithin, listFiles, parentOf } from '../tree';

const MAX_CONTENT_FILES = 400;
const textCache = new Map<RelPath, { mtimeMs: number; chunks: TextChunk[] }>();

async function chunksFor(path: RelPath, mtimeMs: number): Promise<TextChunk[]> {
  const cached = textCache.get(path);
  if (cached && cached.mtimeMs === mtimeMs) return cached.chunks;
  const result = await window.api.fs.readFile(path);
  if (!result.ok) return [];
  const chunks = extractText(path, result.value.content);
  textCache.set(path, { mtimeMs, chunks });
  return chunks;
}

interface Result {
  path: RelPath;
  nameMatch: boolean;
  matches: TextMatch[];
}

export function SearchPanel({ mode }: { mode: SearchMode }): JSX.Element {
  const { t } = useTranslation('shell');
  const tree = useWorkspace((s) => s.tree);
  const recent = useTabs((s) => s.recent);
  const tab = useActiveTab();
  const theme = useResolvedTheme();
  const activeFile = tab?.kind === 'file' ? tab.path : null;
  const activeFolder = tab?.kind === 'folder' ? tab.path : null;
  const activeDoc = useDocuments((s) => (activeFile ? s.docs[activeFile] : undefined));
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [mode]);

  const files = useMemo(() => listFiles(tree), [tree]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setBusy(true);
      let next: Result[] = [];
      if (mode === 'file' && activeFile && activeDoc?.status === 'ready') {
        const plugin = pluginFor(activeFile);
        const text = plugin ? plugin.serialize(activeDoc.content) : '';
        const matches = findMatches(extractText(activeFile, text), q, 50);
        next = matches.length ? [{ path: activeFile, nameMatch: false, matches }] : [];
      } else {
        const scope =
          mode === 'file' && activeFolder !== null ? files.filter((f) => isWithin(f.path, activeFolder)) : files;
        const fuse = new Fuse(scope, { keys: ['name'], threshold: 0.35, ignoreLocation: true });
        const byName = new Set(fuse.search(q).map((r) => r.item.path));
        const map = new Map<RelPath, Result>();
        for (const path of byName) map.set(path, { path, nameMatch: true, matches: [] });
        if (mode === 'workspace') {
          for (const file of scope.slice(0, MAX_CONTENT_FILES)) {
            if (cancelled) return;
            const matches = findMatches(await chunksFor(file.path, file.mtimeMs), q, 3);
            if (matches.length === 0) continue;
            const entry = map.get(file.path) ?? { path: file.path, nameMatch: false, matches: [] };
            entry.matches = matches;
            map.set(file.path, entry);
          }
        }
        next = [...map.values()].sort(
          (a, b) => Number(b.nameMatch) - Number(a.nameMatch) || b.matches.length - a.matches.length,
        );
      }
      if (!cancelled) {
        setResults(next);
        setActive(0);
        setBusy(false);
      }
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, mode, files, activeFile, activeFolder, activeDoc]);

  const rows = query.trim()
    ? results.flatMap((r) =>
        r.matches.length
          ? r.matches.map((m, i) => ({ path: r.path, match: m as TextMatch | undefined, first: i === 0 }))
          : [{ path: r.path, match: undefined, first: true }],
      )
    : recent
        .filter((p) => files.some((f) => f.path === p))
        .map((path) => ({ path, match: undefined as TextMatch | undefined, first: true }));

  const close = () => useUi.setState({ search: null });
  const open = (path: RelPath | undefined) => {
    if (path === undefined) return;
    openPath(path);
    close();
  };

  const fileLabel = activeFolder !== null ? t('search.thisFolder') : t('search.thisFile');

  return (
    <aside className="shell-search" aria-label={t('titleBar.search')}>
      <div className="shell-search__header">
        <SegmentedControl
          ariaLabel={t('titleBar.search')}
          value={mode}
          onChange={(m) => useUi.setState({ search: m })}
          options={[
            { value: 'workspace', label: t('search.workspace') },
            { value: 'file', label: fileLabel },
          ]}
        />
        <IconButton icon="X" label={t('search.close')} size="sm" onClick={close} />
      </div>
      <div className="shell-search__field">
        <input
          ref={inputRef}
          value={query}
          placeholder={t('search.placeholder')}
          spellCheck={false}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              close();
            } else if (e.key === 'Enter' && e.metaKey) {
              e.preventDefault();
              e.stopPropagation();
              useUi.setState({ search: 'workspace' });
            } else if (e.key === 'Enter') {
              e.preventDefault();
              open(rows[active]?.path);
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(rows.length - 1, a + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            }
          }}
        />
      </div>
      {mode === 'file' && (
        <div className="shell-search__hint">{t('search.hint', { shortcut: formatCombo('Mod+Enter') })}</div>
      )}
      <div className="shell-search__results">
        {!query.trim() && rows.length > 0 && <div className="shell-search__section">{t('search.recentFiles')}</div>}
        {busy && rows.length === 0 && <div className="shell-search__empty">{t('search.indexing')}</div>}
        {!busy && query.trim() && rows.length === 0 && (
          <div className="shell-search__empty">{t('search.noResults')}</div>
        )}
        {rows.map((row, i) => (
          <button
            type="button"
            key={`${row.path}-${i}`}
            className={clsx('shell-search__row', i === active && 'is-active', !row.first && 'is-continuation')}
            onPointerMove={() => setActive(i)}
            onClick={() => open(row.path)}
          >
            {row.first && (
              <span className="shell-search__file">
                <FileIcon kind={kindFromPath(row.path)} dark={theme === 'dark'} />
                <span className="shell-search__name">{displayName(row.path)}</span>
                <span className="shell-search__folder">{parentOf(row.path)}</span>
              </span>
            )}
            {row.match && (
              <span className="shell-search__snippet">
                {row.match.snippet.slice(0, row.match.start)}
                <mark>{row.match.snippet.slice(row.match.start, row.match.start + row.match.length)}</mark>
                {row.match.snippet.slice(row.match.start + row.match.length)}
              </span>
            )}
          </button>
        ))}
      </div>
    </aside>
  );
}
