/** "New tab" page: create menu tiles and recent files (Whimsical new-tab behaviour). */

import { useTranslation } from 'react-i18next';
import { FILE_KINDS, kindFromPath } from '@shared/fileKinds';
import { FileIcon, Icon, fileKindColor } from '@renderer/ui';
import { createDocument, createFolder, openPath } from '../fileActions';
import { useResolvedTheme } from '../state/prefs';
import { useTabs } from '../state/tabs';
import { useWorkspace } from '../state/workspace';
import { displayName, findNode, parentOf } from '../tree';

export function HomeView(): JSX.Element {
  const { t } = useTranslation(['shell', 'common']);
  const recent = useTabs((s) => s.recent);
  const tree = useWorkspace((s) => s.tree);
  const theme = useResolvedTheme();
  const files = recent.filter((p) => findNode(tree, p)).slice(0, 12);
  return (
    <div className="shell-home">
      <div className="shell-home__inner">
        <h2 className="shell-home__title">{t('home.title')}</h2>
        <div className="shell-home__tiles">
          {FILE_KINDS.map((info) => (
            <button
              key={info.kind}
              type="button"
              className="shell-home__tile"
              onClick={() => void createDocument(info.kind, '')}
            >
              <span className="shell-home__tile-icon" style={{ color: fileKindColor(info.kind) }}>
                <Icon name={info.icon} size={22} />
              </span>
              {t(`common:${info.labelKey}` as 'common:fileKinds.board')}
            </button>
          ))}
          <button type="button" className="shell-home__tile" onClick={() => void createFolder('')}>
            <span className="shell-home__tile-icon" style={{ color: fileKindColor('folder') }}>
              <Icon name="Folder" size={22} />
            </span>
            {t('common:fileKinds.folder')}
          </button>
        </div>
        <h3 className="shell-home__subtitle">{t('home.recentFiles')}</h3>
        {files.length === 0 ? (
          <p className="shell-home__empty">{t('home.empty')}</p>
        ) : (
          <ul className="shell-home__recent">
            {files.map((path) => (
              <li key={path}>
                <button type="button" onClick={(e) => openPath(path, { newTab: e.metaKey })}>
                  <FileIcon kind={kindFromPath(path)} size={18} dark={theme === 'dark'} />
                  <span className="shell-home__recent-name">{displayName(path)}</span>
                  <span className="shell-home__recent-folder">{parentOf(path)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
