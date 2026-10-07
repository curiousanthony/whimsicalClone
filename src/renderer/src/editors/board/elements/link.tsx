/**
 * Link object (K): external URL or internal workspace file ("wc://file/<relPath>"), shown as a
 * card or a compact pill. Enter / double-click edits the URL in place; the small "open" button
 * is the only interactive node so the rest of the card selects and drags like any object.
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Divider, Icon, IconButton } from '@renderer/canvas';
import type { CanvasApi, ContextBarProps, ElementDefinition, ElementRenderProps, LinkElement } from '@renderer/core/types';
import { linkDisplayTitle, linkSubtitle, linkTarget, LINK_CARD_SIZE, LINK_COMPACT_SIZE, normalizeLink, normalizeLinkUrl } from '../model';

/** Opens a link: workspace file in a tab, external URL through the main process. */
export async function openLink(api: CanvasApi, url: string): Promise<void> {
  const target = linkTarget(url);
  if (target.kind === 'file') {
    api.services.openFile(target.path);
  } else if (target.kind === 'external') {
    try {
      await api.services.api.app.openExternal(target.url);
    } catch {
      api.services.notify('board:notify.linkOpenFailed', { kind: 'error' });
    }
  } else {
    api.services.notify('board:notify.linkOpenFailed', { kind: 'error' });
  }
}

function LinkEditor({ element, api }: { element: LinkElement; api: CanvasApi }): JSX.Element {
  const { t } = useTranslation('board');
  const [value, setValue] = useState(element.url);
  const input = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);
  const commit = () => {
    if (done.current) return;
    done.current = true;
    const url = normalizeLinkUrl(value);
    if (url !== element.url) {
      api.update((d) => {
        const el = d.elements.find((e) => e.id === element.id);
        if (el && el.type === 'link') {
          el.url = url;
          delete el.title;
        }
      });
    }
    api.stopTextEditing();
  };
  return (
    <div className="wc-board-link__editor" data-wc-editing="">
      <Icon name="Link" size={16} />
      <input
        ref={input}
        className="wc-board-link__input"
        value={value}
        placeholder={t('link.placeholder')}
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
    </div>
  );
}

function LinkRender({ element, editing, api }: ElementRenderProps<LinkElement>): JSX.Element {
  const { t } = useTranslation('board');
  const target = linkTarget(element.url);
  const title = linkDisplayTitle(element, t('link.untitled'));
  const icon = target.kind === 'file' ? 'FileText' : target.kind === 'external' && element.url.toLowerCase().startsWith('mailto:') ? 'Mail' : 'Globe';
  if (editing) {
    return (
      <div className={`wc-board-link wc-board-link--${element.display}`}>
        <LinkEditor element={element} api={api} />
      </div>
    );
  }
  return (
    <div className={`wc-board-link wc-board-link--${element.display}`}>
      <span className="wc-board-link__icon">
        <Icon name={icon} size={element.display === 'card' ? 20 : 16} />
      </span>
      <span className="wc-board-link__text">
        <span className="wc-board-link__title">{title}</span>
        {element.display === 'card' && element.url && <span className="wc-board-link__url">{linkSubtitle(element.url)}</span>}
      </span>
      {element.url && (
        <button
          type="button"
          className="wc-board-link__open"
          data-wc-interactive=""
          aria-label={t('link.open')}
          title={t('link.open')}
          onClick={() => void openLink(api, element.url)}
        >
          <Icon name="ExternalLink" size={14} />
        </button>
      )}
    </div>
  );
}

function LinkContextBar({ elements, api }: ContextBarProps<LinkElement>): JSX.Element {
  const { t } = useTranslation('board');
  const first = elements[0]!;
  const ids = new Set(elements.map((e) => e.id));
  const setDisplay = (display: LinkElement['display']) =>
    api.update((d) => {
      for (const el of d.elements) {
        if (!ids.has(el.id) || el.type !== 'link') continue;
        el.display = display;
        const size = display === 'card' ? LINK_CARD_SIZE : LINK_COMPACT_SIZE;
        el.w = size.w;
        el.h = size.h;
      }
    });
  return (
    <>
      <IconButton icon="ExternalLink" label={t('link.open')} size="sm" tooltipSide="top" disabled={!first.url} onClick={() => void openLink(api, first.url)} />
      <IconButton icon="Pencil" label={t('link.edit')} size="sm" tooltipSide="top" onClick={() => api.startTextEditing(first.id)} />
      <Divider vertical />
      <IconButton icon="PanelTop" label={t('link.card')} active={first.display === 'card'} size="sm" tooltipSide="top" onClick={() => setDisplay('card')} />
      <IconButton icon="Minus" label={t('link.compact')} active={first.display === 'compact'} size="sm" tooltipSide="top" onClick={() => setDisplay('compact')} />
    </>
  );
}

export const linkDefinition: ElementDefinition<LinkElement> = {
  type: 'link',
  module: 'board',
  layer: 'box',
  Render: LinkRender,
  getBounds: (e) => ({ x: e.x, y: e.y, w: e.w, h: e.h }),
  resize: 'free',
  rotatable: false,
  connectable: true,
  // Enter / double-click edits the URL (own input in Render, no rich text).
  textEditable: true,
  ContextBar: LinkContextBar,
  normalize: normalizeLink,
};
