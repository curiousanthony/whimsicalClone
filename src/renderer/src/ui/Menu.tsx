/**
 * Dropdown / context menu (Whimsical style: white rounded panel, icon + label + shortcut).
 * Opens at a point (context menu) or below an element (dropdown). Keyboard: arrows, Return,
 * Escape, ArrowRight / ArrowLeft for submenus. Key events never reach the global shortcut
 * registry while the menu has focus.
 */

import { FloatingPortal, autoUpdate, flip, offset, shift, useFloating, type Placement } from '@floating-ui/react';
import { clsx } from 'clsx';
import { Check, ChevronRight } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Icon } from './Icon';
import { Kbd } from './Kbd';

export type MenuEntry =
  | {
      type: 'item';
      label: string;
      icon?: string;
      iconColor?: string;
      shortcut?: string | undefined;
      onSelect: () => void;
      disabled?: boolean;
      danger?: boolean;
      checked?: boolean;
    }
  | { type: 'submenu'; label: string; icon?: string; iconColor?: string; items: MenuEntry[]; disabled?: boolean }
  | { type: 'separator' }
  | { type: 'label'; label: string };

export type MenuAnchor = { x: number; y: number } | HTMLElement;

export interface MenuProps {
  items: MenuEntry[];
  anchor: MenuAnchor;
  onClose: () => void;
  placement?: Placement;
  /** Nested menus close only themselves on ArrowLeft. */
  nested?: boolean;
  /** Closes the whole menu tree (set on nested menus). */
  onCloseAll?: () => void;
  className?: string;
  header?: ReactNode;
}

function isInteractive(e: MenuEntry): e is Extract<MenuEntry, { type: 'item' | 'submenu' }> {
  return (e.type === 'item' || e.type === 'submenu') && !e.disabled;
}

export function Menu({
  items,
  anchor,
  onClose,
  placement,
  nested,
  onCloseAll,
  className,
  header,
}: MenuProps): JSX.Element {
  const reference = useMemo(() => {
    if (anchor instanceof HTMLElement) return anchor;
    const { x, y } = anchor;
    return { getBoundingClientRect: () => ({ x, y, left: x, top: y, right: x, bottom: y, width: 0, height: 0 }) };
  }, [anchor]);
  const { refs, floatingStyles } = useFloating({
    placement: placement ?? (anchor instanceof HTMLElement ? 'bottom-start' : 'right-start'),
    whileElementsMounted: autoUpdate,
    middleware: [offset(anchor instanceof HTMLElement ? 4 : 2), flip({ padding: 8 }), shift({ padding: 8 })],
  });
  useLayoutEffect(() => {
    refs.setReference(reference as Element);
  }, [reference, refs]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const focusedOnce = useRef(false);
  const [active, setActive] = useState(-1);
  const [openSub, setOpenSub] = useState<number | null>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    if (nested) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (target?.closest('.wc-menu')) return;
      onClose();
    };
    const onBlur = () => onClose();
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('blur', onBlur);
    };
  }, [nested, onClose]);

  const move = (delta: number) => {
    const count = items.length;
    if (count === 0) return;
    let i = active;
    for (let step = 0; step < count; step += 1) {
      i = (i + delta + count) % count;
      const entry = items[i];
      if (entry && isInteractive(entry)) {
        setActive(i);
        itemRefs.current[i]?.scrollIntoView({ block: 'nearest' });
        return;
      }
    }
  };

  const activate = (index: number) => {
    const entry = items[index];
    if (!entry || !isInteractive(entry)) return;
    if (entry.type === 'submenu') {
      setOpenSub(index);
      return;
    }
    (onCloseAll ?? onClose)();
    entry.onSelect();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (openSub !== null) return; // the submenu handles keys
    e.stopPropagation();
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        move(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        move(-1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (active >= 0) activate(active);
        break;
      case 'ArrowRight':
        if (active >= 0 && items[active]?.type === 'submenu') {
          e.preventDefault();
          setOpenSub(active);
        }
        break;
      case 'ArrowLeft':
        if (nested) {
          e.preventDefault();
          onClose();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
      case 'Tab':
        e.preventDefault();
        break;
      default:
        break;
    }
  };

  return (
    <FloatingPortal>
      <div
        ref={(el) => {
          // Focus on first mount (the portal renders after this component's effects).
          if (el && !focusedOnce.current) {
            focusedOnce.current = true;
            el.focus({ preventScroll: true });
          }
          containerRef.current = el;
          refs.setFloating(el);
        }}
        role="menu"
        tabIndex={-1}
        className={clsx('wc-menu', className)}
        style={floatingStyles}
        onKeyDown={onKeyDown}
        onContextMenu={(e) => e.preventDefault()}
      >
        {header}
        {items.map((entry, index) => {
          if (entry.type === 'separator')
            return <div key={`sep-${index}`} className="wc-menu__separator" role="separator" />;
          if (entry.type === 'label') {
            return (
              <div key={`label-${index}`} className="wc-menu__label">
                {entry.label}
              </div>
            );
          }
          const isActive = index === active;
          return (
            <div
              key={`${entry.label}-${index}`}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              role="menuitem"
              aria-disabled={entry.disabled}
              aria-haspopup={entry.type === 'submenu' ? 'menu' : undefined}
              className={clsx(
                'wc-menu__item',
                isActive && 'is-active',
                entry.disabled && 'is-disabled',
                entry.type === 'item' && entry.danger && 'is-danger',
              )}
              onPointerEnter={() => {
                if (entry.disabled) return;
                setActive(index);
                setOpenSub(entry.type === 'submenu' ? index : null);
              }}
              onClick={(e) => {
                e.stopPropagation();
                activate(index);
              }}
            >
              <span className="wc-menu__icon">
                {entry.type === 'item' && entry.checked !== undefined ? (
                  entry.checked ? (
                    <Check size={14} strokeWidth={2} aria-hidden />
                  ) : null
                ) : entry.icon ? (
                  <Icon name={entry.icon} size={16} style={entry.iconColor ? { color: entry.iconColor } : undefined} />
                ) : null}
              </span>
              <span className="wc-menu__text">{entry.label}</span>
              {entry.type === 'item' && entry.shortcut && <Kbd className="wc-menu__shortcut">{entry.shortcut}</Kbd>}
              {entry.type === 'submenu' && <ChevronRight size={14} className="wc-menu__chevron" aria-hidden />}
              {entry.type === 'submenu' && openSub === index && itemRefs.current[index] && (
                <Menu
                  nested
                  items={entry.items}
                  anchor={itemRefs.current[index]!}
                  placement="right-start"
                  onCloseAll={onCloseAll ?? onClose}
                  onClose={() => {
                    setOpenSub(null);
                    containerRef.current?.focus({ preventScroll: true });
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </FloatingPortal>
  );
}

/** Hook for a menu opened by right-click or a button. */
export function useMenuState(): {
  anchor: MenuAnchor | null;
  open: (anchor: MenuAnchor) => void;
  close: () => void;
} {
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null);
  return useMemo(
    () => ({
      anchor,
      open: (a: MenuAnchor) => setAnchor(a),
      close: () => setAnchor(null),
    }),
    [anchor],
  );
}
