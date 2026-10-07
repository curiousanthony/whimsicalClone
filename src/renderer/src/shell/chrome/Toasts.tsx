import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { IconButton } from '@renderer/ui';
import { dismissToast, useUi } from '../state/ui';

/** Transient notifications, bottom centre. */
export function Toasts(): JSX.Element {
  const { t } = useTranslation('shell');
  const toasts = useUi((s) => s.toasts);
  return (
    <div className="shell-toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={clsx('shell-toast', toast.kind === 'error' && 'is-error')}>
          <span>{toast.message}</span>
          <IconButton icon="X" size="sm" label={t('toasts.dismiss')} noTooltip onClick={() => dismissToast(toast.id)} />
        </div>
      ))}
    </div>
  );
}
