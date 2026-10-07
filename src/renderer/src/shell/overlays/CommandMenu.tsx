/**
 * Command menu (Cmd+K): recent commands first, fuzzy search over every currently available
 * command (context-aware: only bound commands) and workspace files, shortcuts right-aligned.
 */

import Fuse from 'fuse.js';
import { clsx } from 'clsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { kindFromPath } from '@shared/fileKinds';
import type { RelPath } from '@shared/ipc';
import { shortcutRegistry } from '@renderer/core/shortcuts';
import { translateKey } from '@renderer/i18n';
import { FileIcon, Icon, Kbd, Modal } from '@renderer/ui';
import { openPath } from '../fileActions';
import { useResolvedTheme } from '../state/prefs';
import { getEditorScopes } from '../state/scopes';
import { useTabs } from '../state/tabs';
import { closeOverlay } from '../state/ui';
import { useWorkspace } from '../state/workspace';
import { displayName, listFiles, parentOf } from '../tree';

const RECENT_KEY = 'wc.recentCommands';

interface Item {
  key: string;
  type: 'command' | 'file';
  label: string;
  detail?: string;
  icon?: string;
  shortcut?: string | undefined;
  path?: RelPath;
}

function readRecentCommands(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function rememberCommand(id: string): void {
  const next = [id, ...readRecentCommands().filter((x) => x !== id)].slice(0, 10);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable: recents are a convenience only
  }
}

export function availableCommands(): Item[] {
  const scopes = new Set<string>(['app', ...getEditorScopes()]);
  return shortcutRegistry
    .getDefs()
    .filter(
      (d) =>
        d.dispatch !== 'native' &&
        scopes.has(d.scope) &&
        d.id !== 'app.commandMenu' &&
        !(d.keys.length === 0 && (d.gestures?.length ?? 0) > 0) &&
        shortcutRegistry.isBound(d.id),
    )
    .map((d) => ({
      key: `cmd:${d.id}`,
      type: 'command' as const,
      label: translateKey(d.labelKey),
      icon: d.icon,
      shortcut: shortcutRegistry.format(d.id),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function CommandMenu(): JSX.Element {
  const { t } = useTranslation(['shell', 'common']);
  const tree = useWorkspace((s) => s.tree);
  const recentFiles = useTabs((s) => s.recent);
  const theme = useResolvedTheme();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  const commands = useMemo(() => availableCommands(), []);
  const files = useMemo<Item[]>(
    () =>
      listFiles(tree).map((n) => ({
        key: `file:${n.path}`,
        type: 'file' as const,
        label: displayName(n.path),
        detail: parentOf(n.path),
        path: n.path,
      })),
    [tree],
  );
  const fuse = useMemo(
    () =>
      new Fuse([...commands, ...files], {
        keys: [{ name: 'label', weight: 3 }, 'detail'],
        threshold: 0.38,
        ignoreLocation: true,
      }),
    [commands, files],
  );

  const sections = useMemo(() => {
    if (query.trim()) {
      const results = fuse.search(query.trim(), { limit: 40 }).map((r) => r.item);
      return [{ title: '', items: results }];
    }
    const byId = new Map(commands.map((c) => [c.key, c]));
    const recentCmds = readRecentCommands()
      .map((id) => byId.get(`cmd:${id}`))
      .filter((c): c is Item => !!c)
      .slice(0, 3);
    const recent = recentFiles
      .slice(0, 5)
      .map((p) => files.find((f) => f.path === p))
      .filter((f): f is Item => !!f);
    return [
      { title: t('commandMenu.recent'), items: recentCmds },
      { title: t('commandMenu.files'), items: recent },
      { title: t('commandMenu.commands'), items: commands.filter((c) => !recentCmds.includes(c)) },
    ].filter((s) => s.items.length > 0);
  }, [query, fuse, commands, files, recentFiles, t]);

  const flat = sections.flatMap((s) => s.items);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const run = (item: Item | undefined) => {
    if (!item) return;
    closeOverlay();
    if (item.type === 'file' && item.path !== undefined) {
      openPath(item.path);
      return;
    }
    const id = item.key.slice(4);
    rememberCommand(id);
    window.setTimeout(() => shortcutRegistry.run(id, { source: 'commandMenu' }), 0);
  };

  let index = -1;
  return (
    <Modal
      open
      onClose={closeOverlay}
      closeLabel={t('common:actions.close')}
      width={600}
      position="top"
      hideHeader
      className="shell-cmdk"
    >
      <div className="shell-cmdk__input">
        <Icon name="Search" size={18} />
        <input
          data-autofocus
          value={query}
          placeholder={t('commandMenu.placeholder')}
          spellCheck={false}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(flat.length - 1, a + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              run(flat[active]);
            }
          }}
        />
      </div>
      <div className="shell-cmdk__list" ref={listRef} role="listbox">
        {flat.length === 0 && <div className="shell-cmdk__empty">{t('commandMenu.noResults')}</div>}
        {sections.map((section, si) => (
          <div key={`${section.title}-${si}`}>
            {section.title && <div className="shell-cmdk__section">{section.title}</div>}
            {section.items.map((item) => {
              index += 1;
              const i = index;
              return (
                <div
                  key={`${item.key}-${si}`}
                  role="option"
                  aria-selected={i === active}
                  className={clsx('shell-cmdk__item', i === active && 'is-active')}
                  onPointerMove={() => setActive(i)}
                  onClick={() => run(item)}
                >
                  <span className="shell-cmdk__icon">
                    {item.type === 'file' && item.path !== undefined ? (
                      <FileIcon kind={kindFromPath(item.path)} dark={theme === 'dark'} />
                    ) : (
                      <Icon name={item.icon ?? 'ChevronRight'} size={16} />
                    )}
                  </span>
                  <span className="shell-cmdk__label">{item.label}</span>
                  {item.detail && <span className="shell-cmdk__detail">{item.detail}</span>}
                  {item.shortcut && <Kbd>{item.shortcut}</Kbd>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Modal>
  );
}
