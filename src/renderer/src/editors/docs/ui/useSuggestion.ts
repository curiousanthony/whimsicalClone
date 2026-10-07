import { useMemo, useRef, useState } from 'react';
import type { SuggestionBridge, SuggestionPopupState } from '../extensions/suggestion';

export interface UseSuggestion<T> {
  bridge: SuggestionBridge<T>;
  popup: SuggestionPopupState<T> | null;
  index: number;
  setIndex: (i: number) => void;
}

/** React state for one suggestion popup (slash menu, mention, emoji), with keyboard handling. */
export function useSuggestion<T>(): UseSuggestion<T> {
  const [popup, setPopup] = useState<SuggestionPopupState<T> | null>(null);
  const [index, setIndexState] = useState(0);
  const popupRef = useRef<SuggestionPopupState<T> | null>(null);
  const indexRef = useRef(0);

  const setIndex = (i: number): void => {
    indexRef.current = i;
    setIndexState(i);
  };

  const bridge = useMemo<SuggestionBridge<T>>(() => {
    const apply = (state: SuggestionPopupState<T> | null, resetIndex: boolean): void => {
      popupRef.current = state;
      setPopup(state);
      if (resetIndex || (state && indexRef.current >= state.items.length)) {
        indexRef.current = 0;
        setIndexState(0);
      }
    };
    return {
      onStart: (state) => apply(state, true),
      onUpdate: (state) => apply(state, false),
      onExit: () => apply(null, true),
      onKeyDown: (event) => {
        const current = popupRef.current;
        if (!current || current.items.length === 0) return false;
        const count = current.items.length;
        if (event.key === 'ArrowDown') {
          setIndex((indexRef.current + 1) % count);
          return true;
        }
        if (event.key === 'ArrowUp') {
          setIndex((indexRef.current - 1 + count) % count);
          return true;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          const item = current.items[indexRef.current];
          if (item !== undefined) current.select(item);
          return true;
        }
        return false;
      },
    };
  }, []);

  return { bridge, popup, index, setIndex };
}
