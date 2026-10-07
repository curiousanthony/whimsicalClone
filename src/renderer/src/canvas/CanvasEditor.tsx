/**
 * Canvas engine entry component (owner: canvas module). One instance per open canvas tab;
 * the exported name, default export and props are part of the frozen contract.
 *
 * Responsibilities: creates the CanvasEngine, mirrors host props into it, binds shortcut
 * handlers while active, wires DOM events (pointer, wheel, keyboard modifiers, clipboard,
 * drag-and-drop, resize), persists the viewport per viewer and renders the layers and chrome.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from 'zustand';
import { produce } from 'immer';
import { useCanvasPlugins } from '@renderer/core/canvasPlugins';
import { GRID_SIZE } from '@renderer/core/palette';
import { isTextInputTarget } from '@renderer/core/shortcuts';
import type { BoardDocument, CanvasPreset, EditorProps, ShortcutHandler, ThemeMode } from '@renderer/core/types';
import { isValidViewport, viewportFromWheel } from './viewport';
import { CanvasEngine, PAN_TOOL } from './engine/engine';
import { EngineContext } from './engine/context';
import { createEngineCommands } from './engine/commands';
import { handleCopy, handleDrop, handlePaste } from './engine/clipboardEvents';
import { WorldLayer } from './components/WorldLayer';
import { Overlay } from './components/Overlay';
import { Toolbar } from './components/Toolbar';
import { ZoomControls } from './components/ZoomControls';
import { ContextBar } from './components/ContextBar';
import { PanelHost } from './components/Panels';
import './canvas.css';

export interface CanvasEditorProps extends EditorProps<BoardDocument> {
  preset: CanvasPreset;
}

const VIEWPORT_KEY = 'viewport';

function readTheme(): ThemeMode {
  if (typeof document === 'undefined') return 'light';
  const attr = document.documentElement.dataset.theme;
  if (attr === 'dark' || attr === 'light') return attr;
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Tracks the app colour mode (<html data-theme> set by the shell, else the system). */
function useThemeMode(): ThemeMode {
  const [theme, setTheme] = useState<ThemeMode>(readTheme);
  useEffect(() => {
    const update = () => setTheme(readTheme());
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : undefined;
    mq?.addEventListener('change', update);
    return () => {
      observer.disconnect();
      mq?.removeEventListener('change', update);
    };
  }, []);
  return theme;
}

