/** Keyboard shortcuts overlay (`?`): searchable, grouped, current context or everything. */

import { useMemo, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { formatGesture, shortcutRegistry } from '@renderer/core/shortcuts';
import { translateKey } from '@renderer/i18n';
import { Kbd, Modal, SegmentedControl, TextField } from '@renderer/ui';
import { buildHelpGroups, scopesForContext, type HelpContext } from '../helpSheet';
import { pluginFor } from '../state/documents';
import { useActiveTab } from '../state/tabs';
import { closeOverlay } from '../state/ui';

function useRegistryVersion(): number {
  return useSyncExternalStore(
    (l) => shortcutRegistry.subscribe(l),
    () => shortcutRegistry.getVersion(),
  );
}

export function ShortcutsHelp(): JSX.Element {
  const { t } = useTranslation(['shell', 'common']);
  const tab = useActiveTab();
  const version = useRegistryVersion();
  const [query, setQuery] = useState('');
  const context: HelpContext = useMemo(() => {
    if (!tab || tab.kind === 'home') return 'none';
    if (tab.kind === 'folder') return 'folder';
    const kind = pluginFor(tab.path)?.kind;
    if (kind === 'doc') return 'docs';
    if (kind === 'draw') return 'draw';
    return kind ? 'canvas' : 'none';
  }, [tab]);
  const [scopeMode, setScopeMode] = useState<'context' | 'all'>(context === 'none' ? 'all' : 'context');

  const groups = useMemo(() => {
    void version;
    return buildHelpGroups(shortcutRegistry.getDefs(), {
      translate: (key) => translateKey(key),
      formatGesture: (g) => formatGesture(g, (token) => translateKey(`common:keys.${token}`)),
      scopes: scopeMode === 'all' ? null : scopesForContext(context),
      query,
    });
  }, [version, scopeMode, context, query]);

  return (
    <Modal
      open
      onClose={closeOverlay}
      title={t('help.title')}
      closeLabel={t('common:actions.close')}
      width={760}
      className="shell-help"
    >
      <div className="shell-help__controls">
        <TextField
          icon="Search"
          placeholder={t('help.search')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          data-autofocus
        />
        <SegmentedControl
          ariaLabel={t('help.title')}
          value={scopeMode}
          onChange={setScopeMode}
          options={[
            { value: 'context', label: t('help.currentContext') },
            { value: 'all', label: t('help.showAll') },
          ]}
        />
      </div>
      <div className="shell-help__groups">
        {groups.length === 0 && <p className="shell-help__empty">{t('help.empty')}</p>}
        {groups.map(({ group, rows }) => (
          <section key={group} className="shell-help__group">
            <h3>{translateKey(`common:shortcutGroups.${group}`)}</h3>
            <dl>
              {rows.map((row) => (
                <div key={row.id} className="shell-help__row">
                  <dt>
                    {row.label}
                    {row.extension && (
                      <span className="shell-help__ext" title={t('common:shortcutHelp.extension')}>
                        *
                      </span>
                    )}
                  </dt>
                  <dd>
                    {row.keys.map((k, i) => (
                      <span key={`${k}-${i}`}>
                        {i > 0 && <span className="shell-help__or">{t('help.or')}</span>}
                        <Kbd className="shell-help__key">{k}</Kbd>
                      </span>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      <p className="shell-help__legend">* {t('common:shortcutHelp.extension')}</p>
    </Modal>
  );
}
