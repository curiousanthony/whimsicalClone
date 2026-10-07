/**
 * Context bars of the wireframe elements (components, frames, annotations). The engine adds
 * the common controls (group, lock, arrange); these add the component-specific ones listed in
 * the registry (`WireEntry.controls`): S/M/L size, state, colour, variant, icon, options...
 */

import { useRef, type ReactNode } from 'react';
import type { Draft } from 'immer';
import { useTranslation } from 'react-i18next';
import { ColorSwatches, Divider, IconButton, MenuItem, Popover } from '@renderer/canvas';
import { resolveColor } from '@renderer/core/palette';
import type {
  AnnotationElement,
  CanvasApi,
  ColorRef,
  ConnectorElement,
  ContextBarProps,
  DeviceKind,
  FrameElement,
  ThemeMode,
  WireElement,
} from '@renderer/core/types';
import {
  FRAME_LAUNCHER_ORDER,
  frameWithDevice,
  frameWithOrientation,
  overlayRectFor,
  specOf,
  supportsOrientation,
  frameAtPoint,
} from './frames';
import { IconPicker } from './IconPicker';
import { TABLE_ROW_HEIGHT, flipLine, renumberAnnotations, tableCells } from './model';
import {
  dropdownHeight,
  entryOf,
  numberProp,
  sizePatch,
  statePatch,
  stringArrayProp,
  stringProp,
  type WireControl,
  type WireSize,
} from './registry';

type Patch = (d: Draft<WireElement>) => void;

/** Applies `fn` to every selected wire element in one undo step (coalesced when `key` is set). */
function useWireUpdate(api: CanvasApi, elements: readonly WireElement[]): (fn: Patch, key?: string) => void {
  const ids = new Set(elements.map((e) => e.id));
  return (fn, key) =>
    api.update(
      (d) => {
        for (const el of d.elements) if (ids.has(el.id) && el.type === 'wire') fn(el as Draft<WireElement>);
      },
      key ? { coalesceKey: `${key}:${[...ids].join(',')}` } : undefined,
    );
}

function Seg<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T | undefined;
  options: Array<{ value: T; label: string; title: string }>;
  onChange: (v: T) => void;
}): JSX.Element {
  return (
    <div className="wf-seg" role="group">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`wf-seg-btn${o.value === value ? ' is-active' : ''}`}
          title={o.title}
          aria-label={o.title}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          onPointerDown={(e) => e.preventDefault()}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ColorButton({
  value,
  onChange,
  onReset,
  label,
  theme,
}: {
  value: ColorRef | undefined;
  onChange: (c: ColorRef) => void;
  onReset?: () => void;
  label: string;
  theme: ThemeMode;
}): JSX.Element {
  const { t } = useTranslation('wireframe');
  return (
    <Popover
      trigger={({ toggle, open }) => (
        <button
          type="button"
          className="wc-color-btn"
          aria-label={label}
          data-tooltip={label}
          data-tooltip-side="top"
          onClick={toggle}
          aria-pressed={open}
        >
          <span
            className="wc-color-btn__dot"
            style={{ background: value ? resolveColor(value, 'fill', theme) : 'var(--wc-border-input)' }}
          />
        </button>
      )}
    >
      {(close) => (
        <div className="wf-pop">
          <ColorSwatches
            value={value}
            theme={theme}
            role="fill"
            onChange={(c) => {
              onChange(c);
              close();
            }}
          />
          {onReset && (
            <MenuItem
              label={t('contextBar.resetColor')}
              onClick={() => {
                onReset();
                close();
              }}
            />
          )}
        </div>
      )}
    </Popover>
  );
}

function StringList({
  values,
  onChange,
  addLabel,
  removeLabel,
  placeholder,
  min = 1,
  extra,
}: {
  values: readonly string[];
  onChange: (next: string[]) => void;
  addLabel: string;
  removeLabel: string;
  placeholder: string;
  min?: number;
  extra?: (index: number) => ReactNode;
}): JSX.Element {
  return (
    <>
      {values.map((v, i) => (
        <div key={i} className="wf-pop__row">
          {extra?.(i)}
          <input
            className="wf-field"
            value={v}
            placeholder={placeholder}
            aria-label={placeholder}
            onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value : x)))}
          />
          <IconButton
            icon="Trash2"
            label={removeLabel}
            size="sm"
            disabled={values.length <= min}
            onClick={() => onChange(values.filter((_, j) => j !== i))}
          />
        </div>
      ))}
      <button type="button" className="wf-seg-btn" onClick={() => onChange([...values, ''])}>
        {addLabel}
      </button>
    </>
  );
}

