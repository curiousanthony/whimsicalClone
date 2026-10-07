/**
 * "Diagram shapes" menu (S): searchable grid of every shape with its shortcut. Picking a
 * shape arms its tool (click or drag on the canvas to place it, Enter places it at the
 * viewport centre). Keyboard model mirrors the engine's "All tools" panel.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShortcutLabel } from '@renderer/core/shortcuts';
import type { CanvasPanelProps, ShapeKind } from '@renderer/core/types';
import { shapePaint, ShapeSvg } from './ShapeRender';
import { SHAPE_KINDS, SHAPE_SPECS } from './shapes';
import './flowchart.css';

export const SHAPES_PANEL_ID = 'flowchart.shapesMenu';

/** Miniature drawn from the real shape geometry, fitted into a 56 x 40 tile. */
function Miniature({ kind }: { kind: ShapeKind }): JSX.Element {
  const size = SHAPE_SPECS[kind].defaultSize;
  const scale = Math.min(48 / size.w, 32 / Math.max(size.h, 1), 1);
  const w = Math.max(6, size.w * scale);
  const h = Math.max(kind === 'line' ? 6 : 6, size.h * scale);
  const paint = shapePaint(kind, 'slate', 'border', 'light');
  return (
    <span className="wc-fc-tile__art" style={{ width: w, height: h }}>
      <ShapeSvg kind={kind} w={w} h={h} seed={7} paint={{ ...paint, fill: 'var(--wc-bg-hover)', stroke: 'currentColor', detail: 'currentColor', strokeWidth: 1.5 }} />
    </span>
  );
}

function Tile({ kind, label, active, onPick }: { kind: ShapeKind; label: string; active: boolean; onPick: () => void }): JSX.Element {
  const shortcut = useShortcutLabel(`flowchart.${kind}`);
  return (
    <button type="button" role="option" aria-selected={active} className={`wc-fc-tile${active ? ' is-active' : ''}`} onClick={onPick} title={shortcut ? `${label}  ${shortcut}` : label}>
      <Miniature kind={kind} />
      <span className="wc-fc-tile__label">{label}</span>
      {shortcut && <kbd className="wc-fc-tile__kbd">{shortcut}</kbd>}
    </button>
  );
}

export function ShapesPanel({ api, onClose }: CanvasPanelProps): JSX.Element {
  const { t } = useTranslation('flowchart');
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);

  const kinds = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SHAPE_KINDS;
    return SHAPE_KINDS.filter((kind) => {
      const label = t(`commands.${kind}`).toLowerCase();
      const keywords = t(`keywords.${kind}`).toLowerCase();
      return label.includes(q) || keywords.includes(q);
    });
  }, [query, t]);

  const pick = (kind: ShapeKind | undefined) => {
    if (!kind) return;
    onClose();
    api.setActiveTool(`flowchart.${kind}`);
  };
  const columns = 3;

  return (
    <div className="wc-panel wc-fc-panel" role="dialog" aria-label={t('shapesMenu.title')}>
      <input
        ref={input}
        className="wc-panel__search"
        placeholder={t('shapesMenu.search')}
        aria-label={t('shapesMenu.search')}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIndex(0);
        }}
        onKeyDown={(e) => {
          const move = (delta: number) => {
            e.preventDefault();
            setIndex((i) => Math.max(0, Math.min(kinds.length - 1, i + delta)));
          };
          if (e.key === 'ArrowRight') move(1);
          else if (e.key === 'ArrowLeft') move(-1);
          else if (e.key === 'ArrowDown') move(columns);
          else if (e.key === 'ArrowUp') move(-columns);
          else if (e.key === 'Enter') {
            e.preventDefault();
            pick(kinds[index]);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }
        }}
      />
      <div className="wc-fc-grid" role="listbox" aria-label={t('shapesMenu.title')}>
        {kinds.length === 0 && <div className="wc-panel__empty">{t('shapesMenu.noResults')}</div>}
        {kinds.map((kind, i) => (
          <Tile key={kind} kind={kind} label={t(`commands.${kind}`)} active={i === index} onPick={() => pick(kind)} />
        ))}
      </div>
    </div>
  );
}
