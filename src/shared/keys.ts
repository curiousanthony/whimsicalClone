/**
 * Key-combo grammar shared by the renderer shortcut registry (matching, display) and the
 * main process (native menu accelerators).
 *
 * Grammar: `[Mod+][Ctrl+][Alt+][Shift+]<Key>`
 *   - `Mod`   = Command on macOS (Ctrl elsewhere). Always use Mod for "Cmd" shortcuts.
 *   - `Ctrl`  = the physical Control key (rare on macOS; mind-map text indent uses it).
 *   - `Alt`   = Option.
 *   - `<Key>` = a letter `A`-`Z` (layout-independent, matched on the produced character,
 *               falling back to the physical key when Option alters the character),
 *               a digit `0`-`9`, a punctuation key `[ ] \ . , / ; ' \` - =` (matched on the
 *               physical US-layout position via `event.code`, as Whimsical does),
 *               or a named key: Enter Escape Tab Backspace Delete Space ArrowUp ArrowDown
 *               ArrowLeft ArrowRight Home End PageUp PageDown F1-F12.
 *   - Pseudo keys `Click`, `Drag`, `Scroll`, `Hover` are allowed for help-sheet entries that
 *     describe pointer gestures (e.g. `Shift+Drag`). They never match keyboard events.
 */

export type Platform = 'mac' | 'other';

export interface KeyCombo {
  mod: boolean;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  /** Normalised key token (see grammar). */
  key: string;
}

