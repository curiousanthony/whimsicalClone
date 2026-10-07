import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@renderer/ui';
import { parseEmbedUrl, type EmbedProvider } from '../logic/embedUrl';

export interface EmbedViewOptions {
  openUrl?: (url: string) => void;
  openFile?: (path: string) => void;
}

const PROVIDER_ICON: Record<EmbedProvider, string> = {
  youtube: 'SquarePlay',
  vimeo: 'SquarePlay',
  loom: 'Video',
  figma: 'Figma',
  airtable: 'Table2',
  canva: 'Palette',
  hex: 'Hexagon',
  codepen: 'CodeXml',
  whimsical: 'LayoutDashboard',
  link: 'Globe',
};

const PROVIDER_NAME: Record<EmbedProvider, string> = {
  youtube: 'YouTube',
  vimeo: 'Vimeo',
  loom: 'Loom',
  figma: 'Figma',
  airtable: 'Airtable',
  canva: 'Canva',
  hex: 'Hex',
  codepen: 'CodePen',
  whimsical: 'Whimsical',
  link: '',
};

/**
 * External embeds render as link cards: the renderer's Content-Security-Policy forbids frames,
 * and the app works offline.
 */
export function EmbedView({ node, extension }: NodeViewProps): JSX.Element {
  const { t } = useTranslation('docs');
  const options = extension.options as EmbedViewOptions;
  const url = String(node.attrs.url ?? '');
  const parsed = parseEmbedUrl(url);
  const provider = parsed?.provider ?? 'link';
  const title = PROVIDER_NAME[provider] || parsed?.host || t('embed.title');
  return (
    <NodeViewWrapper className="docs-embed" data-drag-handle contentEditable={false}>
      <span className="docs-embed-icon">
        <Icon name={PROVIDER_ICON[provider]} size={18} fallback={<Icon name="Globe" size={18} />} />
      </span>
      <span className="docs-embed-text">
        <div className="docs-embed-title">{title}</div>
        <div className="docs-embed-url">{url}</div>
      </span>
      {parsed && (
        <button type="button" onClick={() => options.openUrl?.(parsed.url)}>
          {t('embed.open')}
        </button>
      )}
    </NodeViewWrapper>
  );
}

export function BoardEmbedView({ node, extension }: NodeViewProps): JSX.Element {
  const { t } = useTranslation('docs');
  const options = extension.options as EmbedViewOptions;
  const path = String(node.attrs.path ?? '');
  const name = path.split('/').pop() ?? path;
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
  return (
    <NodeViewWrapper className="docs-embed" data-drag-handle contentEditable={false}>
      <span className="docs-embed-icon">
        <Icon name="LayoutDashboard" size={18} />
      </span>
      <span className="docs-embed-text">
        <div className="docs-embed-title">{ext ? name.slice(0, name.length - ext.length) : name}</div>
        <div className="docs-embed-url">{path}</div>
      </span>
      <button type="button" onClick={() => options.openFile?.(path)}>
        {t('embed.openBoard')}
      </button>
    </NodeViewWrapper>
  );
}
