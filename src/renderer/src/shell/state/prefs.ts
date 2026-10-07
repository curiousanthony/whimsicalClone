/**
 * Preferences (persisted by main), system appearance and locale. Applies the theme to
 * <html data-theme> and switches the i18n language when the preference changes.
 */

import { create } from 'zustand';
import { DEFAULT_PREFERENCES, type Preferences, type ThemePreference } from '@shared/ipc';
import { changeLanguage } from '@renderer/i18n';

interface PrefsState {
  prefs: Preferences;
  systemDark: boolean;
  systemLocale: string;
  loaded: boolean;
}

export const usePrefs = create<PrefsState>()(() => ({
  prefs: { ...DEFAULT_PREFERENCES },
  systemDark: false,
  systemLocale: 'en',
  loaded: false,
}));

export function resolvedTheme(theme: ThemePreference, systemDark: boolean): 'light' | 'dark' {
  if (theme === 'system') return systemDark ? 'dark' : 'light';
  return theme;
}

export function useResolvedTheme(): 'light' | 'dark' {
  return usePrefs((s) => resolvedTheme(s.prefs.theme, s.systemDark));
}

function applyTheme(): void {
  const { prefs, systemDark } = usePrefs.getState();
  document.documentElement.dataset.theme = resolvedTheme(prefs.theme, systemDark);
}

let lastLanguage: string | null = null;
function applyLanguage(): void {
  const { prefs, systemLocale } = usePrefs.getState();
  const key = `${prefs.language}|${systemLocale}`;
  if (key === lastLanguage) return;
  lastLanguage = key;
  void changeLanguage(prefs.language, systemLocale);
}

/** Loads prefs + system state and subscribes to changes. Returns an unsubscribe function. */
export async function initPrefs(): Promise<() => void> {
  const api = window.api;
  const [prefs, systemDark, systemLocale] = await Promise.all([
    api.prefs.get(),
    api.app.getSystemDarkMode(),
    api.app.getLocale(),
  ]);
  usePrefs.setState({ prefs, systemDark, systemLocale, loaded: true });
  lastLanguage = `${prefs.language}|${systemLocale}`;
  applyTheme();
  const offPrefs = api.prefs.onChange((next) => {
    usePrefs.setState({ prefs: next });
    applyTheme();
    applyLanguage();
  });
  const offDark = api.app.onSystemDarkModeChange((dark) => {
    usePrefs.setState({ systemDark: dark });
    applyTheme();
  });
  return () => {
    offPrefs();
    offDark();
  };
}

/** Updates preferences (optimistic locally, persisted by main which broadcasts back). */
export async function setPrefs(patch: Partial<Preferences>): Promise<void> {
  usePrefs.setState((s) => ({ prefs: { ...s.prefs, ...patch } }));
  applyTheme();
  applyLanguage();
  const saved = await window.api.prefs.set(patch);
  usePrefs.setState({ prefs: saved });
}

export function cycleTheme(): void {
  const order: ThemePreference[] = ['system', 'light', 'dark'];
  const current = usePrefs.getState().prefs.theme;
  void setPrefs({ theme: order[(order.indexOf(current) + 1) % order.length] ?? 'system' });
}
