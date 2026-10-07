/** Icon picker (X): searchable lucide library; Enter / click inserts or replaces the icon. */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CanvasPanelProps } from '@renderer/core/types';
import { allIconNames, lucideIcon, searchIcons } from '../iconLibrary';
import { createIconElement } from '../model';
import { snapToGridPoint, viewCentre } from '../viewHelpers';
import { takeIconPickerRequest, type IconPickerRequest } from './iconPickerState';

const COLUMNS = 8;

export function IconPickerPanel({ api, onClose }: CanvasPanelProps): JSX.Element {
  const { t } = useTranslation('board');
  const request = useRef<IconPickerRequest>();
  if (!request.current) request.current = takeIconPickerRequest();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const names = useMemo(() => searchIcons(query, allIconNames(), 240), [query]);
  useEffect(() => input.current?.focus(), []);

  const pick = (name: string | undefined) => {
    if (!name) return;
    const req = request.current ?? {};
    onClose();
    if (req.replaceId) {
      api.update((d) => {
        const el = d.elements.find((e) => e.id === req.replaceId);
        if (el && el.type === 'icon') el.icon = name;
      });
      return;
    }
    const at = snapToGridPoint(api, req.at ?? viewCentre(api));
    const icon = createIconElement({ id: api.createId(), x: at.x, y: at.y, icon: name, style: api.getStyleFor('icon') });
    api.update((d) => {
      d.elements.push(icon);
    });
    api.setSelection([icon.id]);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
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
      e.stopPropagation();
      onClose();
    }
    e.stopPropagation();
  };

  return (
    <div className="wc-panel wc-board-icon-picker" role="dialog" aria-label={t('iconPicker.title')} onKeyDown={onKeyDown}>
      <input
        ref={input}
        className="wc-panel__search"
        placeholder={t('iconPicker.search')}
        value={query}
        spellCheck={false}
        onChange={(e) => {
          setQuery(e.target.value);
          setIndex(0);
        }}
      />
      {names.length === 0 ? (
        <div className="wc-panel__empty">{t('iconPicker.noResults')}</div>
      ) : (
        <div className="wc-board-icon-grid" role="listbox" aria-label={t('iconPicker.title')}>
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
                className={`wc-board-icon-grid__item${i === index ? ' is-active' : ''}`}
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