/* ------------------------------------------------------------------------------------------
 * Wire component context bar
 * ---------------------------------------------------------------------------------------- */

export function WireContextBar({ elements, api }: ContextBarProps<WireElement>): JSX.Element | null {
  const { t } = useTranslation('wireframe');
  const update = useWireUpdate(api, elements);
  const fileInput = useRef<HTMLInputElement>(null);
  const first = elements[0];
  if (!first) return null;
  const kinds = new Set(elements.map((e) => e.component));
  const single = kinds.size === 1;
  const entry = entryOf(first.component);
  const controls: readonly WireControl[] = single ? entry.controls : ['color'];
  const remember = (style: Record<string, string>) => {
    for (const el of elements) api.rememberStyle(`wire:${el.component}`, style);
  };

  const sizeControl = (
    <Seg<WireSize>
      key="size"
      value={first.size}
      options={(['S', 'M', 'L'] as const).map((s) => ({
        value: s,
        label: t(`sizes.short.${s}`),
        title: t(`sizes.${s}`),
      }))}
      onChange={(s) =>
        update((el) => {
          Object.assign(el, sizePatch(el as WireElement, s));
        })
      }
    />
  );

  const stateControl = (
    <Popover
      key="state"
      trigger={({ toggle, open }) => (
        <IconButton
          icon="ToggleRight"
          label={`${t('contextBar.state')}: ${t(`states.${first.state}` as never)}`}
          size="sm"
          tooltipSide="top"
          active={open}
          onClick={toggle}
        />
      )}
    >
      {(close) => (
        <div className="wc-menu">
          {entry.states.map((s) => (
            <MenuItem
              key={s}
              label={t(`states.${s}` as never)}
              active={first.state === s}
              onClick={() => {
                update((el) => {
                  Object.assign(el, statePatch(el as WireElement, s));
                });
                close();
              }}
            />
          ))}
        </div>
      )}
    </Popover>
  );

  const colorControl = (
    <ColorButton
      key="color"
      label={t('contextBar.color')}
      theme={api.theme}
      value={first.color}
      onChange={(c) => {
        update((el) => {
          el.color = c;
        });
        remember({ color: c });
      }}
      onReset={() =>
        update((el) => {
          delete el.color;
        })
      }
    />
  );

  const iconControl = (
    <Popover
      key="icon"
      trigger={({ toggle, open }) => (
        <IconButton
          icon="Smile"
          label={t('contextBar.icon')}
          size="sm"
          tooltipSide="top"
          active={open || !!stringProp(first.props, 'icon', '')}
          onClick={toggle}
        />
      )}
    >
      {(close) => (
        <IconPicker
          value={stringProp(first.props, 'icon', '')}
          onPick={(name) => {
            update((el) => {
              if (name) el.props['icon'] = name;
              else delete el.props['icon'];
            });
            close();
          }}
        />
      )}
    </Popover>
  );

  const optionsControl = (() => {
    const kind = first.component;
    return (
      <Popover
        key="options"
        trigger={({ toggle, open }) => (
          <IconButton
            icon="ListPlus"
            label={t('contextBar.options')}
            size="sm"
            tooltipSide="top"
            active={open}
            onClick={toggle}
          />
        )}
      >
        {() => {
          if (kind === 'table') return <TableEditor element={first} update={update} />;
          const items = stringArrayProp(first.props, kind === 'dropdown' ? 'options' : 'items');
          const key = kind === 'dropdown' ? 'options' : 'items';
          const icons = stringArrayProp(first.props, 'icons');
          const active = numberProp(first.props, kind === 'dropdown' ? 'selected' : 'active', 0);
          const setItems = (next: string[]) =>
            update((el) => {
              el.props[key] = next;
              if (kind === 'mobileTabs') {
                const ic = stringArrayProp(el.props, 'icons');
                el.props['icons'] = next.map((_, i) => ic[i] ?? 'circle');
              }
              if (kind === 'dropdown') el.h = dropdownHeight(el.size, el.state, next.length);
              const clamp = Math.min(
                numberProp(el.props, kind === 'dropdown' ? 'selected' : 'active', 0),
                Math.max(0, next.length - 1),
              );
              el.props[kind === 'dropdown' ? 'selected' : 'active'] = clamp;
            }, 'options');
          return (
            <div className="wf-pop">
              <div className="wf-pop__row" style={{ fontSize: 12, color: 'var(--wc-fg-subtler)' }}>
                {kind === 'dropdown' ? t('contextBar.selected') : t('contextBar.active')}
                <Seg<string>
                  value={String(active)}
                  options={items
                    .slice(0, 8)
                    .map((_, i) => ({ value: String(i), label: String(i + 1), title: String(i + 1) }))}
                  onChange={(v) =>
                    update((el) => {
                      el.props[kind === 'dropdown' ? 'selected' : 'active'] = Number(v);
                    })
                  }
                />
              </div>
              <StringList
                values={items}
                onChange={setItems}
                addLabel={t('contextBar.addOption')}
                removeLabel={t('contextBar.removeOption')}
                placeholder={t('contextBar.optionPlaceholder')}
                extra={
                  kind === 'mobileTabs'
                    ? (i) => (
                        <Popover
                          trigger={({ toggle }) => (
                            <IconButton icon="Smile" label={t('contextBar.tabIcon')} size="sm" onClick={toggle} />
                          )}
                        >
                          {(closeIcon) => (
                            <IconPicker
                              value={icons[i]}
                              onPick={(name) => {
                                update((el) => {
                                  const ic = stringArrayProp(el.props, 'icons');
                                  ic[i] = name || 'circle';
                                  el.props['icons'] = ic;
                                });
                                closeIcon();
                              }}
                            />
                          )}
                        </Popover>
                      )
                    : undefined
                }
              />
            </div>
          );
        }}
      </Popover>
    );
  })();

  const valueControl = (() => {
    const isStars = first.component === 'stars';
    const max = isStars ? 5 : 1;
    const step = isStars ? 0.5 : 0.05;
    return (
      <Popover
        key="value"
        trigger={({ toggle, open }) => (
          <IconButton
            icon="SlidersHorizontal"
            label={t('contextBar.value')}
            size="sm"
            tooltipSide="top"
            active={open}
            onClick={toggle}
          />
        )}
      >
        {() => (
          <div className="wf-pop">
            <input
              className="wf-range"
              type="range"
              min={0}
              max={max}
              step={step}
              aria-label={t('contextBar.value')}
              value={numberProp(first.props, 'value', isStars ? 4 : 0.5)}
              onChange={(e) =>
                update((el) => {
                  el.props['value'] = Number(e.target.value);
                }, 'value')
              }
            />
          </div>
        )}
      </Popover>
    );
  })();

  const textModeControl = (
    <div key="textMode" className="wf-seg">
      <IconButton
        icon="TextAlignStart"
        label={t('contextBar.textLorem')}
        size="sm"
        tooltipSide="top"
        active={first.component === 'loremIpsum'}
        onClick={() =>
          update((el) => {
            el.component = 'loremIpsum';
          })
        }
      />
      <IconButton
        icon="AlignJustify"
        label={t('contextBar.textBlock')}
        size="sm"
        tooltipSide="top"
        active={first.component === 'blockText'}
        onClick={() =>
          update((el) => {
            el.component = 'blockText';
          })
        }
      />
    </div>
  );

  const uploadControl = (
    <span key="upload" style={{ display: 'inline-flex' }}>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          void api
            .importImage(file)
            .then(({ url, width, height }) => {
              update((el) => {
                el.props['src'] = url;
                if (width > 0 && height > 0) el.h = Math.max(8, Math.round((el.w * height) / width));
              });
            })
            .catch(() => api.services.notify('wireframe:errors.imageImport', { kind: 'error' }));
        }}
      />
      <IconButton
        icon="Upload"
        label={t('contextBar.upload')}
        size="sm"
        tooltipSide="top"
        onClick={() => fileInput.current?.click()}
      />
      {stringProp(first.props, 'src', '') && (
        <IconButton
          icon="ImageOff"
          label={t('contextBar.removeImage')}
          size="sm"
          tooltipSide="top"
          onClick={() =>
            update((el) => {
              delete el.props['src'];
            })
          }
        />
      )}
    </span>
  );

  const fitControl = (() => {
    const frame = fitTarget(api, first);
    return (
      <IconButton
        key="fit"
        icon="Fullscreen"
        label={t('contextBar.fitFrame')}
        size="sm"
        tooltipSide="top"
        disabled={!frame}
        onClick={() => frame && fitToFrame(api, first.id, frame)}
      />
    );
  })();

  const pointerControl = (
    <Popover
      key="pointer"
      trigger={({ toggle, open }) => (
        <IconButton
          icon="MessageSquare"
          label={t('contextBar.pointer')}
          size="sm"
          tooltipSide="top"
          active={open}
          onClick={toggle}
        />
      )}
    >
      {(close) => (
        <div className="wc-menu">
          {(['bottom', 'top', 'left', 'right', 'none'] as const).map((side) => (
            <MenuItem
              key={side}
              label={t(`pointer.${side}`)}
              active={stringProp(first.props, 'pointer', 'bottom') === side}
              onClick={() => {
                update((el) => {
                  el.props['pointer'] = side;
                });
                close();
              }}
            />
          ))}
        </div>
      )}
    </Popover>
  );

  const directionControl = (
    <IconButton
      key="direction"
      icon="ArrowRightLeft"
      label={t('contextBar.direction')}
      size="sm"
      tooltipSide="top"
      onClick={() =>
        update((el) => {
          const f = flipLine(el as WireElement);
          el.x = f.x;
          el.y = f.y;
          el.w = f.w;
          el.h = f.h;
          el.props['direction'] = f.direction;
        })
      }
    />
  );

  const dashedControl = (
    <IconButton
      key="dashed"
      icon="Ellipsis"
      label={t('contextBar.dashed')}
      size="sm"
      tooltipSide="top"
      active={first.props['dashed'] === true}
      onClick={() =>
        update((el) => {
          el.props['dashed'] = el.props['dashed'] !== true;
        })
      }
    />
  );

  const variantControl = (
    <div key="variant" className="wf-seg">
      {(['solid', 'outline'] as const).map((v) => (
        <IconButton
          key={v}
          icon={v === 'solid' ? 'SquareMousePointer' : 'RectangleHorizontal'}
          label={t(v === 'solid' ? 'contextBar.variantSolid' : 'contextBar.variantOutline')}
          size="sm"
          tooltipSide="top"
          active={stringProp(first.props, 'variant', 'solid') === v}
          onClick={() =>
            update((el) => {
              el.props['variant'] = v;
            })
          }
        />
      ))}
    </div>
  );

  const byControl: Record<WireControl, ReactNode> = {
    size: sizeControl,
    state: stateControl,
    color: colorControl,
    variant: variantControl,
    icon: iconControl,
    options: optionsControl,
    value: valueControl,
    textMode: textModeControl,
    upload: uploadControl,
    fitFrame: fitControl,
    pointer: pointerControl,
    direction: directionControl,
    dashed: dashedControl,
  };
  if (controls.length === 0) return null;
  return (
    <>
      {controls.map((c, i) => (
        <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          {i > 0 && <Divider vertical />}
          {byControl[c]}
        </span>
      ))}
    </>
  );
}

