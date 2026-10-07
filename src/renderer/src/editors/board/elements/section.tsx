/**
 * Section (.): a named, toned-down area. Container: objects dropped inside get its id as
 * `containerId` and move with it (engine). The name lives in a header band inside the top-left
 * corner so the whole section stays inside its bounds for hit testing.
 *
 * Outline sections only hit-test on their border and header, so clicking empty space inside
 * starts a marquee instead of selecting the section.
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Divider, IconButton } from '@renderer/canvas';
import { resolveColor } from '@renderer/core/palette';
import type { ContextBarProps, ElementDefinition, ElementRenderProps, Point, SectionElement } from '@renderer/core/types';
import { ColorControl } from '../controls';
import { normalizeSection, SECTION_HEADER_HEIGHT } from '../model';

function NameEditor({ element, api }: { element: SectionElement; api: ElementRenderProps<SectionElement>['api'] }): JSX.Element {
  const { t } = useTranslation('board');
  const [value, setValue] = useState(element.name);
  const input = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);
  const commit = () => {
    if (done.current) return;
    done.current = true;
    if (value !== element.name) {
      api.update(
        (d) => {
          const el = d.elements.find((e) => e.id === element.id);
          if (el && el.type === 'section') el.name = value;
        },
        { coalesceKey: `text:${element.id}` },
      );
    }
    api.stopTextEditing();
  };
  return (
    <input
      ref={input}
      className="wc-board-section__input"
      data-wc-editing=""
      value={value}
      placeholder={t('section.namePlaceholder')}
      spellCheck={false}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          done.current = true;
          api.stopTextEditing();
        }
      }}
    />
  );
}

function SectionRender({ element, editing, api, theme }: ElementRenderProps<SectionElement>): JSX.Element {
  const solid = element.fill === 'solid';
  const stroke = resolveColor(element.color, 'stroke', theme);
  return (
    <div
      className={`wc-board-section${solid ? ' is-solid' : ''}`}
      style={{
        background: solid ? resolveColor(element.color, 'soft', theme) : 'transparent',
        borderColor: solid ? 'transparent' : stroke,
      }}
    >
      <div className="wc-board-section__header" style={{ height: SECTION_HEADER_HEIGHT, color: resolveColor(element.color === 'gray' ? 'gray' : element.color, 'text', theme) }}>
        {editing ? <NameEditor element={element} api={api} /> : <span className="wc-board-section__name">{element.name}</span>}
      </div>
    </div>
  );
}

/** True when `p` lies on the border band or header of an outline section. */
export function hitSectionFrame(el: SectionElement, p: Point, tolerance: number): boolean {
  const inside = p.x >= el.x && p.x <= el.x + el.w && p.y >= el.y && p.y <= el.y + el.h;
  if (!inside) return false;
  if (el.fill === 'solid') return true;
  const band = Math.max(tolerance, 6);
  const onEdge = p.x - el.x <= band || el.x + el.w - p.x <= band || p.y - el.y <= band || el.y + el.h - p.y <= band;
  return onEdge || p.y - el.y <= SECTION_HEADER_HEIGHT;
}

function SectionContextBar({ elements, api }: ContextBarProps<SectionElement>): JSX.Element {
  const { t } = useTranslation('board');
  const first = elements[0]!;
  const ids = new Set(elements.map((e) => e.id));
  const patch = (patchValue: Partial<SectionElement>) =>
    api.update((d) => {
      for (const el of d.elements) if (ids.has(el.id) && el.type === 'section') Object.assign(el, patchValue);
    });
  return (
    <>
      <IconButton icon="Pencil" label={t('section.rename')} size="sm" tooltipSide="top" onClick={() => api.startTextEditing(first.id)} />
      <ColorControl elements={elements} api={api} role="soft" />
      <Divider vertical />
      <IconButton
        icon={first.fill === 'solid' ? 'Square' : 'SquareDashed'}
        label={first.fill === 'solid' ? t('section.outline') : t('section.solid')}
        size="sm"
        tooltipSide="top"
        onClick={() => patch({ fill: first.fill === 'solid' ? 'outline' : 'solid' })}
      />
      <IconButton icon="Crop" label={t('section.clip')} active={first.clip} size="sm" tooltipSide="top" onClick={() => patch({ clip: !first.clip })} />
    </>
  );
}

export const sectionDefinition: ElementDefinition<SectionElement> = {
  type: 'section',
  module: 'board',
  layer: 'box',
  Render: SectionRender,
  getBounds: (e) => ({ x: e.x, y: e.y, w: e.w, h: e.h }),
  hitTest: (e, p, tolerance) => hitSectionFrame(e, p, tolerance),
  resize: 'free',
  rotatable: false,
  connectable: true,
  textEditable: true,
  container: true,
  styleProps: ['color', 'fill', 'clip'],
  ContextBar: SectionContextBar,
  normalize: normalizeSection,
};
