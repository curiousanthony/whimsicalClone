import { useTranslation } from 'react-i18next';
import { IconButton } from '@renderer/ui';
import { activeOutlineIndex, outlineDepth, type OutlineItem } from '../logic/outline';

interface Props {
  items: readonly OutlineItem[];
  caretPos: number;
  onSelect: (item: OutlineItem) => void;
  onClose: () => void;
}

export function TocPanel({ items, caretPos, onSelect, onClose }: Props): JSX.Element {
  const { t } = useTranslation('docs');
  const active = activeOutlineIndex(items, caretPos);
  return (
    <aside className="docs-toc" aria-label={t('toc.title')}>
      <div className="docs-toc-head">
        <span>{t('toc.title')}</span>
        <IconButton icon="X" label={t('toc.hide')} size="sm" onClick={onClose} />
      </div>
      {items.length === 0 ? (
        <div className="docs-toc-empty">{t('toc.empty')}</div>
      ) : (
        <nav className="docs-toc-list">
          {items.map((item) => (
            <button
              key={item.index}
              type="button"
              className="docs-toc-item"
              aria-current={item.index === active}
              style={{ paddingLeft: 8 + outlineDepth(items, item) * 14 }}
              onClick={() => onSelect(item)}
              title={item.text}
            >
              {item.text}
            </button>
          ))}
        </nav>
      )}
    </aside>
  );
}
