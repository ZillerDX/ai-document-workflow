import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { SessionService } from './core/auth/session.service';
import { Persona } from './core/models';
import { canSubmit, canViewLedger } from './core/workflow-rules';

const allow =
  (check: (user: Persona) => boolean): CanActivateFn =>
  () =>
    check(inject(SessionService).user()) || inject(Router).createUrlTree(['/inbox']);

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'inbox' },
  {
    path: 'inbox',
    title: 'Inbox · AegisFlow',
    loadComponent: () => import('./features/inbox/inbox.component').then((m) => m.InboxComponent),
  },
  {
    path: 'documents/:id',
    title: 'Document · AegisFlow',
    loadComponent: () =>
      import('./features/document/document-detail.component').then(
        (m) => m.DocumentDetailComponent,
      ),
  },
  {
    path: 'upload',
    title: 'Upload · AegisFlow',
    canActivate: [allow(canSubmit)],
    loadComponent: () =>
      import('./features/upload/upload.component').then((m) => m.UploadComponent),
  },
  {
    path: 'audit',
    title: 'Audit ledger · AegisFlow',
    canActivate: [allow(canViewLedger)],
    loadComponent: () => import('./features/audit/audit.component').then((m) => m.AuditComponent),
  },
  { path: '**', redirectTo: 'inbox' },
];
