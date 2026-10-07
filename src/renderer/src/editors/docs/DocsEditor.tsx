/**
 * Docs editor (owner: docs module): a TipTap editor over a Markdown file.
 *
 * Content flow. `content` (Markdown) -> markdownToDoc -> TipTap. Every real document change is
 * serialized with docToMarkdown and committed with `onChange` right away; the host debounces the
 * disk write and flushes it before quit, so no keystroke can be lost in an editor-side timer.
 *  - A file is never rewritten just because it was opened or clicked: a change is emitted only
 *    when the serialized Markdown differs from the last known Markdown (`baseline`). This also
 *    absorbs normalising transactions such as TipTap's trailing paragraph.
 *  - New `content` that differs from what this editor emitted came from disk (external edit):
 *    it replaces the document without an update event and outside the undo history.
 * historyMode is "editor": TipTap owns undo; edit.undo / edit.redo are bound while active so the
 * native Edit menu reaches it (keyboard ⌘Z is handled by TipTap's own keymap first).
 */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { EditorContent, useEditor, useEditorState, type Editor, type JSONContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import DragHandle from '@tiptap/extension-drag-handle-react';
import type { Node as PMNode } from '@tiptap/pm/model';
import { NodeSelection } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { createEmptyBoard, serializeBoard } from '@renderer/core/boardFormat';
import { isTextInputTarget } from '@renderer/core/shortcuts';
import type { DocContent, EditorProps, ShortcutHandler } from '@renderer/core/types';
import { Icon, IconButton, Menu, type MenuAnchor, type MenuEntry } from '@renderer/ui';
import { getFileKindInfo, titleFromPath } from '@shared/fileKinds';
import type { Preferences } from '@shared/ipc';
import { createDocExtensions } from './extensions';
import { runBlockCommand, type BlockCommandContext } from './extensions/blockCommands';
import { blockIndexAt, topLevelBlocks } from './extensions/collapseHeadings';
import { searchEmojis } from './extensions/emoji';
import { createSuggestionExtension, type SuggestionBridge, type SuggestionPopupState } from './extensions/suggestion';
import { governingHeading } from './logic/collapse';
import { parseEmbedUrl } from './logic/embedUrl';
import { isTextSize, isTextWidth, layoutCssVars, stepTextSize, TEXT_SIZES, TEXT_WIDTHS, type DocTextSize, type DocTextWidth } from './logic/layout';
import { classifyHref, normalizeHref } from './logic/link';
import { filterFiles, flattenFiles, type LinkableFile } from './logic/mention';
import { headingSlug, nestedFolderOf, parentDocOf } from './logic/nested';
import { buildOutline, type OutlineItem } from './logic/outline';
import { looksLikeMarkdown, parseTsvTable, tableJson } from './logic/paste';
import { shortcutLabel } from './logic/shortcutLabels';
import { filterSlashItems, SLASH_ITEMS, type SlashItem, type SlashItemId } from './logic/slashItems';
import { docStats, type DocStats } from './logic/stats';
import { fileLinkHref, type DocNode } from './markdown/constants';
import { markdownToDoc } from './markdown/parse';
import { blocksToMarkdown, docToMarkdown } from './markdown/serialize';
import { InputPopover } from './ui/InputPopover';
import { SuggestionPopup } from './ui/SuggestionPopup';
import { TocPanel } from './ui/TocPanel';
import { createViewOverrides } from './views';
import './docs.css';

type FocusStyle = 'none' | 'paragraph' | 'typewriter';
type Rect = { left: number; right: number; top: number; bottom: number };
type Emoji = { shortcode: string; emoji: string };

const COLLAPSED_KEY = 'collapsed';
/** Block types offered by ⌘/, the bubble "Turn into" button and the block handle. */
const TURN_INTO: readonly SlashItemId[] = [
  'paragraph',
  'heading1',
  'heading2',
  'heading3',
  'bulletList',
  'numberedList',
  'checklist',
  'toggleList',
  'codeBlock',
  'callout',
  'quote',
];

/** React state + keyboard handling for one @tiptap/suggestion popup. */
function useSuggestionPopup<T>(): {
  popup: SuggestionPopupState<T> | null;
  index: number;
  setIndex: (i: number) => void;
  bridge: SuggestionBridge<T>;
} {
  const [popup, setPopup] = useState<SuggestionPopupState<T> | null>(null);
  const [index, setIndex] = useState(0);
  const live = useRef({ popup, index });
  live.current = { popup, index };
  const bridge = useMemo<SuggestionBridge<T>>(
    () => ({
      onStart: (state) => {
        setPopup(state);
        setIndex(0);
      },
      onUpdate: (state) => {
        setPopup(state);
        setIndex(0);
      },
      onExit: () => setPopup(null),
      onKeyDown: (event) => {
        const { popup: current, index: i } = live.current;
        if (!current || current.items.length === 0) return false;
        const n = current.items.length;
        if (event.key === 'ArrowDown') {
          setIndex((i + 1) % n);
          return true;
        }
        if (event.key === 'ArrowUp') {
          setIndex((i - 1 + n) % n);
          return true;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          const item = current.items[Math.min(i, n - 1)];
          if (item === undefined) return false;
          current.select(item);
          return true;
        }
        if (event.key === 'Escape') {
          setPopup(null);
          return true;
        }
        return false;
      },
    }),
    [],
  );
  return { popup, index, setIndex, bridge };
}

function selectionRect(editor: Editor): Rect {
  const { from, to } = editor.state.selection;
  const a = editor.view.coordsAtPos(from);
  const b = editor.view.coordsAtPos(to);
  return { left: Math.min(a.left, b.left), right: Math.max(a.right, b.right), top: Math.min(a.top, b.top), bottom: Math.max(a.bottom, b.bottom) };
}

function linkHrefAt(view: EditorView, pos: number): string | null {
  const $pos = view.state.doc.resolve(pos);
  const marks = [...$pos.marks(), ...(view.state.doc.nodeAt(pos)?.marks ?? [])];
  const link = marks.find((m) => m.type.name === 'link');
  return link ? String(link.attrs.href ?? '') : null;
}

function headingOutline(doc: PMNode): OutlineItem[] {
  const sources: { level: number; text: string; pos: number }[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === 'heading') sources.push({ level: Number(node.attrs.level) || 1, text: node.textContent, pos });
    return node.isBlock;
  });
  return buildOutline(sources);
}

