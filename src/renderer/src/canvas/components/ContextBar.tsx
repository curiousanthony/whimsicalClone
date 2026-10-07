/**
 * Floating contextual toolbar above the selection (Whimsical context bar): the element type's
 * own ContextBar when the selection is homogeneous, then common controls (align/distribute
 * and group for multi-selections, lock, more menu).
 */

import { useTranslation } from 'react-i18next';
import { useStore } from 'zustand';
import { shortcutRegistry } from '@renderer/core/shortcuts';
import type { BoardElement, ContextBarProps } from '@renderer/core/types';
import { worldToScreen } from '../viewport';
import { isConnector } from '../scene';
import type { CanvasEngine } from '../engine/engine';
import { Divider, IconButton, MenuItem, Popover } from './ui';

const BAR_HEIGHT = 40;
const GAP = 14;

export function ContextBar({ engine }: { engine: CanvasEngine }): JSX.Element | null {
  const { t } = useTranslation('canvas');
  const doc = useStore(engine.store, (s) => s.doc);
  const selection = useStore(engine.store, (s) => s.selection);
  const interacting = useStore(engine.store, (s) => s.interacting);
  const editing = useStore(engine.store, (s) => s.editing);
  const viewport = useStore(engine.store, (s) => s.viewport);
  const size = useStore(engine.store, (s) => s.size);
  if (selection.length === 0 || interacting || editing) return null;

  const els = doc.elements.filter((e) => selection.includes(e.id));
  if (els.length === 0) return null;
  const bounds = engine.selectionBounds(els.map((e) => e.id));
  if (!bounds) return null;
  const topLeft = worldToScreen(viewport, bounds);
  const bottom = topLeft.y + bounds.h * viewport.zoom;
  const centerX = topLeft.x + (bounds.w * viewport.zoom) / 2;
  let top = topLeft.y - GAP - BAR_HEIGHT;
  if (top < 8) top = Math.min(size.h - BAR_HEIGHT - 8, bottom + GAP + 24);

  const types = new Set(els.map((e) => e.type));
  const firstType = els[0]!.type;
  const def = types.size === 1 ? engine.lookup(firstType) : undefined;
  const TypeBar = def?.ContextBar as React.ComponentType<ContextBarProps<BoardElement>> | undefined;
  const multi = els.filter((e) => !isConnector(e)).length > 1;
  const locked = els.every((e) => e.locked);
  const grouped = els.some((e) => e.groupId);
  const run = (id: string) => shortcutRegistry.run(id, { source: 'toolbar' });

  return (
    <div
      className="wc-context-bar"
      data-wc-chrome=""
      style={{ left: Math.max(8, Math.min(size.w - 8, centerX)), top }}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {TypeBar && !locked && (
        <>
          <TypeBar elements={els} api={engine} />
          <Divider vertical />
        </>
      )}
      {multi && !locked && (
        <>
          <Popover trigger={({ toggle, open }) => <IconButton icon="AlignStartVertical" label={t('contextBar.align')} onClick={toggle} active={open} size="sm" tooltipSide="top" />}>
            {(close) => (
              <div className="wc-menu" onClick={close}>
                <MenuItem icon="AlignStartVertical" label={t('commands.alignLeft')} onClick={() => run('canvas.alignLeft')} />
                <MenuItem icon="AlignCenterVertical" label={t('commands.alignCenterH')} onClick={() => run('canvas.alignCenterH')} />
                <MenuItem icon="AlignEndVertical" label={t('commands.alignRight')} onClick={() => run('canvas.alignRight')} />
                <MenuItem icon="AlignStartHorizontal" label={t('commands.alignTop')} onClick={() => run('canvas.alignTop')} />
                <MenuItem icon="AlignCenterHorizontal" label={t('commands.alignCenterV')} onClick={() => run('canvas.alignCenterV')} />
                <MenuItem icon="AlignEndHorizontal" label={t('commands.alignBottom')} onClick={() => run('canvas.alignBottom')} />
                {els.length > 2 && (
                  <>
                    <MenuItem icon="AlignHorizontalSpaceBetween" label={t('commands.distributeH')} onClick={() => run('canvas.distributeH')} />
                    <MenuItem icon="AlignVerticalSpaceBetween" label={t('commands.distributeV')} onClick={() => run('canvas.distributeV')} />
                  </>
                )}
              </div>
            )}
          </Popover>
          <IconButton
            icon={grouped ? 'Ungroup' : 'Group'}
            label={grouped ? t('contextBar.ungroup') : t('contextBar.group')}
            shortcutId={grouped ? 'canvas.ungroup' : 'canvas.group'}
            onClick={() => run(grouped ? 'canvas.ungroup' : 'canvas.group')}
            size="sm"
            tooltipSide="top"
          />
        </>
      )}
      <IconButton
        icon={locked ? 'LockOpen' : 'Lock'}
        label={locked ? t('contextBar.unlock') : t('contextBar.lock')}
        shortcutId="canvas.lock"
        active={locked}
        onClick={() => run('canvas.lock')}
        size="sm"
        tooltipSide="top"
      />
      {!locked && (
        <Popover trigger={({ toggle, open }) => <IconButton icon="Ellipsis" label={t('contextBar.more')} onClick={toggle} active={open} size="sm" tooltipSide="top" />}>
          {(close) => (
            <div className="wc-menu" onClick={close}>
              <MenuItem icon="BringToFront" label={t('commands.bringToFront')} shortcutId="canvas.bringToFront" onClick={() => run('canvas.bringToFront')} />
              <MenuItem label={t('commands.bringForward')} shortcutId="canvas.bringForward" onClick={() => run('canvas.bringForward')} />
              <MenuItem label={t('commands.sendBackward')} shortcutId="canvas.sendBackward" onClick={() => run('canvas.sendBackward')} />
              <MenuItem icon="SendToBack" label={t('commands.sendToBack')} shortcutId="canvas.sendToBack" onClick={() => run('canvas.sendToBack')} />
              <MenuItem icon="Copy" label={t('commands.duplicate')} shortcutId="canvas.duplicate" onClick={() => run('canvas.duplicate')} />
              <MenuItem icon="Paintbrush" label={t('commands.copyStyle')} shortcutId="canvas.copyStyle" onClick={() => run('canvas.copyStyle')} />
              <MenuItem icon="PaintBucket" label={t('commands.pasteStyle')} shortcutId="canvas.pasteStyle" onClick={() => run('canvas.pasteStyle')} />
              <MenuItem label={t('commands.saveDefaultStyle')} shortcutId="canvas.saveDefaultStyle" onClick={() => run('canvas.saveDefaultStyle')} />
              <MenuItem icon="Link" label={t('commands.copyLink')} shortcutId="canvas.copyLink" onClick={() => run('canvas.copyLink')} />
              {engine.lookup('section') && <MenuItem icon="SquareDashed" label={t('commands.wrapInSection')} onClick={() => run('canvas.wrapInSection')} />}
              <MenuItem icon="Grid3x3" label={t('commands.snapToGrid')} onClick={() => run('canvas.snapToGrid')} />
              <MenuItem icon="Trash2" label={t('commands.delete')} shortcutId="canvas.delete" onClick={() => run('canvas.delete')} />
            </div>
          )}
        </Popover>
      )}
    </div>
  );
}
