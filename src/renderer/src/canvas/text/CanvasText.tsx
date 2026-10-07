/**
 * Text block for canvas element renderers: static RichTextView normally, the inline
 * RichTextEditor while the element is being edited. Commits through the engine (one coalesced
 * undo step per editing burst, key "text:<id>").
 *
 * Usage inside an ElementDefinition.Render:
 *   <CanvasText element={element} editing={editing} api={api} text={element.text}
 *               textSize={element.textSize} align="center" verticalAlign="middle" />
 */

import type { CSSProperties } from 'react';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { TEXT_SIZE_PX, WIREFRAME_TEXT_SIZE_PX } from '@renderer/core/palette';
import type { BoardElement, CanvasApi, RichText, TextAlign, TextSize, VerticalAlign } from '@renderer/core/types';
import { useOptionalEngine } from '../engine/context';
import type { CanvasEngine } from '../engine/engine';
import type { EditingState } from '../engine/store';
import { LINE_HEIGHT } from '../measureText';
import { RichTextEditor } from './RichTextEditor';
import { RichTextView } from './RichTextView';

export interface CanvasTextProps {
  element: BoardElement;
  text: RichText | undefined;
  editing: boolean;
  api: CanvasApi;
  textSize: TextSize;
  scale?: 'board' | 'wireframe';
  align?: TextAlign;
  verticalAlign?: VerticalAlign;
  /** CSS colour of the text. */
  color?: string;
  bold?: boolean;
  paragraphsOnly?: boolean;
  placeholder?: string;
  /** Sub-field being edited (e.g. a table cell "row:col"); edits go to setText unless onCommit is given. */
  field?: string;
  /** Custom commit (e.g. table cells); default: definition.setText via the engine. */
  onCommit?: (text: RichText) => void;
  onEnter?: () => boolean;
  onTab?: (shift: boolean) => boolean;
  padding?: number | string;
  className?: string;
  style?: CSSProperties;
}

type EditingSlice = { editing: EditingState | undefined };
// Inert store used when CanvasText renders outside an engine (exports, previews).
const fallbackStore: StoreApi<EditingSlice> = createStore<EditingSlice>(() => ({ editing: undefined }));

export function CanvasText(props: CanvasTextProps): JSX.Element {
  const engine = useOptionalEngine();
  const store = (engine?.store ?? fallbackStore) as unknown as StoreApi<EditingSlice>;
  const editingState = useStore(store, (s) => s.editing);
  const { element, text, editing, api, textSize, scale, align = 'left', verticalAlign = 'top', color, bold, padding } = props;
  const fontSize = (scale === 'wireframe' ? WIREFRAME_TEXT_SIZE_PX : TEXT_SIZE_PX)[textSize];
  const fieldMatches = !props.field || editingState?.field === props.field;
  const isEditing = editing && fieldMatches;
  const style: CSSProperties = {
    fontSize,
    lineHeight: LINE_HEIGHT,
    textAlign: align,
    color,
    fontWeight: bold ? 700 : undefined,
    justifyContent: verticalAlign === 'middle' ? 'center' : verticalAlign === 'bottom' ? 'flex-end' : 'flex-start',
    padding,
    ...props.style,
  };
  const className = ['wc-canvas-text', props.className].filter(Boolean).join(' ');
  if (!isEditing) {
    return (
      <div className={className} style={style}>
        <RichTextView value={text} />
      </div>
    );
  }
  const commit = (next: RichText) => {
    if (props.onCommit) props.onCommit(next);
    else (engine as CanvasEngine | null)?.setElementText(element.id, next, props.field);
  };
  return (
    <div className={`${className} wc-canvas-text--editing`} style={style} data-wc-editing="">
      <RichTextEditor
        key={editingState?.seq ?? 0}
        value={text ?? { blocks: [{ type: 'p', spans: [] }] }}
        onChange={commit}
        onDone={() => api.stopTextEditing()}
        selectAll={editingState?.selectAll}
        paragraphsOnly={props.paragraphsOnly}
        placeholder={props.placeholder}
        onEnter={props.onEnter}
        onTab={props.onTab}
      />
    </div>
  );
}