function TableEditor({
  element,
  update,
}: {
  element: WireElement;
  update: (fn: Patch, key?: string) => void;
}): JSX.Element {
  const { t } = useTranslation('wireframe');
  const cells = tableCells(element.props);
  const rows = cells.length;
  const cols = cells[0]?.length ?? 1;
  const resize = (nextRows: number, nextCols: number) =>
    update((el) => {
      const grid = tableCells({ ...el.props, rows: nextRows, cols: nextCols, cells: el.props['cells'] });
      el.props['rows'] = nextRows;
      el.props['cols'] = nextCols;
      el.props['cells'] = grid;
      const rowH = Math.max(TABLE_ROW_HEIGHT / 2, Math.round(el.h / Math.max(1, rows)));
      el.h = rowH * nextRows;
    });
  const setCell = (r: number, c: number, value: string) =>
    update((el) => {
      const grid = tableCells(el.props);
      grid[r]![c] = value;
      el.props['cells'] = grid;
    }, 'cell');
  return (
    <div className="wf-pop" style={{ minWidth: 240 }}>
      <div className="wf-pop__row">
        <span style={{ fontSize: 12, flex: 1 }}>{t('contextBar.rows')}</span>
        <IconButton
          icon="Minus"
          label={t('contextBar.removeOption')}
          size="sm"
          disabled={rows <= 1}
          onClick={() => resize(rows - 1, cols)}
        />
        <span>{rows}</span>
        <IconButton
          icon="Plus"
          label={t('contextBar.addOption')}
          size="sm"
          disabled={rows >= 12}
          onClick={() => resize(rows + 1, cols)}
        />
      </div>
      <div className="wf-pop__row">
        <span style={{ fontSize: 12, flex: 1 }}>{t('contextBar.columns')}</span>
        <IconButton
          icon="Minus"
          label={t('contextBar.removeOption')}
          size="sm"
          disabled={cols <= 1}
          onClick={() => resize(rows, cols - 1)}
        />
        <span>{cols}</span>
        <IconButton
          icon="Plus"
          label={t('contextBar.addOption')}
          size="sm"
          disabled={cols >= 8}
          onClick={() => resize(rows, cols + 1)}
        />
      </div>
      <label className="wf-pop__row" style={{ fontSize: 12 }}>
        <input
          type="checkbox"
          checked={element.props['header'] === true}
          onChange={(e) =>
            update((el) => {
              el.props['header'] = e.target.checked;
            })
          }
        />
        {t('contextBar.headerRow')}
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 4 }}>
        {cells.flatMap((row, r) =>
          row.map((value, c) => (
            <input
              key={`${r}:${c}`}
              className="wf-field"
              style={{ height: 24, minWidth: 0 }}
              value={value}
              aria-label={t('contextBar.cell', { row: r + 1, column: c + 1 })}
              onChange={(e) => setCell(r, c, e.target.value)}
            />
          )),
        )}
      </div>
    </div>
  );
}

