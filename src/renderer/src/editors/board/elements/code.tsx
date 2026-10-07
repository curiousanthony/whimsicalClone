/**
 * Standalone code block: monospace, syntax highlighted with lowlight (highlight.js grammars).
 * Enter / double-click edits the source in a textarea; the context bar picks the language.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { common, createLowlight } from 'lowlight';
import { useTranslation } from 'react-i18next';
import { MenuItem, Popover, IconButton } from '@renderer/canvas';
import type { CodeElement, ContextBarProps, ElementDefinition, ElementRenderProps } from '@renderer/core/types';
import { normalizeCode } from '../model';

const lowlight = createLowlight(common);

interface HastText {
  type: 'text';
  value: string;
}
interface HastElement {
  type: 'element';
  tagName: string;
  properties?: { className?: string[] };
  children: HastNode[];
}
type HastNode = HastText | HastElement | { type: string };

function toReact(nodes: readonly HastNode[], keyPrefix = ''): ReactNode[] {
  return nodes.map((node, i) => {
    const key = `${keyPrefix}${i}`;
    if (node.type === 'text') return (node as HastText).value;
    if (node.type === 'element') {
      const el = node as HastElement;
      return (
        <span key={key} className={el.properties?.className?.join(' ')}>
          {toReact(el.children, `${key}.`)}
        </span>
      );
    }
    return null;
  });
}

/** Languages offered in the picker (a subset of lowlight's `common` set). */
export const CODE_LANGUAGES: readonly string[] = [
  'bash',
  'c',
  'cpp',
  'csharp',
  'css',
  'diff',
  'go',
  'graphql',
  'xml',
  'java',
  'javascript',
  'json',
  'kotlin',
  'markdown',
  'php',
  'python',
  'ruby',
  'rust',
  'sql',
  'swift',
  'typescript',
  'yaml',
];

/** Highlights `code` (auto-detecting the language when `language` is "auto" or unknown). */
export function highlightCode(code: string, language: string): ReactNode[] {
  if (!code) return [];
  try {
    const known = language !== 'auto' && lowlight.registered(language);
    const tree = known ? lowlight.highlight(language, code) : lowlight.highlightAuto(code);
    return toReact(tree.children as HastNode[]);
  } catch {
    return [code];
  }
}

function CodeEditor({ element, api }: { element: CodeElement; api: ElementRenderProps<CodeElement>['api'] }): JSX.Element {
  const { t } = useTranslation('board');
  const [value, setValue] = useState(element.code);
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    area.current?.focus();
  }, []);
  return (
    <textarea
      ref={area}
      className="wc-board-code__editor"
      data-wc-editing=""
      value={value}
      spellCheck={false}
      placeholder={t('code.placeholder')}
      onPointerDown={(e) => e.stopPropagation()}
      onChange={(e) => {
        const code = e.target.value;
        setValue(code);
        api.update(
          (d) => {
            const el = d.elements.find((x) => x.id === element.id);
            if (el && el.type === 'code') el.code = code;
          },
          { coalesceKey: `text:${element.id}` },
        );
      }}
      onBlur={() => api.stopTextEditing()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') {
          e.preventDefault();
          api.stopTextEditing();
        } else if (e.key === 'Tab') {
          // Indent with two spaces instead of moving focus.
          e.preventDefault();
          const target = e.currentTarget;
          const { selectionStart, selectionEnd } = target;
          const next = `${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`;
          setValue(next);
          requestAnimationFrame(() => target.setSelectionRange(selectionStart + 2, selectionStart + 2));
          api.update(
            (d) => {
              const el = d.elements.find((x) => x.id === element.id);
              if (el && el.type === 'code') el.code = next;
            },
            { coalesceKey: `text:${element.id}` },
          );
        }
      }}
    />
  );
}

function CodeRender({ element, editing, api }: ElementRenderProps<CodeElement>): JSX.Element {
  const { t } = useTranslation('board');
  const highlighted = useMemo(() => highlightCode(element.code, element.language), [element.code, element.language]);
  return (
    <div className="wc-board-code">
      {editing ? (
        <CodeEditor element={element} api={api} />
      ) : (
        <pre className="wc-board-code__pre">
          <code className="hljs">{element.code ? highlighted : <span className="wc-board-code__placeholder">{t('code.placeholder')}</span>}</code>
        </pre>
      )}
    </div>
  );
}

function CodeContextBar({ elements, api }: ContextBarProps<CodeElement>): JSX.Element {
  const { t } = useTranslation('board');
  const first = elements[0]!;
  const ids = new Set(elements.map((e) => e.id));
  const setLanguage = (language: string) =>
    api.update((d) => {
      for (const el of d.elements) if (ids.has(el.id) && el.type === 'code') el.language = language;
    });
  return (
    <Popover
      trigger={({ toggle, open }) => (
        <IconButton icon="CodeXml" label={t('code.language')} active={open} size="sm" tooltipSide="top" onClick={toggle}>
          <span className="wc-board-code__lang">{first.language === 'auto' ? t('code.auto') : first.language}</span>
        </IconButton>
      )}
    >
      {(close) => (
        <div className="wc-menu wc-board-code__languages" onClick={close}>
          <MenuItem label={t('code.auto')} active={first.language === 'auto'} onClick={() => setLanguage('auto')} />
          {CODE_LANGUAGES.map((lang) => (
            <MenuItem key={lang} label={lang} active={first.language === lang} onClick={() => setLanguage(lang)} />
          ))}
        </div>
      )}
    </Popover>
  );
}

export const codeDefinition: ElementDefinition<CodeElement> = {
  type: 'code',
  module: 'board',
  layer: 'box',
  Render: CodeRender,
  getBounds: (e) => ({ x: e.x, y: e.y, w: e.w, h: e.h }),
  resize: 'free',
  rotatable: false,
  connectable: true,
  textEditable: true,
  styleProps: ['language'],
  ContextBar: CodeContextBar,
  normalize: normalizeCode,
};