/** Start position of the top-level block with the given index. */
function topLevelStart(doc: PMNode, index: number): number {
  let pos = 0;
  for (let i = 0; i < index && i < doc.childCount; i++) pos += doc.child(i).nodeSize;
  return pos;
}

export function DocsEditor(props: EditorProps<DocContent>): JSX.Element {
  const { content, filePath, title, isActive, services, onChange, registerShortcuts, setScopes } = props;
  const { t } = useTranslation(['docs', 'common']);

  // Latest props and callbacks for the TipTap extensions, which are created once.
  const live = useRef({ services, filePath, onChange, t });
  live.current = { services, filePath, onChange, t };

  const lastEmitted = useRef<string>(content);
  const baseline = useRef<string | null>(null);
  const files = useRef<LinkableFile[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const handleNode = useRef<{ node: PMNode | null; pos: number }>({ node: null, pos: -1 });

  const [stats, setStats] = useState<DocStats>({ blocks: 0, words: 0 });
  const [textSize, setTextSize] = useState<DocTextSize>('large');
  const [textWidth, setTextWidth] = useState<DocTextWidth>('narrow');
  const textSizeRef = useRef(textSize);
  textSizeRef.current = textSize;
  const [fullscreen, setFullscreen] = useState(false);
  const [focusStyle, setFocusStyle] = useState<FocusStyle>('none');
  const [tocOpen, setTocOpen] = useState(false);
  const [menu, setMenu] = useState<{ anchor: MenuAnchor; items: MenuEntry[] } | null>(null);
  const [linkPopover, setLinkPopover] = useState<{ anchor: Rect; initial: string; existing: boolean } | null>(null);
  const [embedPopover, setEmbedPopover] = useState<Rect | null>(null);

  const slash = useSuggestionPopup<SlashItem>();
  const mention = useSuggestionPopup<LinkableFile>();
  const emoji = useSuggestionPopup<Emoji>();
  const bridges = useRef({ slash: slash.bridge, mention: mention.bridge, emoji: emoji.bridge });

  const editorRef = useRef<Editor | null>(null);

  /* ---------------------------------------------------------------- actions (via refs) */

  const notify = (key: string, values?: Record<string, unknown>, kind: 'info' | 'error' = 'info'): void =>
    live.current.services.notify(key, values ? { kind, values } : { kind });

  const openLinkPopover = useCallback((): void => {
    const editor = editorRef.current;
    if (!editor) return;
    const href = editor.getAttributes('link').href as string | undefined;
    setLinkPopover({ anchor: selectionRect(editor), initial: href ?? '', existing: !!href });
  }, []);

  const promptEmbed = useCallback((): void => {
    const editor = editorRef.current;
    if (editor) setEmbedPopover(selectionRect(editor));
  }, []);

  const createNested = useCallback(async (kind: 'doc' | 'board' | 'folder'): Promise<void> => {
    const { services: s, filePath: path, t: tr } = live.current;
    const fs = s.api.fs;
    try {
      const folder = nestedFolderOf(path);
      let dir = folder.path;
      const existing = await fs.stat(folder.path);
      if (!existing.ok) {
        const made = await fs.createFolder(folder.dir, folder.name);
        if (!made.ok) throw new Error(made.message);
        dir = made.value;
      }
      if (kind === 'folder') {
        const made = await fs.createFolder(dir, tr('common:newFile.folder'));
        if (!made.ok) throw new Error(made.message);
        notify('docs:nested.created', { name: titleFromPath(made.value) });
        return;
      }
      const created =
        kind === 'doc'
          ? await fs.createFile(dir, tr('common:newFile.doc'), '.md', '')
          : await fs.createFile(dir, tr('common:newFile.board'), '.wboard', serializeBoard(createEmptyBoard('board')));
      if (!created.ok) throw new Error(created.message);
      const name = titleFromPath(created.value);
      const editor = editorRef.current;
      if (editor) {
        if (kind === 'doc') {
          editor
            .chain()
            .focus()
            .insertContent([
              { type: 'text', text: name, marks: [{ type: 'link', attrs: { href: fileLinkHref(created.value) } }] },
              { type: 'text', text: ' ' },
            ])
            .run();
        } else {
          editor.chain().focus().insertBoardEmbed({ path: created.value }).run();
        }
      }
      notify('docs:nested.created', { name });
    } catch {
      notify('docs:nested.failed', undefined, 'error');
    }
  }, []);

  const blockCtx = useMemo<BlockCommandContext>(
    () => ({ openLinkPopover, promptEmbed, createNested: (kind) => void createNested(kind) }),
    [openLinkPopover, promptEmbed, createNested],
  );
  const blockCtxRef = useRef(blockCtx);
  blockCtxRef.current = blockCtx;

  const openFileLink = (href: string, newTab: boolean): boolean => {
    const target = classifyHref(href);
    if (!target) return false;
    if (target.kind === 'file') live.current.services.openFile(target.path, { newTab });
    else if (target.kind === 'external') void live.current.services.api.app.openExternal(target.url);
    else return false;
    return true;
  };

  const turnIntoItems = (run: (id: SlashItemId) => void): MenuEntry[] =>
    SLASH_ITEMS.filter((item) => TURN_INTO.includes(item.id)).map((item) => ({
      type: 'item',
      label: t(item.labelKey as 'blockMenu.paragraph'),
      icon: item.icon,
      shortcut: item.shortcutId ? shortcutLabel(item.shortcutId) : undefined,
      onSelect: () => run(item.id),
    }));

  const openBlockMenu = (anchor?: MenuAnchor): void => {
    const editor = editorRef.current;
    if (!editor) return;
    const at = anchor ?? (() => {
      const c = editor.view.coordsAtPos(editor.state.selection.from);
      return { x: c.left, y: c.bottom + 4 };
    })();
    setMenu({ anchor: at, items: turnIntoItems((id) => runBlockCommand(editor, id, blockCtxRef.current)) });
  };
  const openBlockMenuRef = useRef(openBlockMenu);
  openBlockMenuRef.current = openBlockMenu;

  const insertImages = async (images: File[], at?: number): Promise<void> => {
    const editor = editorRef.current;
    if (!editor) return;
    for (const file of images) {
      const result = await live.current.services.api.assets.importBytes(file.name, await file.arrayBuffer());
      if (!result.ok) {
        notify('docs:image.importFailed', undefined, 'error');
        continue;
      }
      const chain = editor.chain().focus();
      if (at !== undefined) chain.setTextSelection(at);
      chain.setImage({ src: result.value.url, alt: file.name }).run();
    }
  };
  const insertImagesRef = useRef(insertImages);
  insertImagesRef.current = insertImages;

  /* ---------------------------------------------------------------- editor */

  const extensions = useMemo(() => {
    const tr = (key: string): string => live.current.t(key as 'placeholder.empty');
    return createDocExtensions({
      placeholder: () => tr('placeholder.empty'),
      toggleLabel: (open) => tr(open ? 'collapse.collapse' : 'collapse.expand'),
      overrides: createViewOverrides({
        openUrl: (url) => void live.current.services.api.app.openExternal(url),
        openFile: (path) => live.current.services.openFile(path),
      }),
      keymap: {
        onLink: () => openLinkPopover(),
        onBlockMenu: () => openBlockMenuRef.current(),
        onOpenNested: () => {
          const editor = editorRef.current;
          if (!editor) return false;
          const sel = editor.state.selection;
          if (sel instanceof NodeSelection && sel.node.type.name === 'boardEmbed') {
            live.current.services.openFile(String(sel.node.attrs.path ?? ''));
            return true;
          }
          const href = linkHrefAt(editor.view, sel.from);
          if (href && openFileLink(href, false)) return true;
          notify('docs:nested.openedNothing');
          return true;
        },
        onExpandBlock: () => editorRef.current?.commands.expandBlockAtCaret() ?? false,
        onCollapseBlock: () => editorRef.current?.commands.collapseBlockAtCaret() ?? false,
      },
      collapse: {
        initial: live.current.services.getViewState<string[]>(COLLAPSED_KEY) ?? [],
        onChange: (collapsed) => live.current.services.setViewState(COLLAPSED_KEY, collapsed),
        label: () => tr('collapse.toggle'),
      },
      extra: [
        createSuggestionExtension<SlashItem>({
          name: 'slashMenu',
          char: '/',
          startOfLine: true,
          allowedPrefixes: null,
          allow: ({ editor }) => !editor.isActive('codeBlock'),
          items: (query) => filterSlashItems(SLASH_ITEMS, query, (item) => tr(item.labelKey)),
          command: ({ editor, item }) => runBlockCommand(editor, item.id, blockCtxRef.current),
          bridge: () => bridges.current.slash,
        }),
        createSuggestionExtension<LinkableFile>({
          name: 'fileMention',
          char: '@',
          allow: ({ editor }) => !editor.isActive('codeBlock'),
          items: (query) => filterFiles(files.current, query, live.current.filePath),
          command: ({ editor, item }) =>
            editor
              .chain()
              .focus()
              .insertContent([
                { type: 'text', text: item.name, marks: [{ type: 'link', attrs: { href: fileLinkHref(item.path) } }] },
                { type: 'text', text: ' ' },
              ])
              .run(),
          bridge: () => bridges.current.mention,
        }),
        createSuggestionExtension<Emoji>({
          name: 'emojiPicker',
          char: ':',
          allow: ({ editor }) => !editor.isActive('codeBlock') && !editor.isActive('code'),
          items: (query) => searchEmojis(query),
          command: ({ editor, item }) => editor.chain().focus().insertContent(item.emoji).run(),
          bridge: () => bridges.current.emoji,
        }),
      ],
    });
    // Created once: everything dynamic is read through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const editor = useEditor(
    {
      extensions,
      content: markdownToDoc(content) as JSONContent,
      shouldRerenderOnTransaction: false,
      editorProps: {
        attributes: { class: 'docs-content', spellcheck: 'true' },
        handleClick: (view, pos, event) => {
          const href = linkHrefAt(view, pos);
          if (!href) return false;
          // Workspace links behave like chips (one click opens); external links need ⌘-click.
          const isFile = classifyHref(href)?.kind === 'file';
          if (!isFile && !event.metaKey) return false;
          return openFileLink(href, event.metaKey && isFile);
        },
        handlePaste: (_view, event) => {
          const data = event.clipboardData;
          if (!data) return false;
          const images = Array.from(data.files).filter((f) => f.type.startsWith('image/'));
          if (images.length > 0) {
            void insertImagesRef.current(images);
            return true;
          }
          if (data.types.includes('text/html')) return false;
          const text = data.getData('text/plain');
          const ed = editorRef.current;
          if (!text || !ed || ed.isActive('codeBlock')) return false;
          const rows = parseTsvTable(text);
          if (rows) {
            ed.chain().focus().insertContent(tableJson(rows) as JSONContent).run();
            return true;
          }
          if (looksLikeMarkdown(text)) {
            ed.chain()
              .focus()
              .insertContent((markdownToDoc(text).content ?? []) as JSONContent[])
              .run();
            return true;
          }
          return false;
        },
        handleDrop: (view, event, _slice, moved) => {
          if (moved) return false;
          const images = Array.from(event.dataTransfer?.files ?? []).filter((f) => f.type.startsWith('image/'));
          if (images.length === 0) return false;
          event.preventDefault();
          const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
          void insertImagesRef.current(images, at);
          return true;
        },
      },
      onCreate: ({ editor: ed }) => {
        const json = ed.getJSON() as DocNode;
        baseline.current = docToMarkdown(json);
        setStats(docStats(json));
      },
      onUpdate: ({ editor: ed }) => {
        const json = ed.getJSON() as DocNode;
        setStats(docStats(json));
        const markdown = docToMarkdown(json);
        if (markdown === baseline.current) return;
        baseline.current = markdown;
        lastEmitted.current = markdown;
        live.current.onChange(markdown);
      },
    },
    [],
  );
  editorRef.current = editor;

  // External content (reload from disk): replace without echo and outside the undo history.
  useEffect(() => {
    if (!editor || editor.isDestroyed || content === lastEmitted.current) return;
    lastEmitted.current = content;
    const doc = editor.schema.nodeFromJSON(markdownToDoc(content));
    const { from } = editor.state.selection;
    const tr = editor.state.tr
      .replaceWith(0, editor.state.doc.content.size, doc.content)
      .setMeta('addToHistory', false)
      .setMeta('preventUpdate', true);
    editor.view.dispatch(tr);
    try {
      editor.commands.setTextSelection(Math.min(from, editor.state.doc.content.size));
    } catch {
      // Position no longer valid in the new document: keep the default selection.
    }
    const json = editor.getJSON() as DocNode;
    baseline.current = docToMarkdown(json);
    setStats(docStats(json));
  }, [content, editor]);

  /* ---------------------------------------------------------------- per-viewer layout */

  useEffect(() => {
    const prefs = services.api.prefs;
    let alive = true;
    const apply = (p: Partial<Preferences>): void => {
      if (isTextSize(p.docTextSize)) setTextSize(p.docTextSize);
      if (isTextWidth(p.docTextWidth)) setTextWidth(p.docTextWidth);
    };
    void prefs
      ?.get()
      .then((p) => alive && apply(p))
      .catch(() => undefined);
    const off = prefs?.onChange?.((p) => apply(p));
    return () => {
      alive = false;
      off?.();
    };
  }, [services.api]);

  const changeLayout = useCallback(
    (patch: { docTextSize?: DocTextSize; docTextWidth?: DocTextWidth }): void => {
      if (patch.docTextSize) setTextSize(patch.docTextSize);
      if (patch.docTextWidth) setTextWidth(patch.docTextWidth);
      void services.api.prefs?.set(patch).catch(() => undefined);
    },
    [services.api],
  );

  // Files offered by the @ menu.
  useEffect(() => {
    const fs = services.api.fs;
    let alive = true;
    const refresh = (): void => {
      void fs
        ?.listTree()
        .then((result) => {
          if (alive && result.ok) files.current = flattenFiles(result.value);
        })
        .catch(() => undefined);
    };
    refresh();
    const off = fs?.onEvents?.(() => refresh());
    return () => {
      alive = false;
      off?.();
    };
  }, [services.api]);

  /* ---------------------------------------------------------------- focus modes */

  useEffect(() => {
    if (!editor || focusStyle === 'none') return;
    let focused: Element | null = null;
    const update = (): void => {
      const { doc, selection } = editor.state;
      if (focusStyle === 'paragraph') {
        const dom = editor.view.nodeDOM(topLevelStart(doc, blockIndexAt(doc, selection.from)));
        const el = dom instanceof Element ? dom : null;
        if (el !== focused) {
          focused?.classList.remove('wc-focused');
          el?.classList.add('wc-focused');
          focused = el;
        }
      } else {
        const scroller = scrollRef.current;
        if (!scroller) return;
        const caret = editor.view.coordsAtPos(selection.from);
        const box = scroller.getBoundingClientRect();
        scroller.scrollTop += caret.top - (box.top + box.height / 2);
      }
    };
    update();
    editor.on('selectionUpdate', update);
    editor.on('update', update);
    return () => {
      editor.off('selectionUpdate', update);
      editor.off('update', update);
      focused?.classList.remove('wc-focused');
    };
  }, [editor, focusStyle]);

  useEffect(() => {
    if (!fullscreen || !isActive) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault();
        setFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen, isActive]);

  /* ---------------------------------------------------------------- shortcuts and scopes */

  const handlers = useMemo<ShortcutHandler[]>(() => {
    if (!editor) return [];
    const otherField = (): HTMLElement | null => {
      const el = document.activeElement as HTMLElement | null;
      return el && isTextInputTarget(el) && !editor.view.dom.contains(el) ? el : null;
    };
    const copy = (text: string, key: string): void => {
      void navigator.clipboard
        ?.writeText(text)
        .then(() => notify(key))
        .catch(() => undefined);
    };
    return [
      {
        id: 'edit.undo',
        run: () => (otherField() ? void document.execCommand('undo') : void editor.chain().focus().undo().run()),
      },
      {
        id: 'edit.redo',
        run: () => (otherField() ? void document.execCommand('redo') : void editor.chain().focus().redo().run()),
      },
      {
        id: 'edit.selectAll',
        run: () => {
          const field = otherField();
          if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) field.select();
          else editor.chain().focus().selectAll().run();
        },
      },
      {
        id: 'docs.copyAsMarkdown',
        run: () => {
          const { selection, doc } = editor.state;
          const markdown = selection.empty
            ? docToMarkdown(doc.toJSON() as DocNode)
            : blocksToMarkdown(selection.content().content.toJSON() as DocNode[]);
          if (markdown.trim() === '') notify('docs:copy.nothingToCopy');
          else copy(markdown, 'docs:copy.markdownCopied');
        },
      },
      {
        id: 'docs.copyBlockLink',
        run: () => {
          const { doc, selection } = editor.state;
          const blocks = topLevelBlocks(doc);
          const heading = governingHeading(blocks, blockIndexAt(doc, selection.from));
          const text = heading >= 0 ? (blocks[heading]?.text ?? '') : '';
          const anchor = text ? `#${headingSlug(text)}` : '';
          copy(`${fileLinkHref(live.current.filePath)}${anchor}`, 'docs:copy.blockLinkCopied');
        },
      },
      { id: 'docs.textSizeUp', run: () => changeLayout({ docTextSize: stepTextSize(textSizeRef.current, 'up') }) },
      { id: 'docs.textSizeDown', run: () => changeLayout({ docTextSize: stepTextSize(textSizeRef.current, 'down') }) },
      {
        id: 'docs.goToParent',
        run: async () => {
          const parent = parentDocOf(live.current.filePath);
          const exists = parent ? await live.current.services.api.fs.stat(parent) : null;
          if (parent && exists?.ok) live.current.services.openFile(parent);
          else notify('docs:nested.noParent');
        },
      },
      { id: 'docs.focusMode', run: () => setFullscreen((v) => !v) },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, changeLayout]);

  useEffect(() => {
    if (!isActive) return;
    setScopes(['docs']);
    return registerShortcuts(handlers);
  }, [isActive, handlers, registerShortcuts, setScopes]);

  /* ---------------------------------------------------------------- toolbar state */

  const marks = useEditorState({
    editor,
    selector: ({ editor: ed }) =>
      ed
        ? {
            bold: ed.isActive('bold'),
            italic: ed.isActive('italic'),
            strike: ed.isActive('strike'),
            code: ed.isActive('code'),
            highlight: ed.isActive('highlight'),
            link: ed.isActive('link'),
          }
        : null,
  });

  const outline = useEditorState({
    editor,
    selector: ({ editor: ed }) => (ed && tocOpen ? { items: headingOutline(ed.state.doc), caret: ed.state.selection.from } : null),
  });

  const layoutMenu = (anchor: HTMLElement): void =>
    setMenu({
      anchor,
      items: [
        { type: 'label', label: t('view.textSize') },
        ...[...TEXT_SIZES].reverse().map<MenuEntry>((size) => ({
          type: 'item',
          label: t(`view.${size}`),
          checked: size === textSize,
          onSelect: () => changeLayout({ docTextSize: size }),
        })),
        { type: 'separator' },
        { type: 'label', label: t('view.width') },
        ...TEXT_WIDTHS.map<MenuEntry>((width) => ({
          type: 'item',
          label: t(`view.${width}`),
          checked: width === textWidth,
          onSelect: () => changeLayout({ docTextWidth: width }),
        })),
      ],
    });

  const focusMenu = (anchor: HTMLElement): void =>
    setMenu({
      anchor,
      items: [
        { type: 'item', label: t('focus.fullScreen'), icon: 'Maximize', checked: fullscreen, onSelect: () => setFullscreen((v) => !v) },
        {
          type: 'item',
          label: t('focus.paragraph'),
          icon: 'TextCursor',
          checked: focusStyle === 'paragraph',
          onSelect: () => setFocusStyle((s) => (s === 'paragraph' ? 'none' : 'paragraph')),
        },
        {
          type: 'item',
          label: t('focus.typewriter'),
          icon: 'AlignVerticalSpaceAround',
          checked: focusStyle === 'typewriter',
          onSelect: () => setFocusStyle((s) => (s === 'typewriter' ? 'none' : 'typewriter')),
        },
      ],
    });

  const handleMenu = (event: ReactMouseEvent<HTMLButtonElement>): void => {
    const ed = editorRef.current;
    const { node, pos } = handleNode.current;
    if (!ed || !node || pos < 0) return;
    const end = pos + node.nodeSize;
    setMenu({
      anchor: event.currentTarget,
      items: [
        {
          type: 'submenu',
          label: t('handle.turnInto'),
          icon: 'Repeat2',
          items: turnIntoItems((id) => {
            ed.chain().focus().setTextSelection(pos + 1).run();
            runBlockCommand(ed, id, blockCtxRef.current);
          }),
        },
        { type: 'item', label: t('handle.duplicate'), icon: 'Copy', onSelect: () => ed.chain().focus().insertContentAt(end, node.toJSON()).run() },
        { type: 'separator' },
        { type: 'item', label: t('handle.delete'), icon: 'Trash2', danger: true, onSelect: () => ed.chain().focus().deleteRange({ from: pos, to: end }).run() },
      ],
    });
  };

  const addBlockBelow = (): void => {
    const ed = editorRef.current;
    const { node, pos } = handleNode.current;
    if (!ed || !node || pos < 0) return;
    ed.chain()
      .focus()
      .insertContentAt(pos + node.nodeSize, { type: 'paragraph', content: [{ type: 'text', text: '/' }] })
      .run();
  };

  const style = layoutCssVars(textSize, textWidth) as CSSProperties;
  // Markdown files often start with `# <file name>`: do not show the title twice.
  const firstLine = content.trimStart().split('\n', 1)[0] ?? '';
  const startsWithTitle = /^#\s/.test(firstLine) && firstLine.replace(/^#\s+/, '').trim() === title.trim();

  return (
    <div className="docs-editor" style={style} data-focus={focusStyle} data-fullscreen={fullscreen ? 'true' : undefined}>
      <div className="docs-scroll" ref={scrollRef}>
        <div className="docs-page">
          {!startsWithTitle && <h1 className="docs-title">{title}</h1>}
          <EditorContent editor={editor} />
        </div>
      </div>

      {editor && (
        <DragHandle editor={editor} onNodeChange={({ node, pos }) => (handleNode.current = { node, pos })}>
          <div className="docs-handle" data-wc-chrome>
            <button type="button" aria-label={t('handle.addBlock')} title={t('handle.addBlock')} onClick={addBlockBelow}>
              <Icon name="Plus" size={16} />
            </button>
            <button type="button" className="docs-handle-drag" aria-label={t('handle.dragBlock')} title={t('handle.dragBlock')} onClick={handleMenu}>
              <Icon name="GripVertical" size={16} />
            </button>
          </div>
        </DragHandle>
      )}

      {editor && marks && (
        <BubbleMenu editor={editor} className="docs-bubble" data-wc-chrome>
          <button type="button" className="docs-bubble-block" onMouseDown={(e) => e.preventDefault()} onClick={(e) => openBlockMenu(e.currentTarget)}>
            {t('toolbar.blockType')}
            <Icon name="ChevronDown" size={14} />
          </button>
          <span className="docs-bubble-sep" />
          <IconButton icon="Bold" size="sm" label={t('toolbar.bold')} shortcut={shortcutLabel('docs.bold')} active={marks.bold} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleBold().run()} />
          <IconButton icon="Italic" size="sm" label={t('toolbar.italic')} shortcut={shortcutLabel('docs.italic')} active={marks.italic} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleItalic().run()} />
          <IconButton icon="Strikethrough" size="sm" label={t('toolbar.strike')} shortcut={shortcutLabel('docs.strike')} active={marks.strike} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleStrike().run()} />
          <IconButton icon="Code" size="sm" label={t('toolbar.code')} shortcut={shortcutLabel('docs.inlineCode')} active={marks.code} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleCode().run()} />
          <IconButton icon="Highlighter" size="sm" label={t('toolbar.highlight')} shortcut={shortcutLabel('docs.highlight')} active={marks.highlight} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleHighlight().run()} />
          <span className="docs-bubble-sep" />
          <IconButton icon="Link" size="sm" label={t('toolbar.link')} shortcut={shortcutLabel('docs.link')} active={marks.link} onMouseDown={(e) => e.preventDefault()} onClick={openLinkPopover} />
        </BubbleMenu>
      )}

      <SuggestionPopup
        popup={slash.popup}
        index={slash.index}
        onHover={slash.setIndex}
        renderItem={(item) => (
          <>
            <span className="docs-popup-icon">
              <Icon name={item.icon} size={16} />
            </span>
            <span className="docs-popup-label">{t(item.labelKey as 'blockMenu.paragraph')}</span>
            <span className="docs-popup-hint">{item.trigger ?? (item.shortcutId ? shortcutLabel(item.shortcutId) : '')}</span>
          </>
        )}
        hideWhenEmpty
      />
      <SuggestionPopup
        popup={mention.popup}
        index={mention.index}
        onHover={mention.setIndex}
        title={t('mention.title')}
        emptyText={t('mention.noResults')}
        renderItem={(file) => (
          <>
            <span className="docs-popup-icon">
              <Icon name={getFileKindInfo(file.kind).icon} size={16} />
            </span>
            <span className="docs-popup-label">{file.name}</span>
            <span className="docs-popup-hint">{file.folder}</span>
          </>
        )}
      />
      <SuggestionPopup
        popup={emoji.popup}
        index={emoji.index}
        onHover={emoji.setIndex}
        renderItem={(item) => (
          <>
            <span className="docs-popup-icon">{item.emoji}</span>
            <span className="docs-popup-label">:{item.shortcode}:</span>
          </>
        )}
        hideWhenEmpty
      />

      {linkPopover && editor && (
        <InputPopover
          anchor={linkPopover.anchor}
          initial={linkPopover.initial}
          placeholder={t('link.placeholder')}
          submitLabel={t('link.apply')}
          validate={(value) => (normalizeHref(value) ? null : t('link.invalid'))}
          onSubmit={(value) => {
            const href = normalizeHref(value);
            setLinkPopover(null);
            if (!href) return;
            if (editor.state.selection.empty && !editor.isActive('link')) {
              editor
                .chain()
                .focus()
                .insertContent({ type: 'text', text: value.trim(), marks: [{ type: 'link', attrs: { href } }] })
                .run();
            } else {
              editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
            }
          }}
          {...(linkPopover.existing
            ? {
                removeLabel: t('link.remove'),
                onRemove: () => {
                  setLinkPopover(null);
                  editor.chain().focus().extendMarkRange('link').unsetLink().run();
                },
              }
            : {})}
          onCancel={() => {
            setLinkPopover(null);
            editor.commands.focus();
          }}
        />
      )}

      {embedPopover && editor && (
        <InputPopover
          anchor={embedPopover}
          placeholder={t('embed.urlPlaceholder')}
          submitLabel={t('embed.insert')}
          validate={(value) => (parseEmbedUrl(value) ? null : t('embed.invalid'))}
          onSubmit={(value) => {
            const parsed = parseEmbedUrl(value);
            setEmbedPopover(null);
            if (parsed) editor.chain().focus().insertEmbed({ url: parsed.url }).run();
          }}
          onCancel={() => {
            setEmbedPopover(null);
            editor.commands.focus();
          }}
        />
      )}

      {tocOpen && outline && editor && (
        <TocPanel
          items={outline.items}
          caretPos={outline.caret}
          onClose={() => setTocOpen(false)}
          onSelect={(item) => {
            const { doc } = editor.state;
            const index = blockIndexAt(doc, item.pos);
            if (doc.child(index)?.type.name === 'heading') editor.commands.revealBlock(index);
            editor.chain().focus().setTextSelection(item.pos + 1).scrollIntoView().run();
          }}
        />
      )}

      <div className="docs-footer" data-wc-chrome>
        <span className="docs-footer-stats">
          <span>{t('view.blocks', { count: stats.blocks })}</span>
          <span>{t('view.words', { count: stats.words })}</span>
        </span>
        <IconButton icon="TableOfContents" size="sm" label={tocOpen ? t('toc.hide') : t('toc.show')} active={tocOpen} tooltipPlacement="top" onClick={() => setTocOpen((v) => !v)} />
        <IconButton icon="ALargeSmall" size="sm" label={t('view.textSizeAndLayout')} tooltipPlacement="top" onClick={(e) => layoutMenu(e.currentTarget)} />
        <IconButton icon="Focus" size="sm" label={t('focus.title')} active={fullscreen || focusStyle !== 'none'} tooltipPlacement="top" onClick={(e) => focusMenu(e.currentTarget)} />
      </div>

      {fullscreen && <div className="docs-fullscreen-hint">{t('focus.exitHint')}</div>}

      {menu && (
        <Menu
          items={menu.items}
          anchor={menu.anchor}
          onClose={() => {
            setMenu(null);
            editorRef.current?.commands.focus();
          }}
        />
      )}
    </div>
  );
}

export default DocsEditor;