/** Frame an overlay can fit into: its container, or the frame under its centre. */
function fitTarget(api: CanvasApi, el: WireElement): FrameElement | undefined {
  const doc = api.getDocument();
  if (el.containerId) {
    const c = doc.elements.find((e) => e.id === el.containerId);
    if (c?.type === 'frame') return c;
  }
  return frameAtPoint(doc, el.x + el.w / 2, el.y + el.h / 2);
}

function fitToFrame(api: CanvasApi, id: string, frame: FrameElement): void {
  const r = overlayRectFor(frame);
  api.update((d) => {
    const el = d.elements.find((e) => e.id === id);
    if (el && el.type === 'wire') {
      el.x = r.x;
      el.y = r.y;
      el.w = r.w;
      el.h = r.h;
      el.containerId = frame.id;
    }
  });
}

/* ------------------------------------------------------------------------------------------
 * Frame context bar
 * ---------------------------------------------------------------------------------------- */

export function FrameContextBar({ elements, api }: ContextBarProps<FrameElement>): JSX.Element | null {
  const { t } = useTranslation('wireframe');
  const first = elements[0];
  if (!first) return null;
  const ids = new Set(elements.map((e) => e.id));
  const spec = specOf(first.device);
  const update = (fn: (el: Draft<FrameElement>) => void) =>
    api.update((d) => {
      for (const el of d.elements) if (ids.has(el.id) && el.type === 'frame') fn(el as Draft<FrameElement>);
    });
  return (
    <>
      <Popover
        trigger={({ toggle, open }) => (
          <IconButton
            icon={spec.icon}
            label={`${t('contextBar.device')}: ${t(`frames.${first.device}`)}`}
            size="sm"
            tooltipSide="top"
            active={open}
            onClick={toggle}
          />
        )}
      >
        {(close) => (
          <div className="wc-menu">
            {FRAME_LAUNCHER_ORDER.map((device: DeviceKind, i) => (
              <MenuItem
                key={device}
                icon={specOf(device).icon}
                label={`${i + 1}. ${t(`frames.${device}`)}`}
                active={first.device === device}
                onClick={() => {
                  update((el) => {
                    Object.assign(el, frameWithDevice(el as FrameElement, device));
                  });
                  close();
                }}
              />
            ))}
          </div>
        )}
      </Popover>
      {supportsOrientation(first.device) && (
        <IconButton
          icon="RotateCw"
          label={t(first.orientation === 'portrait' ? 'contextBar.landscape' : 'contextBar.portrait')}
          size="sm"
          tooltipSide="top"
          onClick={() =>
            update((el) => {
              Object.assign(
                el,
                frameWithOrientation(el as FrameElement, el.orientation === 'portrait' ? 'landscape' : 'portrait'),
              );
            })
          }
        />
      )}
      {spec.statusBar > 0 && (
        <IconButton
          icon="Signal"
          label={t('frames.statusBar')}
          size="sm"
          tooltipSide="top"
          active={first.statusBar}
          onClick={() =>
            update((el) => {
              el.statusBar = !el.statusBar;
            })
          }
        />
      )}
      {spec.keyboard && (
        <IconButton
          icon="Keyboard"
          label={t('frames.keyboard')}
          size="sm"
          tooltipSide="top"
          active={first.keyboard}
          onClick={() =>
            update((el) => {
              el.keyboard = !el.keyboard;
            })
          }
        />
      )}
      <Divider vertical />
      <IconButton
        icon="PenLine"
        label={t('contextBar.rename')}
        shortcutId="wireframe.renameFrame"
        size="sm"
        tooltipSide="top"
        onClick={() => api.startTextEditing(first.id, { selectAll: true })}
      />
    </>
  );
}

