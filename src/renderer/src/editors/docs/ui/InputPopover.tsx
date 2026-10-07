import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FloatingPortal, autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/react';
import { Icon } from '@renderer/ui';

export interface InputPopoverProps {
  /** Screen rectangle to anchor under. */
  anchor: { left: number; right: number; top: number; bottom: number };
  initial?: string;
  placeholder: string;
  submitLabel: string;
  removeLabel?: string;
  /** Returns an error message, or null when the value is acceptable. */
  validate?: (value: string) => string | null;
  onSubmit: (value: string) => void;
  onRemove?: () => void;
  onCancel: () => void;
}

/** One-line input popover used for links and embeds. */
export function InputPopover({ anchor, initial = '', placeholder, submitLabel, removeLabel, validate, onSubmit, onRemove, onCancel }: InputPopoverProps): JSX.Element {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { refs, floatingStyles } = useFloating({
    placement: 'bottom-start',
    whileElementsMounted: autoUpdate,
    middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
  });

  useLayoutEffect(() => {
    refs.setPositionReference({
      getBoundingClientRect: () => ({
        x: anchor.left,
        y: anchor.top,
        left: anchor.left,
        top: anchor.top,
        right: anchor.right,
        bottom: anchor.bottom,
        width: anchor.right - anchor.left,
        height: anchor.bottom - anchor.top,
      }),
    });
  }, [anchor, refs]);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const submit = (): void => {
    const problem = validate?.(value) ?? null;
    if (problem) {
      setError(problem);
      return;
    }
    onSubmit(value);
  };

  return (
    <FloatingPortal>
      <div ref={refs.setFloating} style={floatingStyles} className="docs-link-popover" role="dialog">
        <input
          ref={inputRef}
          value={value}
          placeholder={placeholder}
          spellCheck={false}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              onCancel();
            }
          }}
          onBlur={(e) => {
            if (!e.relatedTarget || !e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) onCancel();
          }}
        />
        <button type="button" className="docs-popover-btn" onClick={submit} aria-label={submitLabel} title={submitLabel}>
          <Icon name="Check" size={16} />
        </button>
        {onRemove && (
          <button type="button" className="docs-popover-btn" onClick={onRemove} aria-label={removeLabel} title={removeLabel}>
            <Icon name="Unlink" size={16} />
          </button>
        )}
        {error && <span className="docs-link-error">{error}</span>}
      </div>
    </FloatingPortal>
  );
}
