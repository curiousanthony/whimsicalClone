import { useEffect, useMemo, useRef } from 'react';
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useTranslation } from 'react-i18next';
import { lowlight } from '../extensions';
import { LANGUAGE_PICKER_EVENT } from '../extensions/keymap';

/** Code block with a language picker; the language is auto-detected until one is chosen. */
export function CodeBlockView({ node, updateAttributes, editor, getPos }: NodeViewProps): JSX.Element {
  const { t } = useTranslation('docs');
  const selectRef = useRef<HTMLSelectElement>(null);
  const languages = useMemo(() => lowlight.listLanguages().sort(), []);
  const language = typeof node.attrs.language === 'string' ? node.attrs.language : '';

  useEffect(() => {
    const dom = editor.view.dom;
    const open = (): void => {
      const pos = getPos();
      if (typeof pos !== 'number') return;
      const { from } = editor.state.selection;
      if (from < pos || from > pos + node.nodeSize) return;
      const select = selectRef.current;
      if (!select) return;
      select.focus();
      try {
        select.showPicker();
      } catch {
        // showPicker needs a user gesture in some contexts; focus is enough then.
      }
    };
    dom.addEventListener(LANGUAGE_PICKER_EVENT, open);
    return () => dom.removeEventListener(LANGUAGE_PICKER_EVENT, open);
  }, [editor, getPos, node.nodeSize]);

  return (
    <NodeViewWrapper className="docs-codeblock">
      <div className="docs-codeblock-header" contentEditable={false}>
        <select
          ref={selectRef}
          aria-label={t('code.language')}
          value={language}
          onChange={(e) => {
            updateAttributes({ language: e.target.value === '' ? null : e.target.value });
            editor.commands.focus();
          }}
        >
          <option value="">{t('code.auto')}</option>
          {language !== '' && !languages.includes(language) && <option value={language}>{language}</option>}
          {languages.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <pre spellCheck={false}>
        <NodeViewContent as={'code' as unknown as 'div'} />
      </pre>
    </NodeViewWrapper>
  );
}
