/**
 * Editor host (SPEC section 5): renders the editor plugin of every mounted file tab inside
 * Suspense + an error boundary. Inactive tabs stay mounted but hidden (instant switching),
 * up to MAX_MOUNTED file tabs (least recently used are unmounted).
 */

import {
  Component,
  Suspense,
  type ComponentType,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { titleFromPath } from '@shared/fileKinds';
import type { RelPath } from '@shared/ipc';
import { shortcutRegistry } from '@renderer/core/shortcuts';
import type { ChangeOptions, EditorProps, EditorServices, ScopeId, ShortcutHandler } from '@renderer/core/types';
import { Button, Icon } from '@renderer/ui';
import { registerExporter, type DocumentExporter } from '../exporters';
import { FolderView } from '../views/FolderView';
import { HomeView } from '../views/HomeView';
import {
  changeDocument,
  ensureDocument,
  getViewState,
  pluginFor,
  setViewState,
  useDocuments,
} from '../state/documents';
import { setEditorScopes } from '../state/scopes';
import { openFile, useTabs, type Tab } from '../state/tabs';
import { notifyKey } from '../state/ui';
import { TabBindings } from './tabBindings';

export const MAX_MOUNTED = 8;

/** Tabs to keep mounted: the active one plus the most recently used file tabs. */
export function mountedTabIds(
  tabs: readonly Tab[],
  activeId: string | null,
  mru: readonly string[],
  max = MAX_MOUNTED,
): Set<string> {
  const ids = new Set<string>();
  if (activeId) ids.add(activeId);
  for (const id of mru) {
    if (ids.size >= max) break;
    const tab = tabs.find((t) => t.id === id);
    if (tab?.kind === 'file') ids.add(id);
  }
  return ids;
}

export function EditorArea(): JSX.Element {
  const tabs = useTabs((s) => s.tabs);
  const activeId = useTabs((s) => s.activeId);
  const mru = useTabs((s) => s.mru);
  const mounted = useMemo(() => mountedTabIds(tabs, activeId, mru), [tabs, activeId, mru]);
  const active = tabs.find((t) => t.id === activeId);

  useEffect(() => {
    if (!active || active.kind !== 'file') setEditorScopes([]);
  }, [active]);

  return (
    <div className="shell-editor-area">
      {tabs
        .filter((t) => mounted.has(t.id))
        .map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <div key={tab.id} className="shell-tab-pane" hidden={!isActive} aria-hidden={!isActive}>
              {tab.kind === 'file' && <FilePane path={tab.path} isActive={isActive} />}
              {tab.kind === 'folder' && isActive && <FolderView path={tab.path} />}
              {tab.kind === 'home' && isActive && <HomeView />}
            </div>
          );
        })}
    </div>
  );
}

function CenteredMessage({ icon, children }: { icon: string; children: ReactNode }): JSX.Element {
  return (
    <div className="shell-editor-message">
      <Icon name={icon} size={28} />
      <div>{children}</div>
    </div>
  );
}

function FilePane({ path, isActive }: { path: RelPath; isActive: boolean }): JSX.Element {
  const { t } = useTranslation(['shell', 'common']);
  const entry = useDocuments((s) => s.docs[path]);
  const pathRef = useRef(path);
  pathRef.current = path;

  const bindingsRef = useRef<TabBindings | null>(null);
  if (!bindingsRef.current) {
    bindingsRef.current = new TabBindings(shortcutRegistry, (scopes) => setEditorScopes(scopes));
  }
  const bindings = bindingsRef.current;

  useEffect(() => {
    void ensureDocument(path);
  }, [path]);

  useEffect(() => {
    bindings.setActive(isActive);
    if (isActive) setEditorScopes(bindings.getScopes());
  }, [bindings, isActive]);

  useEffect(() => () => bindings.dispose(), [bindings]);

  const onChange = useCallback(
    (next: unknown, options?: ChangeOptions) => changeDocument(pathRef.current, next, options),
    [],
  );
  const registerShortcuts = useCallback(
    (handlers: readonly ShortcutHandler[]) => bindings.register(handlers),
    [bindings],
  );
  const setScopes = useCallback((scopes: readonly ScopeId[]) => bindings.setScopes(scopes), [bindings]);

  const services = useMemo<EditorServices & { registerExporter: (exporter: DocumentExporter) => () => void }>(
    () => ({
      api: window.api,
      openFile: (target, options) => openFile(target, { newTab: options?.newTab ?? false }),
      getViewState: <T,>(key: string) => getViewState<T>(pathRef.current, key),
      setViewState: (key, value) => setViewState(pathRef.current, key, value),
      notify: (messageKey, options) => notifyKey(messageKey, options),
      registerExporter: (exporter) => registerExporter(() => pathRef.current, exporter),
    }),
    [],
  );

  if (!entry || entry.status === 'loading')
    return <div className="shell-editor-loading" aria-label={t('editor.loading')} />;
  if (entry.status === 'unsupported')
    return <CenteredMessage icon="FileQuestion">{t('editor.unsupported')}</CenteredMessage>;
  if (entry.status === 'missing') return <CenteredMessage icon="FileX">{t('editor.notFound')}</CenteredMessage>;
  if (entry.status === 'error') {
    return (
      <CenteredMessage icon="TriangleAlert">
        {t('common:errors.INVALID_FILE', { message: entry.error ?? '' })}
      </CenteredMessage>
    );
  }
  const plugin = pluginFor(path);
  if (!plugin) return <CenteredMessage icon="FileQuestion">{t('editor.unsupported')}</CenteredMessage>;
  const EditorComponent = plugin.component as ComponentType<EditorProps<unknown>>;
  const props: EditorProps<unknown> = {
    filePath: path,
    title: titleFromPath(path),
    content: entry.content,
    onChange,
    registerShortcuts,
    setScopes,
    isActive,
    services,
  };
  if (entry.lastHistoryAction) props.lastHistoryAction = entry.lastHistoryAction;
  return (
    <div className="shell-file-pane" data-kind={plugin.kind}>
      {entry.deletedOnDisk && (
        <div className="shell-banner" role="status">
          <Icon name="TriangleAlert" size={14} />
          {t('editor.deletedBanner')}
        </div>
      )}
      <EditorErrorBoundary resetKey={`${path}:${entry.revision}`}>
        <Suspense fallback={<div className="shell-editor-loading" />}>
          <EditorComponent key={entry.revision} {...props} />
        </Suspense>
      </EditorErrorBoundary>
    </div>
  );
}

interface BoundaryState {
  error: Error | null;
}

class EditorErrorBoundary extends Component<{ resetKey: string; children: ReactNode }, BoundaryState> {
  override state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  override componentDidUpdate(prev: { resetKey: string }): void {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Editor crashed', error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.error) {
      return <EditorCrash message={this.state.error.message} onRetry={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}

function EditorCrash({ message, onRetry }: { message: string; onRetry: () => void }): JSX.Element {
  const { t } = useTranslation(['shell', 'common']);
  return (
    <CenteredMessage icon="Bug">
      <p>{t('editor.crashed')}</p>
      <p className="shell-editor-message__detail">{message}</p>
      <Button onClick={onRetry}>{t('editor.retry')}</Button>
    </CenteredMessage>
  );
}
