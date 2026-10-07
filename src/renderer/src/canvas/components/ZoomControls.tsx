/** Bottom-right cluster: pan (hand) toggle, zoom out / % / in, fit, command menu, help. */

import { useTranslation } from 'react-i18next';
import { useStore } from 'zustand';
import { shortcutRegistry } from '@renderer/core/shortcuts';
import { stepZoom } from '../viewport';
import { PAN_TOOL, SELECT_TOOL, type CanvasEngine } from '../engine/engine';
import { Divider, IconButton } from './ui';

export function ZoomControls({ engine }: { engine: CanvasEngine }): JSX.Element {
  const { t } = useTranslation('canvas');
  const zoom = useStore(engine.store, (s) => s.viewport.zoom);
  const tool = useStore(engine.store, (s) => s.tool);
  return (
    <div className="wc-zoom" data-wc-chrome="" onPointerDown={(e) => e.stopPropagation()}>
      <IconButton
        icon="Hand"
        label={t('toolbar.pan')}
        shortcutId="canvas.panGesture"
        active={tool === PAN_TOOL}
        onClick={() => engine.setActiveTool(tool === PAN_TOOL ? SELECT_TOOL : PAN_TOOL)}
        size="sm"
        tooltipSide="top"
      />
      <Divider vertical />
      <IconButton icon="Minus" label={t('toolbar.zoomOut')} shortcutId="canvas.zoomOut" onClick={() => engine.zoomTo(stepZoom(zoom, -1))} size="sm" tooltipSide="top" />
      <button
        type="button"
        className="wc-zoom__value"
        data-tooltip={t('toolbar.zoomReset')}
        data-tooltip-side="top"
        onClick={() => engine.zoomTo(1)}
        onDoubleClick={() => engine.zoomToFit('content')}
      >
        {t('toolbar.zoomPercent', { value: Math.round(zoom * 100) })}
      </button>
      <IconButton icon="Plus" label={t('toolbar.zoomIn')} shortcutId="canvas.zoomIn" onClick={() => engine.zoomTo(stepZoom(zoom, 1))} size="sm" tooltipSide="top" />
      <IconButton icon="Maximize" label={t('toolbar.zoomToFit')} shortcutId="canvas.zoomToFit" onClick={() => engine.zoomToFit('content')} size="sm" tooltipSide="top" />
      <Divider vertical />
      <IconButton
        icon="Command"
        label={t('toolbar.commandMenu')}
        shortcutId="app.commandMenu"
        onClick={() => shortcutRegistry.run('app.commandMenu', { source: 'toolbar' })}
        size="sm"
        tooltipSide="top"
      />
      <IconButton
        icon="CircleHelp"
        label={t('toolbar.help')}
        shortcutId="app.shortcutsHelp"
        onClick={() => shortcutRegistry.run('app.shortcutsHelp', { source: 'toolbar' })}
        size="sm"
        tooltipSide="top"
      />
    </div>
  );
}
