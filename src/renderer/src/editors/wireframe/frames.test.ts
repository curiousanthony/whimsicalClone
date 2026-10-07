import { describe, expect, it } from 'vitest';
import { createEmptyBoard } from '@renderer/core/boardFormat';
import type { BoardElement, DeviceKind, FrameElement } from '@renderer/core/types';
import {
  DEVICE_SPECS,
  FRAME_LAUNCHER_ORDER,
  adoptableIds,
  bezelFor,
  containerFor,
  defaultFrameSize,
  deviceForDigit,
  frameAtPoint,
  frameInsertIndex,
  frameWithDevice,
  frameWithOrientation,
  keyboardHeight,
  launcherDigit,
  overlayRectFor,
  screenRect,
  statusBarHeight,
  supportsOrientation,
} from './frames';

function frame(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  extra: Partial<FrameElement> = {},
): FrameElement {
  return {
    id,
    type: 'frame',
    x,
    y,
    w,
    h,
    device: 'plain',
    name: id,
    statusBar: false,
    keyboard: false,
    orientation: 'portrait',
    ...extra,
  };
}

function box(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  extra: Record<string, unknown> = {},
): BoardElement {
  return {
    id,
    type: 'wire',
    component: 'rectangle',
    x,
    y,
    w,
    h,
    size: 'M',
    state: 'default',
    text: { blocks: [] },
    textSize: 'm',
    props: {},
    ...extra,
  } as BoardElement;
}

describe('devices', () => {
  it('covers the nine device kinds of the Whimsical MCP schema', () => {
    const kinds: DeviceKind[] = [
      'plain',
      'desktop',
      'iphone-14',
      'iphone-x',
      'iphone-8',
      'ipad',
      'android',
      'android-tablet',
      'apple-watch',
    ];
    expect(Object.keys(DEVICE_SPECS).sort()).toEqual([...kinds].sort());
    expect([...FRAME_LAUNCHER_ORDER].sort()).toEqual([...kinds].sort());
  });

  it('numbers the launcher 1-9 ("F" then "1" = Window)', () => {
    expect(deviceForDigit('1')).toBe('desktop');
    expect(launcherDigit('desktop')).toBe(1);
    expect(deviceForDigit('9')).toBe('plain');
    expect(deviceForDigit('0')).toBeUndefined();
    expect(deviceForDigit('a')).toBeUndefined();
    for (const d of FRAME_LAUNCHER_ORDER) expect(deviceForDigit(String(launcherDigit(d)))).toBe(d);
  });

  it('adds the bezel to the logical screen size', () => {
    expect(defaultFrameSize('iphone-14')).toEqual({ w: 390 + 24, h: 844 + 24 });
    expect(defaultFrameSize('desktop')).toEqual({ w: 1280, h: 800 + 32 });
    expect(defaultFrameSize('plain')).toEqual({ w: 360, h: 640 });
    const landscape = defaultFrameSize('ipad', 'landscape');
    const portrait = defaultFrameSize('ipad');
    expect(landscape.w).toBe(1024 + 48);
    expect(landscape.h).toBe(768 + 40);
    expect(portrait).toEqual({ w: 768 + 40, h: 1024 + 48 });
  });

  it('rotates the bezel in landscape', () => {
    const p = bezelFor('iphone-8', 'portrait');
    const l = bezelFor('iphone-8', 'landscape');
    expect(p).toEqual({ top: 64, right: 12, bottom: 64, left: 12 });
    expect(l).toEqual({ top: 12, right: 64, bottom: 12, left: 64 });
    expect(bezelFor('desktop', 'landscape')).toEqual(bezelFor('desktop', 'portrait'));
  });

  it('computes the screen rectangle of a frame', () => {
    const size = defaultFrameSize('iphone-x');
    const f = frame('f', 100, 50, size.w, size.h, { device: 'iphone-x' });
    expect(screenRect(f)).toEqual({ x: 112, y: 62, w: 375, h: 812 });
    expect(overlayRectFor(f)).toEqual(screenRect(f));
    const win = frame('w', 0, 0, 1280, 832, { device: 'desktop' });
    expect(screenRect(win)).toEqual({ x: 0, y: 32, w: 1280, h: 800 });
  });

  it('honours the status bar and keyboard toggles', () => {
    const f = frame('f', 0, 0, 414, 868, { device: 'iphone-14', statusBar: true, keyboard: true });
    expect(statusBarHeight(f)).toBe(47);
    expect(statusBarHeight({ ...f, statusBar: false })).toBe(0);
    expect(keyboardHeight(f)).toBe(Math.round(844 * 0.36));
    expect(keyboardHeight({ ...f, keyboard: false })).toBe(0);
    expect(keyboardHeight({ ...frame('d', 0, 0, 1280, 832, { device: 'desktop', keyboard: true }) })).toBe(0);
    expect(statusBarHeight(frame('d', 0, 0, 10, 10, { device: 'desktop', statusBar: true }))).toBe(0);
  });

  it('switches device and orientation keeping toggles valid', () => {
    const f = frame('f', 0, 0, 414, 868, { device: 'iphone-14', statusBar: true, keyboard: true });
    const watch = frameWithDevice(f, 'apple-watch');
    expect(watch).toMatchObject({ device: 'apple-watch', statusBar: false, keyboard: false });
    expect(frameWithDevice(f, 'android')).toMatchObject({ statusBar: true, keyboard: true });
    const rotated = frameWithOrientation(f, 'landscape');
    expect(rotated.orientation).toBe('landscape');
    expect(rotated.w).toBe(844 + 24);
    expect(rotated.h).toBe(390 + 24);
    // The centre stays put.
    expect(rotated.x + rotated.w / 2).toBeCloseTo(f.x + f.w / 2, 0);
    const back = frameWithOrientation({ ...f, ...rotated }, 'portrait');
    expect(back).toMatchObject({ orientation: 'portrait', w: f.w, h: f.h });
    expect(frameWithOrientation(f, 'portrait')).toMatchObject({ w: f.w, h: f.h });
    expect(supportsOrientation('iphone-14')).toBe(true);
    expect(supportsOrientation('desktop')).toBe(false);
  });
});

