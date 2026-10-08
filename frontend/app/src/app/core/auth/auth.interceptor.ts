import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { APP_CONFIG } from '../config';
import { SessionService } from './session.service';

/** Attaches the demo JWT to calls to our own API only. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(SessionService).token;
  if (token && req.url.startsWith(APP_CONFIG.apiBaseUrl)) {
    return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
  }
  return next(req);
};
