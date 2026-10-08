export type ApiMode = 'browser' | 'http';

export interface AppConfig {
  apiMode: ApiMode;
  apiBaseUrl: string;
}
