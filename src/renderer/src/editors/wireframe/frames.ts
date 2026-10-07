/**
 * Device frames (artboards) of the wireframe module: data-driven specs, screen geometry,
 * overlay fitting and the innermost-container lookup. Pure module: no React, no DOM.
 *
 * Whimsical does not publish device sizes (research 05 section 3); the logical screen sizes
 * below are the clone's choice. A frame element's box is the WHOLE device (bezel included);
 * the usable screen is the box minus the bezel insets.
 */

import type { BoardDocument, BoardElement, DeviceKind, FrameElement, Rect } from '@renderer/core/types';

export type DeviceFamily = 'plain' | 'desktop' | 'phone' | 'tablet' | 'watch';

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface DeviceSpec {
  device: DeviceKind;
  family: DeviceFamily;
  /** lucide-react component name. */
  icon: string;
  /** Logical screen size in portrait (desktop: landscape-native). */
  screen: { w: number; h: number };
  /** Bezel / window chrome around the screen in portrait orientation. */
  bezel: Insets;
  /** Outer corner radius of the device body. */
  radius: number;
  /** Status bar height (0 = the device has none). */
  statusBar: number;
  /** Keyboard available (phones and tablets). */
  keyboard: boolean;
  /** Notch / dynamic island / punch-hole drawn in the status bar. */
  cutout?: 'notch' | 'island' | 'punch';
  /** Physical home button below the screen. */
  homeButton?: boolean;
  /** Desktop only: height of the window title bar (part of `bezel.top`). */
  titleBar?: number;
}

const inset = (top: number, right = top, bottom = top, left = right): Insets => ({ top, right, bottom, left });

export const DEVICE_SPECS: Record<DeviceKind, DeviceSpec> = {
  plain: {
    device: 'plain',
    family: 'plain',
    icon: 'SquareDashed',
    screen: { w: 360, h: 640 },
    bezel: inset(0),
    radius: 4,
    statusBar: 0,
    keyboard: false,
  },
  desktop: {
    device: 'desktop',
    family: 'desktop',
    icon: 'AppWindow',
    screen: { w: 1280, h: 800 },
    bezel: inset(32, 0, 0, 0),
    radius: 8,
    statusBar: 0,
    keyboard: false,
    titleBar: 32,
  },
  'iphone-14': {
    device: 'iphone-14',
    family: 'phone',
    icon: 'Smartphone',
    screen: { w: 390, h: 844 },
    bezel: inset(12),
    radius: 52,
    statusBar: 47,
    keyboard: true,
    cutout: 'island',
  },
  'iphone-x': {
    device: 'iphone-x',
    family: 'phone',
    icon: 'Smartphone',
    screen: { w: 375, h: 812 },
    bezel: inset(12),
    radius: 48,
    statusBar: 44,
    keyboard: true,
    cutout: 'notch',
  },
  'iphone-8': {
    device: 'iphone-8',
    family: 'phone',
    icon: 'Smartphone',
    screen: { w: 375, h: 667 },
    bezel: inset(64, 12, 64, 12),
    radius: 36,
    statusBar: 20,
    keyboard: true,
    homeButton: true,
  },
  android: {
    device: 'android',
    family: 'phone',
    icon: 'Smartphone',
    screen: { w: 360, h: 800 },
    bezel: inset(10),
    radius: 32,
    statusBar: 24,
    keyboard: true,
    cutout: 'punch',
  },
  ipad: {
    device: 'ipad',
    family: 'tablet',
    icon: 'Tablet',
    screen: { w: 768, h: 1024 },
    bezel: inset(24, 20, 24, 20),
    radius: 28,
    statusBar: 24,
    keyboard: true,
    homeButton: true,
  },
  'android-tablet': {
    device: 'android-tablet',
    family: 'tablet',
    icon: 'Tablet',
    screen: { w: 800, h: 1280 },
    bezel: inset(20),
    radius: 24,
    statusBar: 24,
    keyboard: true,
  },
  'apple-watch': {
    device: 'apple-watch',
    family: 'watch',
    icon: 'Watch',
    screen: { w: 184, h: 224 },
    bezel: inset(16),
    radius: 48,
    statusBar: 0,
    keyboard: false,
  },
};

