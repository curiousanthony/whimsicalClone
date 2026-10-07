/**
 * Left vertical toolbar (Whimsical board toolbar). One button per toolbar group, built from
 * every plugin's tools for the current mode; groups with several tools open a flyout when the
 * active button is clicked again. The ".wdraw" preset shows the pen tools only.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from 'zustand';
import type { ToolbarGroup, ToolDefinition } from '@renderer/core/types';
import { translateKey } from '@renderer/i18n';
import type { CanvasEngine } from '../engine/engine';
import { Divider, IconButton } from './ui';

const SECTIONS: ReadonlyArray<readonly ToolbarGroup[]> = [
  ['select'],
  ['shapes', 'wireframeComponents', 'wireframeFrames', 'sticky', 'mindmap'],
  ['connector', 'text', 'section', 'table', 'image', 'link', 'icon', 'annotation'],
  ['freehand'],
];

export function Toolbar({ engine }: { engine: CanvasEngine }): JSX.Element {
  const { t } = useTranslation('canvas');
  const activeTool = useStore(engine.store, (s) => s.tool);
  const mode = useStore(engine.store, (s) => s.mode);
  const [flyout, setFlyout] = useState<ToolbarGroup | undefined>();
  const tools = engine.availableTools();
  const drawOnly = engine.preset.toolbar === 'draw';

  const byGroup = new Map<ToolbarGroup, ToolDefinition[]>();
  for (const tool of tools) {
    const list = byGroup.get(tool.group) ?? [];
    list.push(tool);
    byGroup.set(tool.group, list);
  }

  const activate = (tool: ToolDefinition) => {
    setFlyout(undefined);
    engine.setActiveTool(tool.id);
    engine.root?.focus({ preventScroll: true });
  };

  const renderGroup = (group: ToolbarGroup) => {
    const list = byGroup.get(group);
    if (!list || list.length === 0) return null;
    // Select and freehand (in pen-only files) show every tool; other groups collapse to one.
    if (group === 'select' || (group === 'freehand' && drawOnly)) {
      return list.map((tool) => (
        <IconButton
          key={tool.id}
          icon={tool.icon}
          label={translateKey(tool.labelKey)}
          shortcutId={tool.shortcutId}
          active={activeTool === tool.id}
          onClick={() => activate(tool)}
        />
      ));
    }
    const current = list.find((x) => x.id === activeTool) ?? list[0]!;
    const isActive = list.some((x) => x.id === activeTool);
    return (
      <div key={group} className="wc-toolbar__group">
        <IconButton
          icon={current.icon}
          label={translateKey(current.labelKey)}
          shortcutId={current.shortcutId}
          active={isActive}
          onClick={() => {
            if (isActive && list.length > 1) setFlyout((f) => (f === group ? undefined : group));
            else activate(current);
          }}
        >
          {list.length > 1 && <span className="wc-toolbar__more" aria-hidden />}
        </IconButton>
        {flyout === group && (
          <div className="wc-toolbar__flyout" data-wc-chrome="">
            {list.map((tool) => (
              <IconButton
                key={tool.id}
                icon={tool.icon}
                label={translateKey(tool.labelKey)}
                shortcutId={tool.shortcutId}
                active={activeTool === tool.id}
                onClick={() => activate(tool)}
                tooltipSide="top"
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="wc-toolbar" data-wc-chrome="" role="toolbar" aria-label={t('toolbar.tools')} onPointerDown={(e) => e.stopPropagation()}>
      {SECTIONS.map((section, i) => {
        const items = section.map(renderGroup).filter(Boolean);
        const wireToggle =
          i === 1 && !drawOnly ? (
            <IconButton
              key="wireframe"
              icon="AppWindow"
              label={mode === 'wireframe' ? t('toolbar.diagramMode') : t('toolbar.wireframeMode')}
              shortcutId={mode === 'wireframe' ? 'canvas.exitWireframe' : 'canvas.toggleWireframe'}
              active={mode === 'wireframe'}
              onClick={() => engine.setMode(mode === 'wireframe' ? 'diagram' : 'wireframe')}
            />
          ) : null;
        if (items.length === 0 && !wireToggle) return null;
        return (
          <div key={i} className="wc-toolbar__section">
            {i > 0 && <Divider />}
            {wireToggle}
            {items}
          </div>
        );
      })}
      {!drawOnly && (
        <div className="wc-toolbar__section">
          <Divider />
          <IconButton icon="Plus" label={t('toolbar.allTools')} shortcutId="canvas.allTools" onClick={() => engine.openPanel('canvas.allTools')} />
        </div>
      )}
    </div>
  );
}
