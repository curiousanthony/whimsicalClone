import { useMemo, useRef, useState } from 'react';
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useTranslation } from 'react-i18next';
import { Icon, Menu, type MenuEntry } from '@renderer/ui';
import { CALLOUT_COLORS, CALLOUT_ICONS, CALLOUT_PRESETS } from '../markdown/constants';

export function CalloutView({ node, updateAttributes, editor, getPos }: NodeViewProps): JSX.Element {
  const { t } = useTranslation('docs');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const color = String(node.attrs.color ?? 'blue');
  const icon = String(node.attrs.icon ?? 'info');

  const colorLabel = (c: string): string => t(`callout.colors.${c as 'blue'}`);

  const presetLabel = (id: string): string =>
    id === 'error' ? t('callout.presetError') : id === 'tip' ? t('callout.presetTip') : id === 'warning' ? t('callout.presetWarning') : t('callout.presetInfo');

  const items = useMemo<MenuEntry[]>(
    () => [
      { type: 'label', label: t('callout.presets') },
      ...CALLOUT_PRESETS.map<MenuEntry>((p) => ({
        type: 'item',
        label: presetLabel(p.id),
        icon: p.icon,
        checked: p.color === color && p.icon === icon,
        onSelect: () => updateAttributes({ color: p.color, icon: p.icon }),
      })),
      { type: 'separator' },
      {
        type: 'submenu',
        label: t('callout.changeColor'),
        icon: 'Palette',
        items: CALLOUT_COLORS.map<MenuEntry>((c) => ({
          type: 'item',
          label: colorLabel(c),
          checked: c === color,
          onSelect: () => updateAttributes({ color: c }),
        })),
      },
      {
        type: 'submenu',
        label: t('callout.changeIcon'),
        icon: 'Smile',
        items: CALLOUT_ICONS.map<MenuEntry>((name) => ({
          type: 'item',
          label: name,
          icon: name,
          checked: name === icon,
          onSelect: () => updateAttributes({ icon: name }),
        })),
      },
      { type: 'separator' },
      {
        type: 'item',
        label: t('callout.remove'),
        icon: 'Trash2',
        danger: true,
        onSelect: () => {
          const pos = getPos();
          if (typeof pos !== 'number') return;
          editor
            .chain()
            .focus()
            .setTextSelection(pos + 2)
            .unsetCallout()
            .run();
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, color, icon, updateAttributes, editor, getPos],
  );

  return (
    <NodeViewWrapper className="wc-callout" data-color={color} data-icon={icon}>
      <button
        ref={buttonRef}
        type="button"
        className="wc-callout-icon"
        contentEditable={false}
        aria-label={t('callout.changeIcon')}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name={icon} size={18} />
      </button>
      <NodeViewContent className="wc-callout-body" />
      {open && buttonRef.current && <Menu items={items} anchor={buttonRef.current} onClose={() => setOpen(false)} />}
    </NodeViewWrapper>
  );
}
