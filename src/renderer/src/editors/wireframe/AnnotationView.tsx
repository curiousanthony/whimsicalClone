/**
 * Annotation renderer: a numbered (or icon) callout with editable text. Its leader line is a
 * regular canvas connector that starts at the annotation (see addAnnotationArrow).
 */

import { CanvasText } from '@renderer/canvas';
import { resolveColor } from '@renderer/core/palette';
import type { AnnotationElement, ElementRenderProps } from '@renderer/core/types';
import { Glyph } from './draw';
import './wireframe.css';

export function AnnotationRender({ element, theme, api, editing }: ElementRenderProps<AnnotationElement>): JSX.Element {
  const accent = resolveColor(element.color, 'fill', theme);
  const onAccent = resolveColor(element.color, 'onFill', theme);
  const soft = resolveColor(element.color, 'soft', theme);
  const ink = resolveColor('slate', 'text', theme);
  const badge = element.autoNumber && element.number !== undefined ? String(element.number) : undefined;
  const surface = theme === 'dark' ? '#19232c' : '#ffffff';
  return (
    <div
      className="wf-annotation"
      style={{
        background: element.outline ? surface : soft,
        border: `2px solid ${accent}`,
        fontFamily: 'var(--wc-font-sans)',
      }}
    >
      {(badge || element.icon) && (
        <span className="wf-annotation__badge" style={{ background: accent, color: onAccent }}>
          {badge ?? <Glyph name={element.icon} size={14} color={onAccent} />}
        </span>
      )}
      <div className="wf-annotation__text">
        <CanvasText
          element={element}
          text={element.text}
          editing={editing}
          api={api}
          textSize="m"
          scale="wireframe"
          verticalAlign="middle"
          color={ink}
        />
      </div>
    </div>
  );
}