/* ------------------------------------------------------------------------------------------
 * Annotation context bar
 * ---------------------------------------------------------------------------------------- */

/** Adds the leader line of an annotation: a regular connector ending in a dot. */
export function addAnnotationArrow(api: CanvasApi, annotation: AnnotationElement): string {
  const id = api.createId();
  const connector: ConnectorElement = {
    id,
    type: 'connector',
    start: { kind: 'attached', elementId: annotation.id, side: 'auto' },
    end: { kind: 'free', x: annotation.x + annotation.w + 72, y: annotation.y + annotation.h + 48 },
    route: 'straight',
    color: annotation.color,
    dashed: false,
    startEndpoint: 'none',
    endEndpoint: 'circle',
  };
  api.update((d) => {
    d.elements.push(connector);
  });
  api.setSelection([id]);
  return id;
}

export function AnnotationContextBar({ elements, api }: ContextBarProps<AnnotationElement>): JSX.Element | null {
  const { t } = useTranslation('wireframe');
  const first = elements[0];
  if (!first) return null;
  const ids = new Set(elements.map((e) => e.id));
  const update = (fn: (el: Draft<AnnotationElement>) => void) =>
    api.update((d) => {
      for (const el of d.elements) if (ids.has(el.id) && el.type === 'annotation') fn(el as Draft<AnnotationElement>);
    });
  return (
    <>
      <ColorButton
        label={t('contextBar.color')}
        theme={api.theme}
        value={first.color}
        onChange={(c) => {
          update((el) => {
            el.color = c;
          });
          api.rememberStyle('annotation', { color: c });
        }}
      />
      <Divider vertical />
      <IconButton
        icon="Hash"
        label={t('contextBar.numbering')}
        size="sm"
        tooltipSide="top"
        active={first.autoNumber}
        onClick={() => {
          const on = !first.autoNumber;
          api.update((d) => {
            for (const el of d.elements) if (ids.has(el.id) && el.type === 'annotation') el.autoNumber = on;
            if (on) renumberAnnotations(d);
          });
          api.rememberStyle('annotation', { autoNumber: on });
        }}
      />
      <Popover
        trigger={({ toggle, open }) => (
          <IconButton
            icon="Smile"
            label={t('contextBar.icon')}
            size="sm"
            tooltipSide="top"
            active={open || !!first.icon}
            onClick={toggle}
          />
        )}
      >
        {(close) => (
          <IconPicker
            value={first.icon}
            onPick={(name) => {
              update((el) => {
                if (name) el.icon = name;
                else delete el.icon;
              });
              close();
            }}
          />
        )}
      </Popover>
      <IconButton
        icon="Square"
        label={t('contextBar.outline')}
        size="sm"
        tooltipSide="top"
        active={first.outline}
        onClick={() => {
          update((el) => {
            el.outline = !first.outline;
          });
          api.rememberStyle('annotation', { outline: !first.outline });
        }}
      />
      <Divider vertical />
      <IconButton
        icon="MoveUpRight"
        label={t('contextBar.addArrow')}
        size="sm"
        tooltipSide="top"
        onClick={() => addAnnotationArrow(api, first)}
      />
    </>
  );
}