describe('containers', () => {
  const doc = createEmptyBoard('wireframe', [
    frame('outer', 0, 0, 1000, 1000),
    frame('inner', 100, 100, 300, 300),
    box('a', 120, 120, 50, 50),
    box('b', 600, 600, 50, 50),
    box('c', 380, 380, 50, 50),
  ]);

  it('finds the innermost frame containing a rectangle', () => {
    expect(containerFor(doc, { x: 120, y: 120, w: 50, h: 50 })).toBe('inner');
    expect(containerFor(doc, { x: 600, y: 600, w: 50, h: 50 })).toBe('outer');
    expect(containerFor(doc, { x: 380, y: 380, w: 50, h: 50 })).toBe('outer');
    expect(containerFor(doc, { x: 990, y: 990, w: 50, h: 50 })).toBeUndefined();
    expect(containerFor(doc, { x: 120, y: 120, w: 50, h: 50 }, new Set(['inner']))).toBe('outer');
  });

  it('also treats sections as containers', () => {
    const withSection = createEmptyBoard('wireframe', [
      { id: 's', type: 'section', x: 0, y: 0, w: 200, h: 200, name: '', color: 'gray', fill: 'solid', clip: false },
    ]);
    expect(containerFor(withSection, { x: 10, y: 10, w: 20, h: 20 })).toBe('s');
  });

  it('finds the frame under a point', () => {
    expect(frameAtPoint(doc, 150, 150)?.id).toBe('inner');
    expect(frameAtPoint(doc, 700, 700)?.id).toBe('outer');
    expect(frameAtPoint(doc, 2000, 2000)).toBeUndefined();
  });

  it('inserts new frames behind components and adopts what they contain', () => {
    expect(frameInsertIndex(doc)).toBe(2);
    expect(frameInsertIndex(createEmptyBoard('wireframe', [box('x', 0, 0, 10, 10)]))).toBe(0);
    const loose = createEmptyBoard('wireframe', [
      box('x', 10, 10, 10, 10),
      box('y', 500, 500, 10, 10),
      box('z', 12, 12, 5, 5, { containerId: 'k' }),
    ]);
    expect(adoptableIds(loose, { x: 0, y: 0, w: 100, h: 100 })).toEqual(['x']);
  });
});
