import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { initI18n } from './i18n';
import './styles/tokens.css';
import './styles/global.css';

async function boot(): Promise<void> {
  const api = window.api;
  const [prefs, locale] = api ? await Promise.all([api.prefs.get(), api.app.getLocale()]) : [undefined, 'en'];
  await initI18n(prefs?.language ?? 'system', locale);
  const container = document.getElementById('root');
  if (!container) throw new Error('Missing #root');
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void boot();
