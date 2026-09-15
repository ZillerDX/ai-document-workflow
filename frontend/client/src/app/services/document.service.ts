import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DocumentItem, DashboardStats, AuditLog, AuditIntegrityReport } from '../models/document.model';
import { BrowserStorageService } from './browser-storage.service';

@Injectable({
  providedIn: 'root'
})
export class DocumentService {
  private http = inject(HttpClient);
  private browserStorage = inject(BrowserStorageService);
  
  // Default to true so GitHub Pages and static deployments work 100% autonomously in browser storage
  private useBrowserStorage = true;
  private baseUrl = 'http://localhost:5120/api';

  getStats(): Observable<DashboardStats> {
    if (this.useBrowserStorage) {
      return this.browserStorage.getStats();
    }
    return this.http.get<DashboardStats>(`${this.baseUrl}/stats`);
  }

  getDocuments(status?: string, type?: string, search?: string): Observable<DocumentItem[]> {
    if (this.useBrowserStorage) {
      return this.browserStorage.getDocuments(status, type, search);
    }
    let params = new HttpParams();
    if (status && status !== 'all') params = params.set('status', status);
    if (type && type !== 'all') params = params.set('type', type);
    if (search && search.trim()) params = params.set('search', search.trim());

    return this.http.get<DocumentItem[]>(`${this.baseUrl}/documents`, { params });
  }

  getDocument(id: string): Observable<DocumentItem> {
    if (this.useBrowserStorage) {
      return this.browserStorage.getDocument(id);
    }
    return this.http.get<DocumentItem>(`${this.baseUrl}/documents/${id}`);
  }

  uploadDocument(file: File, userId: string, userName: string): Observable<DocumentItem> {
    if (this.useBrowserStorage) {
      return this.browserStorage.uploadDocument(file, userId, userName);
    }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('uploadedByUserId', userId);
    formData.append('uploadedByUserName', userName);

    return this.http.post<DocumentItem>(`${this.baseUrl}/documents/upload`, formData);
  }

  createPreset(presetType: string, userId: string, userName: string): Observable<DocumentItem> {
    if (this.useBrowserStorage) {
      return this.browserStorage.createPreset(presetType, userId, userName);
    }
    const params = new HttpParams()
      .set('userId', userId)
      .set('userName', userName);

    return this.http.post<DocumentItem>(`${this.baseUrl}/documents/preset/${presetType}`, null, { params });
  }

  updateDocument(id: string, dto: any): Observable<DocumentItem> {
    if (this.useBrowserStorage) {
      return this.browserStorage.updateDocument(id, dto);
    }
    return this.http.put<DocumentItem>(`${this.baseUrl}/documents/${id}`, dto);
  }

  processWorkflowAction(
    id: string, 
    action: 'Approve' | 'Reject' | 'RequestRevision' | 'Resubmit', 
    actorId: string, 
    actorName: string, 
    actorRole: string, 
    comment?: string
  ): Observable<DocumentItem> {
    if (this.useBrowserStorage) {
      return this.browserStorage.processWorkflowAction(id, action, actorId, actorName, actorRole, comment);
    }
    const body = {
      action,
      actorId,
      actorName,
      actorRole,
      comment
    };
    return this.http.post<DocumentItem>(`${this.baseUrl}/workflow/${id}/action`, body);
  }

  reanalyze(id: string): Observable<DocumentItem> {
    if (this.useBrowserStorage) {
      return this.browserStorage.reanalyze(id);
    }
    return this.http.post<DocumentItem>(`${this.baseUrl}/documents/${id}/reanalyze`, null);
  }

  getAuditLogs(documentId?: string, search?: string): Observable<AuditLog[]> {
    if (this.useBrowserStorage) {
      return this.browserStorage.getAuditLogs(documentId, search);
    }
    let params = new HttpParams();
    if (documentId) params = params.set('documentId', documentId);
    if (search && search.trim()) params = params.set('search', search.trim());

    return this.http.get<AuditLog[]>(`${this.baseUrl}/auditlogs`, { params });
  }

  verifyAuditIntegrity(): Observable<AuditIntegrityReport> {
    if (this.useBrowserStorage) {
      return this.browserStorage.verifyAuditIntegrity();
    }
    return this.http.get<AuditIntegrityReport>(`${this.baseUrl}/auditlogs/verify-integrity`);
  }
}