export function CanvasEditor(props: CanvasEditorProps): JSX.Element {
  const { content, preset, isActive, services, onChange, setScopes, registerShortcuts, lastHistoryAction, filePath } = props;
  const { t } = useTranslation('canvas');
  const plugins = useCanvasPlugins();
  const theme = useThemeMode();
  const rootRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<CanvasEngine>();
  if (!engineRef.current) {
    engineRef.current = new CanvasEngine({ kind: preset.kind, preset, plugins, content, services, theme, onChange, setScopes });
  }
  const engine = engineRef.current;

  // Mirror host props (new content after undo/redo/reload, fresh callbacks).
  useLayoutEffect(() => {
    engine.updateProps({ content, services, onChange, setScopes, theme });
  });

  // Restore the selection recorded with an undo / redo step.
  const historySeq = lastHistoryAction?.seq;
  useEffect(() => {
    if (historySeq !== undefined) engine.restoreSelection(lastHistoryAction?.selection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historySeq, engine]);

  // Root element, size tracking.
  useLayoutEffect(() => {
    const el = rootRef.current;
    engine.setRoot(el);
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const size = engine.store.getState().size;
      if (size.w !== r.width || size.h !== r.height) engine.store.setState({ size: { w: r.width, h: r.height } });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [engine]);

  // Initial viewport (per-viewer state) and element normalisation, once.
  useEffect(() => {
    const saved = services.getViewState<unknown>(VIEWPORT_KEY);
    if (isValidViewport(saved)) engine.setViewport(saved);
    else {
      const size = engine.store.getState().size;
      engine.setViewport({ x: -size.w / 2, y: -size.h / 3, zoom: 1 });
      if (engine.getDocument().elements.length > 0) engine.zoomToFit('content');
    }
    // Normalise elements once on load (fill defaults); not an undo step.
    const doc = engine.getDocument();
    const normalized = produce(doc, (d) => {
      d.elements.forEach((el, i) => {
        const def = engine.lookup(el.type);
        if (def?.normalize) {
          const next = def.normalize(el as never);
          if (next !== (el as unknown)) d.elements[i] = next as never;
        }
      });
    });
    if (normalized !== doc && JSON.stringify(normalized) !== JSON.stringify(doc)) engine.controller.replace(normalized, { history: 'skip' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]);

  // Persist the viewport (debounced).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsub = engine.store.subscribe((s, prev) => {
      if (s.viewport === prev.viewport) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => engine.services.setViewState(VIEWPORT_KEY, s.viewport), 300);
    });
    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, [engine]);

  // Invert zoom preference.
  useEffect(() => {
    let alive = true;
    void services.api.prefs
      ?.get()
      .then((p) => {
        if (alive) engine.invertZoom = !!p.invertZoom;
      })
      .catch(() => undefined);
    const off = services.api.prefs?.onChange?.((p) => (engine.invertZoom = !!p.invertZoom));
    return () => {
      alive = false;
      off?.();
    };
  }, [engine, services.api]);

  // Shortcut handlers and scopes while active.
  const handlers = useMemo<ShortcutHandler[]>(() => {
    const engineHandlers = createEngineCommands(engine, { filePath });
    const engineIds = new Set(engineHandlers.map((h) => h.id));
    const toolHandlers: ShortcutHandler[] = engine.tools
      .filter((tool) => tool.shortcutId && !engineIds.has(tool.shortcutId))
      .map((tool) => ({
        id: tool.shortcutId!,
        run: () => engine.setActiveTool(tool.id),
        isEnabled: () =>
          tool.modes.includes(engine.getMode()) && (engine.preset.toolbar === 'full' || tool.group === 'freehand' || tool.group === 'select'),
      }));
    const pluginHandlers = engine.getPlugins().flatMap((p) => p.createCommands?.(engine) ?? []);
    return [...engineHandlers, ...toolHandlers, ...pluginHandlers];
  }, [engine, filePath]);

  useEffect(() => {
    engine.setActive(isActive);
    if (!isActive) return;
    engine.syncScopes(true);
    const unregister = registerShortcuts(handlers);
    return unregister;
  }, [isActive, handlers, registerShortcuts, engine]);

  // Keyboard modifiers held during gestures (Space = pan, backtick = no snapping) and DOM
  // clipboard events, only while this tab is active.
  useEffect(() => {
    if (!isActive) return;
    const ownsFocus = () => {
      const active = document.activeElement;
      return !active || active === document.body || !!rootRef.current?.parentElement?.contains(active);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTextInputTarget(e.target) || engine.getEditingId() || !ownsFocus()) return;
      if (e.code === 'Space' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        engine.setSpaceDown(true);
      } else if (e.code === 'Backquote') {
        engine.setBacktick(true);
      } else if (e.key === 'Escape' && engine.hasSession()) {
        // Escape cancels a running gesture even if no shortcut handler is bound.
        e.preventDefault();
        engine.cancelSession();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') engine.setSpaceDown(false);
      if (e.code === 'Backquote') engine.setBacktick(false);
    };
    const onBlur = () => {
      engine.setSpaceDown(false);
      engine.setBacktick(false);
    };
    const onCopy = (e: ClipboardEvent) => ownsFocus() && handleCopy(engine, e);
    const onCut = (e: ClipboardEvent) => ownsFocus() && handleCopy(engine, e, true);
    const onPaste = (e: ClipboardEvent) => ownsFocus() && handlePaste(engine, e);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', onBlur);
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCut);
    document.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCut);
      document.removeEventListener('paste', onPaste);
      onBlur();
    };
  }, [isActive, engine]);

  // Wheel: pinch / Cmd+wheel zoom toward the cursor, otherwise pan (non-passive listener).
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if ((e.target as Element | null)?.closest('[data-wc-chrome], [data-wc-editing] .wc-rte-content')) return;
      const r = el.getBoundingClientRect();
      const anchor = { x: e.clientX - r.left, y: e.clientY - r.top };
      engine.handleWheel(e, viewportFromWheel(engine.getViewport(), e, anchor, { invertZoom: engine.invertZoom }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [engine]);

  const viewport = useStore(engine.store, (s) => s.viewport);
  const mode = useStore(engine.store, (s) => s.mode);
  const tool = useStore(engine.store, (s) => s.tool);
  const spaceDown = useStore(engine.store, (s) => s.spaceDown);
  const panning = useStore(engine.store, (s) => s.panning);

  const toolDef = engine.getTool(tool);
  const cursor = panning ? 'grabbing' : spaceDown || tool === PAN_TOOL ? 'grab' : (toolDef?.cursor ?? (toolDef?.create ? 'crosshair' : 'default'));
  const grid = GRID_SIZE[mode] * viewport.zoom;
  const showGrid = mode === 'diagram' && viewport.zoom >= 1 && grid >= 6;
  const gridStyle = showGrid
    ? {
        backgroundSize: `${grid}px ${grid}px`,
        backgroundPosition: `${-viewport.x * viewport.zoom - grid / 2}px ${-viewport.y * viewport.zoom - grid / 2}px`,
      }
    : undefined;

  return (
    <EngineContext.Provider value={engine}>
      <div className={`wc-canvas-editor wc-canvas-editor--${mode}`} data-kind={preset.kind}>
        <div
          ref={rootRef}
          className={`wc-canvas${showGrid ? ' has-grid' : ''}`}
          style={{ cursor, ...gridStyle }}
          tabIndex={0}
          role="application"
          aria-label={t('a11y.canvas')}
          onPointerDown={(e) => engine.handlePointerDown(e.nativeEvent)}
          onPointerMove={(e) => engine.handlePointerMove(e.nativeEvent)}
          onPointerUp={(e) => engine.handlePointerUp(e.nativeEvent)}
          onPointerCancel={() => engine.handlePointerCancel()}
          onPointerLeave={() => engine.handlePointerLeave()}
          onDoubleClick={(e) => engine.handleDoubleClick(e.nativeEvent)}
          onContextMenu={(e) => e.preventDefault()}
          onDragOver={(e) => {
            if (Array.from(e.dataTransfer.types).includes('Files')) e.preventDefault();
          }}
          onDrop={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            handleDrop(engine, e.nativeEvent, engine.screenToWorld({ x: e.clientX - r.left, y: e.clientY - r.top }));
          }}
        >
          <WorldLayer engine={engine} />
          <Overlay engine={engine} />
          <ContextBar engine={engine} />
        </div>
        <Toolbar engine={engine} />
        <ZoomControls engine={engine} />
        <PanelHost engine={engine} />
      </div>
    </EngineContext.Provider>
  );
}

export default CanvasEditor;
