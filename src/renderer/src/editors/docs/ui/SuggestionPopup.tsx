import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { FloatingPortal, autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/react';
import type { SuggestionPopupState } from '../extensions/suggestion';

interface Props<T> {
  popup: SuggestionPopupState<T> | null;
  index: number;
  onHover: (i: number) => void;
  title?: string;
  emptyText?: string;
  renderItem: (item: T) => ReactNode;
  /** Hide the popup entirely when there is nothing to show. */
  hideWhenEmpty?: boolean;
}

/** Floating list anchored at the caret (slash menu, mentions, emoji). */
export function SuggestionPopup<T>({ popup, index, onHover, title, emptyText, renderItem, hideWhenEmpty }: Props<T>): JSX.Element | null {
  const { refs, floatingStyles } = useFloating({
    placement: 'bottom-start',
    whileElementsMounted: autoUpdate,
    middleware: [offset(6), flip({ padding: 8 }), shift({ padding: 8 })],
  });
  const listRef = useRef<HTMLDivElement>(null);
  const rect = popup?.clientRect?.() ?? null;

  useLayoutEffect(() => {
    if (!rect) return;
    refs.setPositionReference({ getBoundingClientRect: () => popup?.clientRect?.() ?? rect });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popup, refs]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [index, popup]);

  if (!popup || !rect) return null;
  if (hideWhenEmpty && popup.items.length === 0) return null;
  return (
    <FloatingPortal>
      <div
        ref={(node) => {
          refs.setFloating(node);
          (listRef as { current: HTMLDivElement | null }).current = node;
        }}
        style={floatingStyles}
        className="docs-popup"
        role="listbox"
        onMouseDown={(e) => e.preventDefault()}
      >
        {title && <div className="docs-popup-title">{title}</div>}
        {popup.items.length === 0 && emptyText && <div className="docs-popup-empty">{emptyText}</div>}
        {popup.items.map((item, i) => (
          <button
            key={i}
            type="button"
            role="option"
            className="docs-popup-item"
            aria-selected={i === index}
            onMouseEnter={() => onHover(i)}
            onClick={() => popup.select(item)}
          >
            {renderItem(item)}
          </button>
        ))}
      </div>
    </FloatingPortal>
  );
}
