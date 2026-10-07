/**
 * Lucide icon picker used by wireframe context bars (button / input / avatar / tab icons,
 * annotation icon). Auto-focused search, stored value is the kebab-case icon name.
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { allIconNames, lucideByName, searchIcons } from './icons';
import './wireframe.css';

export function IconPicker({ value, onPick }: { value?: string; onPick: (name: string) => void }): JSX.Element {
  const { t } = useTranslation('wireframe');
  const [query, setQuery] = useState('');
  const names = useMemo(() => searchIcons(query, allIconNames(), 98), [query]);
  return (
    <div className="wf-pop" style={{ width: 268 }}>
      <input
        autoFocus
        className="wf-field"
        placeholder={t('contextBar.searchIcons')}
        aria-label={t('contextBar.searchIcons')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && names[0]) {
            e.preventDefault();
            onPick(names[0]);
          }
        }}
      />
      <div className="wf-icon-grid" role="listbox" aria-label={t('contextBar.icon')}>
        {names.map((name) => {
          const Icon = lucideByName(name);
          if (!Icon) return null;
          return (
            <button
              key={name}
              type="button"
              role="option"
              aria-selected={name === value}
              className={`wf-icon-cell${name === value ? ' is-active' : ''}`}
              title={name}
              onClick={() => onPick(name)}
            >
              <Icon size={18} strokeWidth={1.75} aria-hidden />
            </button>
          );
        })}
      </div>
      {value && (
        <button type="button" className="wf-seg-btn" onClick={() => onPick('')}>
          {t('contextBar.noIcon')}
        </button>
      )}
    </div>
  );
}