/**
 * Order of the frame launcher. The position + 1 is the digit that picks the entry while the
 * launcher is open ("F" then "1" = Window, as in Whimsical's keyboard-only frame menu).
 */
export const FRAME_LAUNCHER_ORDER: readonly DeviceKind[] = [
  'desktop',
  'iphone-14',
  'iphone-x',
  'iphone-8',
  'android',
  'ipad',
  'android-tablet',
  'apple-watch',
  'plain',
];

export function specOf(device: DeviceKind): DeviceSpec {
  return DEVICE_SPECS[device] ?? DEVICE_SPECS.plain;
}

/** Digit (1-9) that selects a device in the frame launcher. */
export function launcherDigit(device: DeviceKind): number {
  return FRAME_LAUNCHER_ORDER.indexOf(device) + 1;
}

/** Device for a digit typed in the launcher, or undefined. */
export function deviceForDigit(digit: string): DeviceKind | undefined {
  if (!/^[1-9]$/.test(digit)) return undefined;
  return FRAME_LAUNCHER_ORDER[Number(digit) - 1];
}

/** Bezel insets for an orientation (landscape rotates the portrait insets 90 degrees clockwise). */
export function bezelFor(device: DeviceKind, orientation: FrameElement['orientation']): Insets {
  const b = specOf(device).bezel;
  if (orientation === 'portrait' || device === 'desktop' || device === 'plain') return { ...b };
  return { top: b.left, right: b.top, bottom: b.right, left: b.bottom };
}

/** Default outer size of a device (bezel included) in an orientation. */
export function defaultFrameSize(
  device: DeviceKind,
  orientation: FrameElement['orientation'] = 'portrait',
): { w: number; h: number } {
  const spec = specOf(device);
  const b = specOf(device).bezel;
  const portrait = { w: spec.screen.w + b.left + b.right, h: spec.screen.h + b.top + b.bottom };
  if (orientation === 'portrait' || device === 'desktop' || device === 'plain') return portrait;
  const bl = bezelFor(device, orientation);
  return { w: spec.screen.h + bl.left + bl.right, h: spec.screen.w + bl.top + bl.bottom };
}

/** Height of the status bar for a frame, honouring the toggle and the device. */
export function statusBarHeight(frame: Pick<FrameElement, 'device' | 'statusBar'>): number {
  return frame.statusBar ? specOf(frame.device).statusBar : 0;
}

/** Height of the on-screen keyboard (about 36 % of the screen, like a phone keyboard). */
export function keyboardHeight(frame: Pick<FrameElement, 'device' | 'keyboard' | 'h' | 'orientation'>): number {
  const spec = specOf(frame.device);
  if (!spec.keyboard || !frame.keyboard) return 0;
  const b = bezelFor(frame.device, frame.orientation);
  const screenH = frame.h - b.top - b.bottom;
  return Math.max(0, Math.round(screenH * (frame.orientation === 'landscape' ? 0.5 : 0.36)));
}

/** World rectangle of the usable screen of a frame element. */
export function screenRect(frame: Pick<FrameElement, 'device' | 'x' | 'y' | 'w' | 'h' | 'orientation'>): Rect {
  const b = bezelFor(frame.device, frame.orientation);
  return {
    x: frame.x + b.left,
    y: frame.y + b.top,
    w: Math.max(0, frame.w - b.left - b.right),
    h: Math.max(0, frame.h - b.top - b.bottom),
  };
}

/** Area in which an overlay fits: the whole screen of the frame. */
export function overlayRectFor(frame: FrameElement): Rect {
  return screenRect(frame);
}

