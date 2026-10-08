import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withHashLocation } from '@angular/router';
import { routes } from './app.routes';
import { BrowserDocumentApi } from './core/api/browser-document-api';
import { DocumentApi } from './core/api/document-api';
import { HttpDocumentApi } from './core/api/http-document-api';
import { authInterceptor } from './core/auth/auth.interceptor';
import { SessionService } from './core/auth/session.service';
import { APP_CONFIG } from './core/config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Hash routing keeps deep links working on static hosting (GitHub Pages) without server rewrites.
    provideRouter(routes, withHashLocation(), withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    {
      provide: DocumentApi,
      useClass: APP_CONFIG.apiMode === 'http' ? HttpDocumentApi : BrowserDocumentApi,
    },
    provideAppInitializer(() => inject(SessionService).init()),
  ],
};
