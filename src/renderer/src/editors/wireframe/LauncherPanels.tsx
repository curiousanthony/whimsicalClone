/**
 * Component launcher (E) and frame launcher (F): searchable vertical menus with an
 * auto-focused search field and a fixed order (research 05 section 2.4). Picking an entry arms
 * its place tool: click or drag on the canvas to place it, Enter places it at the viewport
 * centre. In the frame launcher a digit (1-9) picks the numbered device while the search is
 * empty ("F" then "1").
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@renderer/canvas';
import { useShortcutLabel } from '@renderer/core/shortcuts';
import type { CanvasPanelProps, DeviceKind } from '@renderer/core/types';
import { translateKey } from '@renderer/i18n';
import { FRAME_LAUNCHER_ORDER, deviceForDigit, launcherDigit, specOf } from './frames';
import { filterLauncher, filterDevices } from './launcherModel';
import { LAUNCHER_ENTRIES } from './registry';
import { toolIdForDevice, toolIdForEntry } from './tools';
import './wireframe.css';

const SELECT_TOOL = 'canvas.selectTool';

function ShortcutHint({ id }: { id?: string }): JSX.Element | null {
  const label = useShortcutLabel(id ?? '');
  return label ? <kbd className="wc-menu-item__kbd">{label}</kbd> : null;
}

const KEYED_COMMAND: Readonly<Record<string, string>> = {
  rectangle: 'wireframe.rectangle',
  button: 'wireframe.button',
  image: 'wireframe.image',
  input: 'wireframe.input',
  avatar: 'wireframe.avatar',
  circle: 'wireframe.circle',
  line: 'wireframe.line',
};

export function ComponentsPanel({ api, onClose }: CanvasPanelProps): JSX.Element {
  const { t } = useTranslation('wireframe');
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const entries = useMemo(() => filterLauncher(LAUNCHER_ENTRIES, query, translateKey), [query]);
  const pick = (id: string | undefined) => {
    if (!id) return;
    onClose();
    api.setActiveTool(toolIdForEntry(id));
  };
  const dismiss = () => {
    api.setActiveTool(SELECT_TOOL);
    onClose();
  };
  return (
    <div className="wc-panel wf-panel" role="dialog" aria-label={t('launcher.components')}>
      <input
        ref={input}
        className="wc-panel__search"
        placeholder={t('launcher.searchComponents')}
        aria-label={t('launcher.searchComponents')}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIndex(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setIndex((i) => Math.min(entries.length - 1, i + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setIndex((i) => Math.max(0, i - 1));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            pick(entries[index]?.id);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            dismiss();
          }
        }}
      />
      <div className="wf-list wc-menu" role="listbox" aria-label={t('launcher.components')}>
        {entries.length === 0 && <div className="wc-panel__empty">{t('launcher.noResults')}</div>}
        {entries.map((entry, i) => (
          <button
            key={entry.id}
            type="button"
            role="option"
            aria-selected={i === index}
            className={`wc-menu-item${i === index ? ' is-active' : ''}`}
            onClick={() => pick(entry.id)}
            onMouseMove={() => setIndex(i)}
          >
            <Icon name={entry.icon} size={16} />
            <span className="wc-menu-item__label">{translateKey(entry.labelKey)}</span>
            <ShortcutHint id={KEYED_COMMAND[entry.id]} />
          </button>
        ))}
      </div>
    </div>
  );
}

export function FramesPanel({ api, onClose }: CanvasPanelProps): JSX.Element {
  const { t } = useTranslation('wireframe');
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const devices = useMemo(() => filterDevices(FRAME_LAUNCHER_ORDER, query, translateKey), [query]);
  const pick = (device: DeviceKind | undefined) => {
    if (!device) return;
    onClose();
    api.setActiveTool(toolIdForDevice(device));
  };
  const dismiss = () => {
    api.setActiveTool(SELECT_TOOL);
    onClose();
  };
  return (
    <div className="wc-panel wf-panel" role="dialog" aria-label={t('launcher.frames')}>
      <input
        ref={input}
        className="wc-panel__search"
        placeholder={t('launcher.searchFrames')}
        aria-label={t('launcher.searchFrames')}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIndex(0);
        }}
        onKeyDown={(e) => {
          const digit = query === '' && !e.metaKey && !e.ctrlKey && !e.altKey ? deviceForDigit(e.key) : undefined;
          if (digit) {
            // preventDefault: the digit must not reach the zoom shortcuts or the search field.
            e.preventDefault();
            pick(digit);
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setIndex((i) => Math.min(devices.length - 1, i + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setIndex((i) => Math.max(0, i - 1));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            pick(devices[index]);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            dismiss();
          }
        }}
      />
      <div className="wf-list wc-menu" role="listbox" aria-label={t('launcher.frames')}>
        {devices.length === 0 && <div className="wc-panel__empty">{t('launcher.noResults')}</div>}
        {devices.map((device, i) => {
          const spec = specOf(device);
          return (
            <button
              key={device}
              type="button"
              role="option"
              aria-selected={i === index}
              className={`wc-menu-item${i === index ? ' is-active' : ''}`}
              onClick={() => pick(device)}
              onMouseMove={() => setIndex(i)}
            >
              <span className="wf-digit">{launcherDigit(device)}</span>
              <Icon name={spec.icon} size={16} />
              <span className="wc-menu-item__label">{t(`frames.${device}`)}</span>
              <span className="wf-device">
                {t('launcher.dimensions', { width: spec.screen.w, height: spec.screen.h })}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
