/**
 * Panel host: the engine's "All tools" menu (/) and popover panels contributed by plugins
 * (api.openPanel(id)), e.g. the shapes menu or the wireframe component launcher.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from 'zustand';
import type { CanvasPanelProps, ToolDefinition } from '@renderer/core/types';
import { translateKey } from '@renderer/i18n';
import type { CanvasEngine } from '../engine/engine';
import { Icon } from './ui';
import { useShortcutLabel } from '@renderer/core/shortcuts';

function ToolRow({ tool, active, onPick }: { tool: ToolDefinition; active: boolean; onPick: () => void }): JSX.Element {
  const shortcut = useShortcutLabel(tool.shortcutId ?? '');
  return (
    <button type="button" className={`wc-menu-item${active ? ' is-active' : ''}`} onClick={onPick} role="option" aria-selected={active}>
      <Icon name={tool.icon} size={16} />
      <span className="wc-menu-item__label">{translateKey(tool.labelKey)}</span>
      {shortcut && <kbd className="wc-menu-item__kbd">{shortcut}</kbd>}
    </button>
  );
}

/** Searchable list of every tool available in the current mode. */
export function AllToolsPanel({ api, onClose }: CanvasPanelProps): JSX.Element {
  const engine = api as CanvasEngine;
  const { t } = useTranslation('canvas');
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const tools = useMemo(() => {
    const q = query.trim().toLowerCase();
    return engine.availableTools().filter((tool) => {
      if (tool.group === 'select') return false;
      if (!q) return true;
      const label = translateKey(tool.labelKey).toLowerCase();
      const keywords = tool.keywordsKey ? translateKey(tool.keywordsKey).toLowerCase() : '';
      return label.includes(q) || keywords.includes(q);
    });
  }, [engine, query]);
  const pick = (tool: ToolDefinition | undefined) => {
    if (!tool) return;
    onClose();
    engine.setActiveTool(tool.id);
  };
  return (
    <div className="wc-panel wc-all-tools" role="dialog" aria-label={t('toolbar.allTools')}>
      <input
        ref={input}
        className="wc-panel__search"
        placeholder={t('allToolsPanel.search')}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIndex(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setIndex((i) => Math.min(tools.length - 1, i + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setIndex((i) => Math.max(0, i - 1));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            pick(tools[index]);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }
        }}
      />
      <div className="wc-menu wc-panel__list" role="listbox">
        {tools.length === 0 && <div className="wc-panel__empty">{t('allToolsPanel.noResults')}</div>}
        {tools.map((tool, i) => (
          <ToolRow key={tool.id} tool={tool} active={i === index} onPick={() => pick(tool)} />
        ))}
      </div>
    </div>
  );
}

export function PanelHost({ engine }: { engine: CanvasEngine }): JSX.Element | null {
  const panel = useStore(engine.store, (s) => s.panel);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!panel) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) engine.closePanel();
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, [panel, engine]);
  if (!panel) return null;
  let Component: React.ComponentType<CanvasPanelProps> | undefined = panel.id === 'canvas.allTools' ? AllToolsPanel : undefined;
  if (!Component) {
    for (const p of engine.getPlugins()) {
      const c = p.panels?.[panel.id];
      if (c) {
        Component = c;
        break;
      }
    }
  }
  if (!Component) return null;
  const anchor = panel.anchor;
  return (
    <div
      ref={ref}
      className="wc-panel-host"
      data-wc-chrome=""
      style={anchor ? { left: anchor.x, top: anchor.y } : undefined}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Component api={engine} onClose={() => engine.closePanel()} anchor={anchor} />
    </div>
  );
}
