/** Display labels (⌘⇧X) of docs shortcuts, derived from the static shortcut table. */

import { formatCombo, type Platform } from '@shared/keys';
import { docsShortcuts } from '../shortcuts';

export function shortcutLabel(id: string, platform: Platform = 'mac'): string | undefined {
  const def = docsShortcuts.find((d) => d.id === id);
  const key = def?.keys[0];
  return key ? formatCombo(key, platform) : undefined;
}
