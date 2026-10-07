/**
 * Renderer i18n bootstrap (i18next + react-i18next).
 *
 * Rules (see SPEC "i18n"):
 *   - Every user-visible string goes through t(); no literal UI text in components.
 *   - Use the module's own namespace: useTranslation('flowchart'), or "ns:key" for others.
 *   - Locale files live in src/shared/i18n/locales/<lng>/<ns>.json (shared with main).
 */

import i18next, { type i18n as I18n } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_NS, FALLBACK_LNG, NAMESPACES, resolveLanguage, resources } from '@shared/i18n/resources';

export const i18n: I18n = i18next.createInstance();

let initialised: Promise<unknown> | undefined;

/** Initialises i18n once. `language` is a preference ("system" or a code). */
export function initI18n(language = 'en', systemLocale = 'en'): Promise<unknown> {
  if (!initialised) {
    initialised = i18n.use(initReactI18next).init({
      resources,
      lng: resolveLanguage(language, systemLocale),
      fallbackLng: FALLBACK_LNG,
      ns: [...NAMESPACES],
      defaultNS: DEFAULT_NS,
      returnEmptyString: false,
      returnNull: false,
      interpolation: { escapeValue: false },
      initAsync: false,
    });
  }
  return initialised;
}

/**
 * Translates a key that is only known at runtime ("ns:path" strings stored in data such as
 * ShortcutDef.labelKey). Static keys should use the typed `t` from useTranslation instead.
 */
export function translateKey(key: string, values?: Record<string, unknown>): string {
  return (i18n.t as unknown as (k: string, v?: Record<string, unknown>) => string)(key, values);
}

export async function changeLanguage(language: string, systemLocale: string): Promise<void> {
  await i18n.changeLanguage(resolveLanguage(language, systemLocale));
}
