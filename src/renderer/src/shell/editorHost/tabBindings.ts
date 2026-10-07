/**
 * Per-tab shortcut bindings. Editors call `registerShortcuts(handlers)` whenever they like;
 * the handlers are bound to the registry only while their tab is active, so inactive (but
 * still mounted) tabs never shadow the active one, and re-activation puts them back on top
 * of the handler stack (above the shell's fallback handlers such as edit.undo).
 */

import type { ScopeId, ShortcutHandler, ShortcutRegistryApi, Unregister } from '@renderer/core/types';

export class TabBindings {
  private readonly sets = new Set<readonly ShortcutHandler[]>();
  private readonly bound = new Map<readonly ShortcutHandler[], Unregister>();
  private active = false;
  private scopes: readonly ScopeId[] = [];

  constructor(
    private readonly registry: Pick<ShortcutRegistryApi, 'bind'>,
    private readonly onScopesChange: (scopes: readonly ScopeId[]) => void = () => undefined,
  ) {}

  register(handlers: readonly ShortcutHandler[]): Unregister {
    this.sets.add(handlers);
    if (this.active) this.bound.set(handlers, this.registry.bind(handlers));
    return () => {
      this.sets.delete(handlers);
      this.bound.get(handlers)?.();
      this.bound.delete(handlers);
    };
  }

  setActive(active: boolean): void {
    if (active === this.active) return;
    this.active = active;
    if (active) {
      for (const handlers of this.sets) this.bound.set(handlers, this.registry.bind(handlers));
      this.onScopesChange(this.scopes);
    } else {
      for (const unbind of this.bound.values()) unbind();
      this.bound.clear();
    }
  }

  isActive(): boolean {
    return this.active;
  }

  setScopes(scopes: readonly ScopeId[]): void {
    this.scopes = [...scopes];
    if (this.active) this.onScopesChange(this.scopes);
  }

  getScopes(): readonly ScopeId[] {
    return this.scopes;
  }

  dispose(): void {
    this.setActive(false);
    this.sets.clear();
  }
}
