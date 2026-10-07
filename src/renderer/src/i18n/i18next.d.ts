import 'i18next';
import type { enResources } from '@shared/i18n/resources';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: typeof enResources;
    returnNull: false;
  }
}