/** Frame after the device changes: keeps the top-left corner and takes the new default size. */
export function frameWithDevice(
  frame: FrameElement,
  device: DeviceKind,
): Pick<FrameElement, 'device' | 'w' | 'h' | 'statusBar' | 'keyboard'> {
  const spec = specOf(device);
  const size = defaultFrameSize(device, frame.orientation);
  return {
    device,
    w: size.w,
    h: size.h,
    statusBar: spec.statusBar > 0 ? frame.statusBar : false,
    keyboard: spec.keyboard ? frame.keyboard : false,
  };
}

/** Frame after the orientation toggles: width and height swap around the centre. */
export function frameWithOrientation(
  frame: FrameElement,
  orientation: FrameElement['orientation'],
): Pick<FrameElement, 'orientation' | 'x' | 'y' | 'w' | 'h'> {
  if (frame.orientation === orientation) return { orientation, x: frame.x, y: frame.y, w: frame.w, h: frame.h };
  const cx = frame.x + frame.w / 2;
  const cy = frame.y + frame.h / 2;
  const oldB = bezelFor(frame.device, frame.orientation);
  const newB = bezelFor(frame.device, orientation);
  // Swap the screen dimensions, then add the new bezel.
  const screenW = frame.w - oldB.left - oldB.right;
  const screenH = frame.h - oldB.top - oldB.bottom;
  const w = screenH + newB.left + newB.right;
  const h = screenW + newB.top + newB.bottom;
  return { orientation, x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w, h };
}

/** Whether the device allows landscape (desktop and plain frames are free-form). */
export function supportsOrientation(device: DeviceKind): boolean {
  const family = specOf(device).family;
  return family === 'phone' || family === 'tablet' || family === 'watch';
}

/* ------------------------------------------------------------------------------------------
 * Containers
 * ---------------------------------------------------------------------------------------- */

const CONTAINER_TYPES: ReadonlySet<BoardElement['type']> = new Set(['frame', 'section']);

function contains(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  );
}

function containsPoint(outer: Rect, x: number, y: number): boolean {
  return x >= outer.x && y >= outer.y && x <= outer.x + outer.w && y <= outer.y + outer.h;
}

/**
 * Innermost frame or section that fully contains `rect` (smallest area wins; later elements
 * win ties). Used to set `containerId` of new elements, since the engine only assigns
 * containers after a move.
 */
export function containerFor(
  doc: BoardDocument,
  rect: Rect,
  exclude: ReadonlySet<string> = new Set(),
): string | undefined {
  let found: { id: string; area: number } | undefined;
  for (const el of doc.elements) {
    if (!CONTAINER_TYPES.has(el.type) || exclude.has(el.id)) continue;
    const box = el as BoardElement & Rect;
    if (!contains(box, rect)) continue;
    const area = box.w * box.h;
    if (!found || area <= found.area) found = { id: el.id, area };
  }
  return found?.id;
}

/** Innermost frame whose box contains a point (for overlays and full-width lines). */
export function frameAtPoint(doc: BoardDocument, x: number, y: number): FrameElement | undefined {
  let found: FrameElement | undefined;
  for (const el of doc.elements) {
    if (el.type !== 'frame') continue;
    if (!containsPoint(el, x, y)) continue;
    if (!found || el.w * el.h <= found.w * found.h) found = el;
  }
  return found;
}

/** Ids of non-container elements fully inside `rect` that are not yet in a container. */
export function adoptableIds(doc: BoardDocument, rect: Rect, exclude: ReadonlySet<string> = new Set()): string[] {
  const out: string[] = [];
  for (const el of doc.elements) {
    if (exclude.has(el.id) || el.type === 'connector' || el.type === 'frame' || el.containerId) continue;
    const box = el as BoardElement & Rect;
    if (typeof box.x !== 'number' || typeof box.w !== 'number') continue;
    if (contains(rect, box)) out.push(el.id);
  }
  return out;
}

/**
 * Index at which a new frame must be inserted: frames live at the back (after the last existing
 * frame), so they never paint over or capture clicks meant for components.
 */
export function frameInsertIndex(doc: BoardDocument): number {
  let last = -1;
  doc.elements.forEach((el, i) => {
    if (el.type === 'frame') last = i;
  });
  return last + 1;
}
