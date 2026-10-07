/** Test helper: resolves "docs" namespace keys against the English locale file. */
import docs from '@shared/i18n/locales/en/docs.json';

export function en(key: string): string {
  let node: unknown = docs;
  for (const part of key.split('.')) {
    if (node && typeof node === 'object' && part in (node as Record<string, unknown>)) node = (node as Record<string, unknown>)[part];
    else return key;
  }
  return typeof node === 'string' ? node : key;
}
