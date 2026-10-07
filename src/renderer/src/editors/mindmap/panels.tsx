/**
 * Popover panels of the mind-map module: node icon picker (Shift+X) and link editor
 * (Cmd+Shift+U on a selected node; while editing, the text editor handles the shortcut).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CanvasApi, CanvasPanelProps, MindMapNodeElement, Point } from '@renderer/core/types';
import { selectedNodes } from './actions';
import { allIconNames, lucideIcon, searchIcons } from './icons';
import { linkOf, setLink } from './model';

export const ICON_PANEL_ID = 'mindmap.iconPicker';
export const LINK_PANEL_ID = 'mindmap.linkEditor';

const COLUMNS = 8;

/** Screen point just below the primary selected node (anchor of the panels). */
export function panelAnchor(api: CanvasApi): Point | undefined {
  const node = selectedNodes(api).pop();
  return node ? api.worldToScreen({ x: node.x, y: node.y + node.h + 12 }) : undefined;
}

export function IconPickerPanel({ api, onClose }: CanvasPanelProps): JSX.Element {
  const { t } = useTranslation('mindmap');
  const targets = useRef<MindMapNodeElement[]>(selectedNodes(api));
  const current = targets.current[0]?.icon;
  const [placement, setPlacement] = useState<'left' | 'right'>(current?.placement ?? 'left');
  // Whimsical searches icons by the node's own text by default.
  const initialQuery = useRef(
    (() => {
      const text = targets.current[0]?.text.blocks.map((b) => b.spans.map((s) => s.text).join('')).join(' ') ?? '';
      return text.length <= 24 && !text.includes(' ') ? text.toLowerCase() : '';
    })(),
  );
  const [query, setQuery] = useState(initialQuery.current);
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const names = useMemo(() => {
    const found = searchIcons(query, allIconNames(), 240);
    // The prefilled text matching nothing must not leave the picker empty.
    return found.length === 0 && query === initialQuery.current ? searchIcons('', allIconNames(), 240) : found;
  }, [query]);
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  const apply = (name: string | undefined, nextPlacement = placement): void => {
    const ids = new Set(targets.current.map((n) => n.id));
    api.update((d) => {
      for (const el of d.elements) {
        if (el.type !== 'mindmapNode' || !ids.has(el.id)) continue;
        if (name) el.icon = { name, placement: nextPlacement };
        else delete el.icon;
      }
    });
  };
  const pick = (name: string | undefined): void => {
    if (!name) return;
    apply(name);
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent): void => {
    const move = (delta: number) => {
      e.preventDefault();
      setIndex((i) => Math.max(0, Math.min(names.length - 1, i + delta)));
    };
    if (e.key === 'ArrowRight') move(1);
    else if (e.key === 'ArrowLeft') move(-1);
    else if (e.key === 'ArrowDown') move(COLUMNS);
    else if (e.key === 'ArrowUp') move(-COLUMNS);
    else if (e.key === 'Enter') {
      e.preventDefault();
      pick(names[index]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
    e.stopPropagation();
  };

  return (
    <div className="wc-panel wc-mm-panel" role="dialog" aria-label={t('iconPanel.title')} onKeyDown={onKeyDown}>
      <input
        ref={input}
        className="wc-mm-panel__input"
        placeholder={t('iconPanel.search')}
        value={query}
        spellCheck={false}
        onChange={(e) => {
          setQuery(e.target.value);
          setIndex(0);
        }}
      />
      <div className="wc-mm-panel__row">
        {(['left', 'right'] as const).map((p) => (
          <button
            key={p}
            type="button"
            className={`wc-mm-panel__button${placement === p ? ' is-active' : ''}`}
            onClick={() => {
              setPlacement(p);
              if (current) apply(current.name, p);
            }}
          >
            {t(p === 'left' ? 'contextBar.iconLeft' : 'contextBar.iconRight')}
          </button>
        ))}
        {current && (
          <button
            type="button"
            className="wc-mm-panel__button"
            onClick={() => {
              apply(undefined);
              onClose();
            }}
          >
            {t('iconPanel.remove')}
          </button>
        )}
      </div>
      {names.length === 0 ? (
        <div className="wc-panel__empty">{t('iconPanel.noResults')}</div>
      ) : (
        <div className="wc-mm-icon-grid" role="listbox" aria-label={t('iconPanel.title')}>
          {names.map((name, i) => {
            const Component = lucideIcon(name);
            if (!Component) return null;
            return (
              <button
                key={name}
                type="button"
                role="option"
                aria-selected={i === index}
                aria-label={name}
                title={name}
                className={`wc-mm-icon-grid__item${i === index ? ' is-active' : ''}`}
                ref={(el) => {
                  if (el && i === index) el.scrollIntoView({ block: 'nearest' });
                }}
                onClick={() => pick(name)}
                onMouseEnter={() => setIndex(i)}
              >
                <Component size={20} strokeWidth={1.75} aria-hidden />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Adds a scheme to bare addresses ("example.com" becomes "https://example.com"). */
export function normalizeUrl(raw: string): string | undefined {
  const value = raw.trim();
  if (!value) return undefined;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return value;
  return `https://${value}`;
}

export function LinkPanel({ api, onClose }: CanvasPanelProps): JSX.Element {
  const { t } = useTranslation('mindmap');
  const targets = useRef<MindMapNodeElement[]>(selectedNodes(api));
  const [value, setValue] = useState(() => (targets.current[0] ? (linkOf(targets.current[0].text) ?? '') : ''));
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);
  const apply = (href: string | undefined): void => {
    const ids = new Set(targets.current.map((n) => n.id));
    api.update((d) => {
      for (const el of d.elements) {
        if (el.type === 'mindmapNode' && ids.has(el.id)) el.text = setLink(el.text, href);
      }
    });
    onClose();
  };
  return (
    <div
      className="wc-panel wc-mm-panel"
      role="dialog"
      aria-label={t('linkPanel.title')}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          apply(normalizeUrl(value));
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
        e.stopPropagation();
      }}
    >
      <input
        ref={input}
        className="wc-mm-panel__input"
        placeholder={t('linkPanel.placeholder')}
        value={value}
        spellCheck={false}
        onChange={(e) => setValue(e.target.value)}
      />
      <div className="wc-mm-panel__row">
        <button type="button" className="wc-mm-panel__button" onClick={() => apply(normalizeUrl(value))}>
          {t('linkPanel.apply')}
        </button>
        {value && (
          <button type="button" className="wc-mm-panel__button" onClick={() => apply(undefined)}>
            {t('linkPanel.remove')}
          </button>
        )}
      </div>
    </div>
  );
}

export const mindmapPanels = {
  [ICON_PANEL_ID]: IconPickerPanel,
  [LINK_PANEL_ID]: LinkPanel,
};