/** Minimal shape of a KeyboardEvent so this module stays DOM-free. */
export interface KeyEventLike {
  key: string;
  code: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

const PUNCTUATION_CODES: Record<string, string[]> = {
  '[': ['BracketLeft'],
  ']': ['BracketRight'],
  '\\': ['Backslash', 'IntlBackslash'],
  '.': ['Period', 'NumpadDecimal'],
  ',': ['Comma'],
  '/': ['Slash', 'NumpadDivide'],
  ';': ['Semicolon'],
  "'": ['Quote'],
  '`': ['Backquote'],
  '-': ['Minus', 'NumpadSubtract'],
  '=': ['Equal', 'NumpadAdd'],
};

const NAMED_KEYS = new Set([
  'Enter',
  'Escape',
  'Tab',
  'Backspace',
  'Delete',
  'Space',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  ...Array.from({ length: 12 }, (_, i) => `F${i + 1}`),
]);

export const PSEUDO_KEYS = new Set(['Click', 'Drag', 'Scroll', 'Hover', 'DoubleClick']);

const KEY_ALIASES: Record<string, string> = {
  Esc: 'Escape',
  Return: 'Enter',
  Up: 'ArrowUp',
  Down: 'ArrowDown',
  Left: 'ArrowLeft',
  Right: 'ArrowRight',
  Del: 'Delete',
  Cmd: 'Mod',
  Command: 'Mod',
  Option: 'Alt',
  Opt: 'Alt',
  Control: 'Ctrl',
};

/** Parses a combo string. Throws on unknown keys so bad shortcut tables fail fast in tests. */
export function parseCombo(combo: string): KeyCombo {
  // Split on '+' but keep a trailing '+' or a lone '+' key impossible by grammar ('=' is used).
  const parts = combo.split('+').map((p) => p.trim());
  if (parts.some((p) => p === '')) throw new Error(`Invalid key combo "${combo}"`);
  const result: KeyCombo = { mod: false, ctrl: false, alt: false, shift: false, key: '' };
  parts.forEach((raw, index) => {
    const part = KEY_ALIASES[raw] ?? raw;
    const isLast = index === parts.length - 1;
    if (!isLast) {
      if (part === 'Mod') result.mod = true;
      else if (part === 'Ctrl') result.ctrl = true;
      else if (part === 'Alt') result.alt = true;
      else if (part === 'Shift') result.shift = true;
      else throw new Error(`Unknown modifier "${raw}" in "${combo}"`);
      return;
    }
    result.key = normaliseKeyToken(part, combo);
  });
  return result;
}

function normaliseKeyToken(token: string, combo: string): string {
  if (/^[a-zA-Z]$/.test(token)) return token.toUpperCase();
  if (/^[0-9]$/.test(token)) return token;
  if (token in PUNCTUATION_CODES) return token;
  if (NAMED_KEYS.has(token)) return token;
  if (PSEUDO_KEYS.has(token)) return token;
  throw new Error(`Unknown key "${token}" in "${combo}"`);
}

export function isPseudoCombo(combo: string | KeyCombo): boolean {
  const c = typeof combo === 'string' ? parseCombo(combo) : combo;
  return PSEUDO_KEYS.has(c.key);
}

/** True when the keyboard event matches the combo exactly (all modifiers must agree). */
export function matchesEvent(combo: string | KeyCombo, e: KeyEventLike, platform: Platform = 'mac'): boolean {
  const c = typeof combo === 'string' ? parseCombo(combo) : combo;
  if (PSEUDO_KEYS.has(c.key)) return false;
  const modPressed = platform === 'mac' ? e.metaKey : e.ctrlKey;
  const ctrlPressed = platform === 'mac' ? e.ctrlKey : false;
  if (modPressed !== c.mod) return false;
  if (platform === 'mac' && ctrlPressed !== c.ctrl) return false;
  if (e.altKey !== c.alt) return false;
  if (e.shiftKey !== c.shift) return false;
  return keyMatches(c.key, e);
}

function keyMatches(key: string, e: KeyEventLike): boolean {
  if (/^[A-Z]$/.test(key)) {
    if (e.key.length === 1 && e.key.toUpperCase() === key) return true;
    // Option (and sometimes Ctrl) changes the produced character on macOS: fall back to position.
    return (e.altKey || e.ctrlKey) && e.code === `Key${key}`;
  }
  if (/^[0-9]$/.test(key)) return e.key === key || e.code === `Digit${key}` || e.code === `Numpad${key}`;
  const codes = PUNCTUATION_CODES[key];
  if (codes) return codes.includes(e.code);
  if (key === 'Space') return e.code === 'Space' || e.key === ' ';
  return e.key === key;
}

const MAC_SYMBOLS: Record<string, string> = {
  Enter: '↩',
  Escape: 'Esc',
  Tab: '⇥',
  Backspace: '⌫',
  Delete: '⌦',
  Space: 'Space',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Home: '↖',
  End: '↘',
  PageUp: '⇞',
  PageDown: '⇟',
};

/**
 * Human-readable combo, e.g. "Mod+Shift+D" -> "⌘⇧D" on macOS (Apple order ⌃⌥⇧⌘).
 * Pseudo keys are returned as their token ("⇧ Drag"); callers may translate the token via
 * the i18n key `common:keys.<token>`.
 */
export function formatCombo(combo: string | KeyCombo, platform: Platform = 'mac'): string {
  const c = typeof combo === 'string' ? parseCombo(combo) : combo;
  const key = platform === 'mac' ? (MAC_SYMBOLS[c.key] ?? c.key) : c.key;
  if (platform === 'mac') {
    const mods = `${c.ctrl ? '⌃' : ''}${c.alt ? '⌥' : ''}${c.shift ? '⇧' : ''}${c.mod ? '⌘' : ''}`;
    return PSEUDO_KEYS.has(c.key) ? `${mods}${mods ? ' ' : ''}${key}` : `${mods}${key}`;
  }
  const mods = [c.mod || c.ctrl ? 'Ctrl' : '', c.alt ? 'Alt' : '', c.shift ? 'Shift' : ''].filter(Boolean);
  return [...mods, key].join('+');
}

const ACCELERATOR_KEYS: Record<string, string> = {
  Enter: 'Return',
  Escape: 'Esc',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  '=': '=',
};

/** Electron accelerator string, or null for pseudo (gesture) combos. */
export function toAccelerator(combo: string | KeyCombo): string | null {
  const c = typeof combo === 'string' ? parseCombo(combo) : combo;
  if (PSEUDO_KEYS.has(c.key)) return null;
  const parts: string[] = [];
  if (c.mod) parts.push('CmdOrCtrl');
  if (c.ctrl) parts.push('Ctrl');
  if (c.alt) parts.push('Alt');
  if (c.shift) parts.push('Shift');
  parts.push(ACCELERATOR_KEYS[c.key] ?? c.key);
  return parts.join('+');
}

/** True when the combo has no Mod/Ctrl/Alt modifier (i.e. it would steal typing). */
export function isBareKey(combo: string | KeyCombo): boolean {
  const c = typeof combo === 'string' ? parseCombo(combo) : combo;
  return !c.mod && !c.ctrl && !c.alt;
}
