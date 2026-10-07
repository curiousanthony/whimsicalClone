/**
 * Contextual toolbar of mind-map nodes (Whimsical context bar, research 02 section 4.1):
 * map options on a root (orientation, line style), branch colour, bold / italic, link, icon
 * and collapse. Common controls (lock, more, align...) are added by the canvas.
 */

import { useTranslation } from 'react-i18next';
import { ColorSwatches, Divider, IconButton, Popover } from '@renderer/canvas';
import { resolveColor } from '@renderer/core/palette';
import type { ColorRef, ContextBarProps, MindMapNodeElement, RichText } from '@renderer/core/types';
import { toggleCollapsedSelection } from './actions';
import { ICON_PANEL_ID, LINK_PANEL_ID, panelAnchor } from './panels';
import { childIds, buildTreeIndex, linkOf, lineStyleOf, orientationOf, rebalanceSides, setBranchColor, setMapOptions, toggleMark } from './model';

function allMarked(text: RichText, mark: 'bold' | 'italic'): boolean {
  const spans = text.blocks.flatMap((b) => b.spans).filter((s) => s.text !== '');
  return spans.length > 0 && spans.every((s) => s.marks?.includes(mark));
}

export function MindContextBar({ elements, api }: ContextBarProps<MindMapNodeElement>): JSX.Element {
  const { t } = useTranslation('mindmap');
  const theme = api.theme;
  const roots = elements.filter((e) => e.treeParentId === null);
  const first = elements[0]!;
  const index = buildTreeIndex(api.getDocument().elements);
  const hasChildren = elements.some((e) => childIds(index, e.id).length > 0);
  const allCollapsed = elements.every((e) => e.collapsed || childIds(index, e.id).length === 0);
  const orientation = orientationOf(roots[0]);
  const lineStyle = lineStyleOf(roots[0]);
  const color = first.color ?? 'slate';
  const bold = elements.every((e) => allMarked(e.text, 'bold'));
  const italic = elements.every((e) => allMarked(e.text, 'italic'));
  const link = elements.some((e) => linkOf(e.text));
  const withIcon = elements.some((e) => e.icon);
  const rootIds = roots.map((r) => r.id);
  const ids = elements.map((e) => e.id);

  // Which sides the first-level branches use ('both' when mixed): the left / right / both layout.
  const sideMode = (() => {
    if (!roots[0]) return 'both';
    const sides = new Set(childIds(index, roots[0].id).map((c) => index.nodes.get(c)?.side));
    return sides.size === 1 ? [...sides][0] : 'both';
  })();
  const setSides = (mode: 'both' | 'right' | 'left' | 'bottom' | 'top') =>
    api.update((d) => {
      for (const id of rootIds) rebalanceSides(d, id, mode);
    });

  const setMap = (patch: Parameters<typeof setMapOptions>[2]) =>
    api.update((d) => {
      for (const id of rootIds) setMapOptions(d, id, patch);
    });
  const mark = (m: 'bold' | 'italic') =>
    api.update((d) => {
      for (const el of d.elements) {
        if (el.type === 'mindmapNode' && ids.includes(el.id)) el.text = toggleMark(el.text, m);
      }
    });

  return (
    <>
      {roots.length > 0 && (
        <>
          <IconButton
            icon="AlignHorizontalSpaceAround"
            label={t('contextBar.horizontal')}
            active={orientation === 'horizontal'}
            size="sm"
            tooltipSide="top"
            onClick={() => setMap({ orientation: 'horizontal' })}
          />
          <IconButton
            icon="AlignVerticalSpaceAround"
            label={t('contextBar.vertical')}
            active={orientation === 'vertical'}
            size="sm"
            tooltipSide="top"
            onClick={() => setMap({ orientation: 'vertical' })}
          />
          <IconButton
            icon="Spline"
            label={t('contextBar.curved')}
            active={lineStyle === 'curved'}
            size="sm"
            tooltipSide="top"
            onClick={() => setMap({ lineStyle: 'curved' })}
          />
          <IconButton
            icon="CornerDownRight"
            label={t('contextBar.elbow')}
            active={lineStyle === 'elbow'}
            size="sm"
            tooltipSide="top"
            onClick={() => setMap({ lineStyle: 'elbow' })}
          />
          <Divider vertical />
          {(orientation === 'horizontal'
            ? ([
                ['both', 'ArrowLeftRight', 'contextBar.sidesBoth'],
                ['right', 'ArrowRight', 'contextBar.sidesRight'],
                ['left', 'ArrowLeft', 'contextBar.sidesLeft'],
              ] as const)
            : ([
                ['both', 'ArrowUpDown', 'contextBar.sidesBoth'],
                ['bottom', 'ArrowDown', 'contextBar.sidesBottom'],
                ['top', 'ArrowUp', 'contextBar.sidesTop'],
              ] as const)
          ).map(([mode, icon, label]) => (
            <IconButton
              key={mode}
              icon={icon}
              label={t(label)}
              active={sideMode === mode}
              size="sm"
              tooltipSide="top"
              onClick={() => setSides(mode)}
            />
          ))}
          <Divider vertical />
        </>
      )}
      <Popover
        trigger={({ toggle, open }) => (
          <IconButton
            icon="Palette"
            label={roots.length > 0 ? t('contextBar.color') : t('contextBar.branchColor')}
            active={open}
            size="sm"
            tooltipSide="top"
            onClick={toggle}
          >
            <span className="wc-mm-swatch-dot" style={{ background: resolveColor(color, 'fill', theme) }} />
          </IconButton>
        )}
      >
        {(close) => (
          <ColorSwatches
            value={color}
            theme={theme}
            role="fill"
            exclude={['white', 'smoke']}
            customColors={api.getDocument().settings.customColors}
            onChange={(c: ColorRef) => {
              api.update((d) => {
                for (const id of ids) setBranchColor(d, id, c);
              });
              close();
            }}
          />
        )}
      </Popover>
      <Divider vertical />
      <IconButton icon="Bold" label={t('contextBar.bold')} active={bold} size="sm" tooltipSide="top" onClick={() => mark('bold')} />
      <IconButton icon="Italic" label={t('contextBar.italic')} active={italic} size="sm" tooltipSide="top" onClick={() => mark('italic')} />
      <IconButton
        icon="Link"
        label={t('contextBar.link')}
        shortcutId="mindmap.addLink"
        active={link}
        size="sm"
        tooltipSide="top"
        onClick={() => api.openPanel(LINK_PANEL_ID, { anchor: panelAnchor(api) })}
      />
      <IconButton
        icon="Smile"
        label={t('contextBar.icon')}
        shortcutId="mindmap.addIcon"
        active={withIcon}
        size="sm"
        tooltipSide="top"
        onClick={() => api.openPanel(ICON_PANEL_ID, { anchor: panelAnchor(api) })}
      />
      {hasChildren && (
        <>
          <Divider vertical />
          <IconButton
            icon={allCollapsed ? 'ChevronsUpDown' : 'ChevronsDownUp'}
            label={allCollapsed ? t('tooltips.expand') : t('tooltips.collapse')}
            shortcutId="mindmap.toggleCollapse"
            size="sm"
            tooltipSide="top"
            onClick={() => toggleCollapsedSelection(api)}
          />
        </>
      )}
    </>
  );
}
