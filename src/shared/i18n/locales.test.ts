import { describe, expect, it } from 'vitest';
import { AVAILABLE_LANGUAGES, NAMESPACES, enResources, resolveLanguage, resources } from './resources';

type Tree = { [key: string]: string | Tree };

function keys(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([k, v]) => (typeof v === 'string' ? [`${prefix}${k}`] : keys(v, `${prefix}${k}.`)));
}

describe('locales', () => {
  it('ships every namespace in English', () => {
    expect(Object.keys(enResources).sort()).toEqual([...NAMESPACES].sort());
  });

  it('only contains keys that exist in English (run `npm run i18n:sync` after editing en)', () => {
    for (const lng of AVAILABLE_LANGUAGES.filter((l) => l !== 'en')) {
      for (const ns of NAMESPACES) {
        const en = new Set(keys(enResources[ns] as unknown as Tree));
        const other = resources[lng]?.[ns];
        const stale = other ? keys(other).filter((k) => !en.has(k)) : [];
        expect(stale, `${lng}/${ns}`).toEqual([]);
      }
    }
  });

  it('resolves languages with English fallback', () => {
    expect(resolveLanguage('system', 'de-DE')).toBe('en');
    expect(resolveLanguage('en', 'fr-FR')).toBe('en');
  });
});
