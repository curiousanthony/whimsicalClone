import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useTranslation } from 'react-i18next';

/** HTML blocks, front matter and link definitions are kept verbatim and shown as raw text. */
export function RawView({ node }: NodeViewProps): JSX.Element {
  const { t } = useTranslation('docs');
  const kind = String(node.attrs.kind ?? 'html');
  return (
    <NodeViewWrapper className="docs-raw">
      <span className="docs-raw-label" contentEditable={false}>
        {t(`raw.${kind}`, { defaultValue: kind })}
      </span>
      <pre spellCheck={false}>
        <NodeViewContent as={'code' as unknown as 'div'} />
      </pre>
    </NodeViewWrapper>
  );
}
