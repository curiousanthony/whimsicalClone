/** Preferences (Whimsical: Appearance System/Light/Dark, Advanced: invert zoom) + language. */

import { useTranslation } from 'react-i18next';
import type { ThemePreference } from '@shared/ipc';
import { AVAILABLE_LANGUAGES } from '@shared/i18n/resources';
import { Button, Modal, SegmentedControl, Select, Switch } from '@renderer/ui';
import { setPrefs, usePrefs } from '../state/prefs';
import { closeOverlay } from '../state/ui';
import { pickWorkspace, useWorkspace } from '../state/workspace';
import { switchWorkspace } from '../workspaceSession';

/** Native name of a language ("fr" -> "Français"). */
export function languageName(code: string): string {
  try {
    const name = new Intl.DisplayNames([code], { type: 'language' }).of(code);
    return name ? name.charAt(0).toLocaleUpperCase(code) + name.slice(1) : code;
  } catch {
    return code;
  }
}

export function Preferences(): JSX.Element {
  const { t } = useTranslation('shell');
  const prefs = usePrefs((s) => s.prefs);
  const info = useWorkspace((s) => s.info);
  const languages = [
    { value: 'system', label: t('preferences.languageSystem') },
    ...AVAILABLE_LANGUAGES.map((code) => ({ value: code, label: languageName(code) })),
  ];

  return (
    <Modal open onClose={closeOverlay} title={t('preferences.title')} closeLabel={t('preferences.close')} width={520}>
      <div className="shell-prefs">
        <section>
          <h3>{t('preferences.appearance')}</h3>
          <SegmentedControl<ThemePreference>
            ariaLabel={t('preferences.appearance')}
            value={prefs.theme}
            onChange={(theme) => void setPrefs({ theme })}
            options={[
              { value: 'system', label: t('preferences.themeSystem'), icon: 'Monitor' },
              { value: 'light', label: t('preferences.themeLight'), icon: 'Sun' },
              { value: 'dark', label: t('preferences.themeDark'), icon: 'Moon' },
            ]}
          />
        </section>
        <section>
          <h3>{t('preferences.language')}</h3>
          <Select
            ariaLabel={t('preferences.language')}
            value={prefs.language}
            options={languages}
            onChange={(language) => void setPrefs({ language })}
          />
        </section>
        <section>
          <h3>{t('preferences.workspace')}</h3>
          <div className="shell-prefs__row">
            <span className="shell-prefs__path" title={info?.rootPath}>
              {info?.rootPath ?? t('preferences.none')}
            </span>
            <Button
              size="sm"
              onClick={() =>
                void pickWorkspace().then((picked) => {
                  if (picked) {
                    closeOverlay();
                    void switchWorkspace(picked);
                  }
                })
              }
            >
              {t('preferences.change')}
            </Button>
          </div>
        </section>
        <section>
          <h3>{t('preferences.advanced')}</h3>
          <div className="shell-prefs__row">
            <div>
              <div>{t('preferences.invertZoom')}</div>
              <div className="shell-prefs__hint">{t('preferences.invertZoomHint')}</div>
            </div>
            <Switch
              label={t('preferences.invertZoom')}
              checked={prefs.invertZoom}
              onChange={(invertZoom) => void setPrefs({ invertZoom })}
            />
          </div>
        </section>
      </div>
    </Modal>
  );
}
