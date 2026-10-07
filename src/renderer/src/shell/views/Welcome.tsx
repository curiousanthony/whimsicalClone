/** Welcome / workspace picker shown when no workspace is open. */

import { useTranslation } from 'react-i18next';
import { Button, Icon } from '@renderer/ui';
import { usePrefs } from '../state/prefs';
import { openWorkspacePath, pickWorkspace } from '../state/workspace';
import { switchWorkspace } from '../workspaceSession';

export function Welcome(): JSX.Element {
  const { t } = useTranslation('shell');
  const recent = usePrefs((s) => s.prefs.recentWorkspaces);
  const pick = async () => {
    const info = await pickWorkspace();
    if (info) await switchWorkspace(info);
  };
  return (
    <main className="welcome">
      <div className="welcome__logo" aria-hidden>
        <Icon name="Shapes" size={36} />
      </div>
      <h1>{t('welcome.title')}</h1>
      <p>{t('welcome.body')}</p>
      <Button variant="primary" icon="FolderOpen" onClick={() => void pick()}>
        {t('welcome.pick')}
      </Button>
      <section className="welcome__recent">
        <h2>{t('welcome.recent')}</h2>
        {recent.length === 0 ? (
          <p className="welcome__hint">{t('welcome.noRecent')}</p>
        ) : (
          <ul>
            {recent.map((path) => (
              <li key={path}>
                <button
                  type="button"
                  onClick={async () => {
                    const info = await openWorkspacePath(path);
                    if (info) await switchWorkspace(info);
                  }}
                  title={path}
                >
                  <Icon name="Folder" size={16} />
                  <span className="welcome__recent-name">{path.split('/').pop()}</span>
                  <span className="welcome__recent-path">{path}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
