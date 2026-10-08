import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { APP_CONFIG } from '../config';
import {
  AuditLog,
  DashboardStats,
  DocumentEdit,
  DocumentFilter,
  DocumentItem,
  IntegrityReport,
  PresetType,
  WorkflowAction,
} from '../models';
import { ApiError, DocumentApi, PRESET_API_KEY } from './document-api';

/** Talks to the .NET API. The JWT is attached by `authInterceptor`; the server decides who the caller is. */
@Injectable()
export class HttpDocumentApi extends DocumentApi {
  private readonly http = inject(HttpClient);
  private readonly base = APP_CONFIG.apiBaseUrl;

  listDocuments(filter: DocumentFilter = {}): Promise<DocumentItem[]> {
    let params = new HttpParams();
    if (filter.status && filter.status !== 'all') params = params.set('status', filter.status);
    if (filter.type && filter.type !== 'all') params = params.set('type', filter.type);
    if (filter.search?.trim()) params = params.set('search', filter.search.trim());
    return this.call(this.http.get<DocumentItem[]>(`${this.base}/documents`, { params }));
  }

  getDocument(id: string): Promise<DocumentItem> {
    return this.call(this.http.get<DocumentItem>(`${this.base}/documents/${id}`));
  }

  uploadDocument(file: File): Promise<DocumentItem> {
    const form = new FormData();
    form.append('file', file);
    return this.call(this.http.post<DocumentItem>(`${this.base}/documents/upload`, form));
  }

  createPreset(preset: PresetType): Promise<DocumentItem> {
    return this.call(
      this.http.post<DocumentItem>(`${this.base}/documents/preset/${PRESET_API_KEY[preset]}`, null),
    );
  }

  updateDocument(id: string, edit: DocumentEdit): Promise<DocumentItem> {
    return this.call(this.http.put<DocumentItem>(`${this.base}/documents/${id}`, edit));
  }

  processAction(
    id: string,
    action: WorkflowAction,
    comment: string | undefined,
    version: number,
  ): Promise<DocumentItem> {
    return this.call(
      this.http.post<DocumentItem>(`${this.base}/workflow/${id}/action`, {
        action,
        comment,
        version,
      }),
    );
  }

  reanalyze(id: string): Promise<DocumentItem> {
    return this.call(this.http.post<DocumentItem>(`${this.base}/documents/${id}/reanalyze`, null));
  }

  getAuditLogs(documentId?: string, search?: string): Promise<AuditLog[]> {
    let params = new HttpParams();
    if (documentId) params = params.set('documentId', documentId);
    if (search?.trim()) params = params.set('search', search.trim());
    return this.call(this.http.get<AuditLog[]>(`${this.base}/auditlogs`, { params }));
  }

  verifyAudit(): Promise<IntegrityReport> {
    return this.call(this.http.get<IntegrityReport>(`${this.base}/auditlogs/verify-integrity`));
  }

  getStats(): Promise<DashboardStats> {
    return this.call(this.http.get<DashboardStats>(`${this.base}/stats`));
  }

  private async call<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (err) {
      if (err instanceof HttpErrorResponse) {
        if (err.status === 0) {
          throw new ApiError(0, `Cannot reach the API at ${this.base}. Is the backend running?`);
        }
        const body = err.error as { message?: string; title?: string } | null;
        const message = body?.message ?? body?.title ?? 'Request failed';
        throw new ApiError(err.status, message);
      }
      throw err;
    }
  }
}
