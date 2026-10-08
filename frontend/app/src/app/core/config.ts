import type { AppConfig } from './config.types';

/** Default build: self-contained browser mode. config.http.ts replaces this file in the http* configurations. */
export const APP_CONFIG: AppConfig = {
  apiMode: 'browser',
  apiBaseUrl: '',
};
