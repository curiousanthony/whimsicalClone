/**
 * Central shortcut registry (implementation of ShortcutRegistryApi).
 *
 * - Static tables (ShortcutDef[]) are `define`d once at startup by the app.
 * - Mounted components `bind` handlers for command ids; the most recent binding wins.
 * - `handleKeyDown` is attached once to `window` (bubble phase) by the shell. Components
 *   that handle keys themselves (TipTap/ProseMirror) call preventDefault first and are
 *   therefore never overridden.
 * - Resolution walks SCOPE_PRIORITY innermost first; within the active scopes the first
 *   definition whose combo matches AND has an enabled bound handler wins.
 */

import { useSyncExternalStore } from 'react';
import {
  formatCombo,
  isPseudoCombo,
  matchesEvent,
  parseCombo,
  toAccelerator,
  type KeyCombo,
  type Platform,
} from '@shared/keys';
import {
  SCOPE_PRIORITY,
  type CommandContext,
  type ScopeId,
  type ShortcutDef,
  type ShortcutHandler,
  type ShortcutRegistryApi,
  type Unregister,
} from './types';

/** True when keyboard focus is in a native text field or a contenteditable. */
export function isTextInputTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).tagName !== 'string') return false;
  const el = target as HTMLElement;
  if (el.isContentEditable) return true;
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName === 'INPUT') {
    const type = (el as HTMLInputElement).type;
    return !['checkbox', 'radio', 'button', 'submit', 'range', 'color', 'file', 'reset'].includes(type);
  }
  return false;
}

interface ParsedDef {
  def: ShortcutDef;
  combos: KeyCombo[];
}

export class ShortcutRegistry implements ShortcutRegistryApi {
  private readonly defs = new Map<string, ParsedDef>();
  private readonly handlers = new Map<string, ShortcutHandler[]>();
  private scopes: ScopeId[] = [];
  private readonly listeners = new Set<() => void>();
  private version = 0;

  constructor(private readonly platform: Platform = 'mac') {}

  define(defs: readonly ShortcutDef[]): Unregister {
    for (const def of defs) {
      if (this.defs.has(def.id)) throw new Error(`Duplicate shortcut id "${def.id}"`);
      const combos = def.keys.map((k) => parseCombo(k));
      if (combos.some((c) => isPseudoCombo(c))) {
        throw new Error(`Shortcut "${def.id}" uses a pointer pseudo key in "keys"; use "gestures"`);
      }
      (def.gestures ?? []).forEach((g) => parseGesture(g));
      this.defs.set(def.id, { def, combos });
    }
    this.emit();
    return () => {
      for (const def of defs) this.defs.delete(def.id);
      this.emit();
    };
  }

  bind(handlers: readonly ShortcutHandler[]): Unregister {
    for (const h of handlers) {
      const stack = this.handlers.get(h.id) ?? [];
      stack.push(h);
      this.handlers.set(h.id, stack);
    }
    this.emit();
    return () => {
      for (const h of handlers) {
        const stack = this.handlers.get(h.id);
        if (!stack) continue;
        const i = stack.lastIndexOf(h);
        if (i >= 0) stack.splice(i, 1);
        if (stack.length === 0) this.handlers.delete(h.id);
      }
      this.emit();
    };
  }

  setActiveScopes(scopes: readonly ScopeId[]): void {
    const next = [...new Set(scopes)];
    if (next.length === this.scopes.length && next.every((s, i) => s === this.scopes[i])) return;
    this.scopes = next;
    this.emit();
  }

  getActiveScopes(): readonly ScopeId[] {
    return this.scopes;
  }

  private orderedActiveScopes(): ScopeId[] {
    return SCOPE_PRIORITY.filter((s) => s === 'app' || this.scopes.includes(s));
  }

  private activeHandler(id: string): ShortcutHandler | undefined {
    const stack = this.handlers.get(id);
    const top = stack?.[stack.length - 1];
    if (!top) return undefined;
    return top.isEnabled && !top.isEnabled() ? undefined : top;
  }

  handleKeyDown(event: KeyboardEvent): boolean {
    if (event.defaultPrevented || event.isComposing) return false;
    const inText = isTextInputTarget(event.target);
    for (const scope of this.orderedActiveScopes()) {
      for (const { def, combos } of this.defs.values()) {
        if (def.scope !== scope || def.dispatch === 'native') continue;
        if (inText && !def.allowInTextInput && def.scope !== 'textEdit') continue;
        if (!combos.some((c) => matchesEvent(c, event, this.platform))) continue;
        const handler = this.activeHandler(def.id);
        if (!handler) continue;
        event.preventDefault();
        if (event.repeat && !def.repeat) return true;
        void handler.run({ source: 'keyboard', event });
        return true;
      }
    }
    return false;
  }

  run(id: string, ctx: CommandContext): boolean {
    const handler = this.activeHandler(id);
    if (!handler) return false;
    void handler.run(ctx);
    return true;
  }

  isBound(id: string): boolean {
    return this.activeHandler(id) !== undefined;
  }

  getDef(id: string): ShortcutDef | undefined {
    return this.defs.get(id)?.def;
  }

  getDefs(): readonly ShortcutDef[] {
    return [...this.defs.values()].map((p) => p.def);
  }

  format(id: string): string | undefined {
    const combo = this.defs.get(id)?.combos[0];
    return combo ? formatCombo(combo, this.platform) : undefined;
  }

  accelerator(id: string): string | undefined {
    const combo = this.defs.get(id)?.combos[0];
    return combo ? (toAccelerator(combo) ?? undefined) : undefined;
  }

  subscribe(listener: () => void): Unregister {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Increments on every change; used by useSyncExternalStore. */
  getVersion(): number {
    return this.version;
  }

  private emit(): void {
    this.version += 1;
    for (const l of this.listeners) l();
  }
}

const MODIFIER_TOKENS: Record<string, string> = { Mod: '⌘', Ctrl: '⌃', Alt: '⌥', Shift: '⇧' };

/** Validates a gesture string such as "Space+Drag" or "Mod+Click"; returns its tokens. */
export function parseGesture(gesture: string): string[] {
  const tokens = gesture.split('+').map((t) => t.trim());
  if (tokens.length === 0 || tokens.some((t) => t === '')) throw new Error(`Invalid gesture "${gesture}"`);
  return tokens;
}

/**
 * Formats a gesture for display: modifiers become symbols; other tokens are passed to
 * `translateToken` (e.g. "Drag" -> t("common:keys.Drag")).
 */
export function formatGesture(gesture: string, translateToken: (token: string) => string = (t) => t): string {
  const tokens = parseGesture(gesture);
  const mods = tokens.filter((t) => t in MODIFIER_TOKENS).map((t) => MODIFIER_TOKENS[t]);
  const rest = tokens.filter((t) => !(t in MODIFIER_TOKENS)).map(translateToken);
  return [mods.join(''), ...rest].filter(Boolean).join(' + ');
}

/** App-wide singleton. */
export const shortcutRegistry = new ShortcutRegistry('mac');

/** Re-renders when the registry changes. Returns the formatted primary combo of a command. */
export function useShortcutLabel(id: string): string | undefined {
  useSyncExternalStore(
    (l) => shortcutRegistry.subscribe(l),
    () => shortcutRegistry.getVersion(),
  );
  return shortcutRegistry.format(id);
}
