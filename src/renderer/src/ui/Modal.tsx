import { FloatingPortal } from '@floating-ui/react';
import { clsx } from 'clsx';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { IconButton } from './Button';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  /** Accessible label of the close button. */
  closeLabel: string;
  width?: number;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** Places the dialog near the top (command menu style) instead of centred. */
  position?: 'center' | 'top';
  hideHeader?: boolean;
}

/** Modal dialog with scrim. Escape and scrim click close it; keys never leak to the canvas. */
export function Modal({
  open,
  onClose,
  title,
  closeLabel,
  width = 480,
  children,
  footer,
  className,
  position = 'center',
  hideHeader,
}: ModalProps): JSX.Element | null {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousFocus = useRef<Element | null>(null);

  // The portal mounts its children after this component's effects, so focus from the
  // panel's ref callback instead of an effect.
  const setPanel = useCallback((panel: HTMLDivElement | null) => {
    panelRef.current = panel;
    if (!panel) return;
    const focusTarget = panel.querySelector<HTMLElement>(
      '[data-autofocus], input, textarea, select, button:not([data-close])',
    );
    (focusTarget ?? panel).focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement;
    return () => {
      const prev = previousFocus.current as HTMLElement | null;
      if (prev && typeof prev.focus === 'function' && document.contains(prev)) prev.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;
  return (
    <FloatingPortal>
      <div
        className={clsx('wc-modal-scrim', position === 'top' && 'is-top')}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          ref={setPanel}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          className={clsx('wc-modal', className)}
          style={{ width }}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !e.defaultPrevented) {
              e.preventDefault();
              onClose();
            }
            // Keep shortcuts other than app-wide ones (Cmd+...) from reaching the editor.
            if (!e.metaKey) e.stopPropagation();
          }}
        >
          {!hideHeader && (
            <div className="wc-modal__header">
              <div className="wc-modal__title">{title}</div>
              <IconButton data-close icon="X" label={closeLabel} size="sm" noTooltip onClick={onClose} />
            </div>
          )}
          <div className="wc-modal__body">{children}</div>
          {footer && <div className="wc-modal__footer">{footer}</div>}
        </div>
      </div>
    </FloatingPortal>
  );
}
