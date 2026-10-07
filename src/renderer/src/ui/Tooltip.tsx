/**
 * Hover tooltip (Whimsical style: dark pill with the label and its shortcut).
 */

import {
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useRole,
  type Placement,
} from '@floating-ui/react';
import { cloneElement, isValidElement, useState, type ReactElement } from 'react';
import { Kbd } from './Kbd';

export interface TooltipProps {
  label: string;
  shortcut?: string | undefined;
  placement?: Placement;
  children: ReactElement;
  disabled?: boolean;
}

export function Tooltip({ label, shortcut, placement = 'bottom', children, disabled }: TooltipProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const { refs, floatingStyles, context } = useFloating({
    open: open && !disabled,
    onOpenChange: setOpen,
    placement,
    whileElementsMounted: autoUpdate,
    middleware: [offset(6), flip(), shift({ padding: 6 })],
  });
  const hover = useHover(context, { delay: { open: 450, close: 0 }, move: false });
  const focus = useFocus(context, { visibleOnly: true });
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'tooltip' });
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus, dismiss, role]);

  if (!isValidElement(children)) return children;
  const child = children as ReactElement<Record<string, unknown>>;
  return (
    <>
      {cloneElement(child, getReferenceProps({ ref: refs.setReference, ...child.props }))}
      {open && !disabled && (
        <FloatingPortal>
          <div ref={refs.setFloating} className="wc-tooltip" style={floatingStyles} {...getFloatingProps()}>
            <span>{label}</span>
            {shortcut && <Kbd>{shortcut}</Kbd>}
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
