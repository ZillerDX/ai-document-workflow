import { Component, OnInit, Output, EventEmitter, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DocumentService } from '../../services/document.service';
import { AuditLog, AuditIntegrityReport } from '../../models/document.model';

@Component({
  selector: 'app-audit-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-backdrop" (click)="onBackdropClick($event)">
      <div class="modal-dialog">
        <div class="modal-header">
          <div class="header-info">
            <h2 class="modal-title">Enterprise Audit & Compliance Ledger</h2>
            <div class="modal-subtitle">Immutable log of all document uploads, OCR extractions, field edits, and approval actions</div>
          </div>

          <button type="button" class="close-btn" (click)="closed.emit()" title="Close (Esc)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Cryptographic SHA-256 Integrity Banner -->
        <div class="integrity-banner">
          <div class="integrity-left">
            <div class="shield-badge" [class.verified]="integrityReport?.verified">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                <path d="m9 12 2 2 4-4"></path>
              </svg>
            </div>
            <div class="integrity-meta">
              <div class="integrity-title">
                Cryptographic Chain Integrity:
                <strong [class.text-emerald]="integrityReport?.verified" [class.text-amber]="isVerifying" [class.text-rose]="integrityReport && !integrityReport.verified">
                  {{ integrityReport?.verified ? '100% Tamper-Free & Validated' : (isVerifying ? 'Verifying Block Hashes...' : 'Chain Unverified') }}
                </strong>
              </div>
              <div class="integrity-desc tabular-nums">
                {{ integrityReport?.count || logs.length }} sequential ledger blocks • Algorithm: SHA-256 Hash Chain • Genesis to Head
              </div>
            </div>
          </div>

          <button type="button" class="btn-verify" (click)="verifyIntegrity()" [disabled]="isVerifying">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" [class.spin]="isVerifying">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5A10 10 0 0 1 20.8 7.2M22 12.5a10 10 0 0 1-18.8 4.3"></path>
            </svg>
            {{ isVerifying ? 'Verifying Chain...' : 'Verify Cryptographic Chain' }}
          </button>
        </div>

        <!-- Filter bar -->
        <div class="audit-filter-bar">
          <div class="search-wrap">
            <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
              type="text" 
              placeholder="Search audit trail by actor, document #, or action keyword..." 
              [(ngModel)]="searchQuery" 
              (ngModelChange)="applySearch()" 
              class="audit-search-input" />
          </div>

          <div class="log-count tabular-nums">
            {{ filteredLogs.length }} recorded events
          </div>
        </div>

        <!-- Audit Table -->
        <div class="audit-table-wrap">
          <table class="audit-table">
            <thead>
              <tr>
                <th>Timestamp (UTC)</th>
                <th>Action</th>
                <th>Document</th>
                <th>Actor</th>
                <th>Event Details & Diffs</th>
                <th>SHA-256 Hash</th>
              </tr>
            </thead>
            <tbody>
              @if (isLoading) {
                @for (i of [1, 2, 3, 4, 5]; track i) {
                  <tr>
                    <td><div class="skeleton-shimmer h-6 w-24"></div></td>
                    <td><div class="skeleton-shimmer h-6 w-20"></div></td>
                    <td><div class="skeleton-shimmer h-6 w-20"></div></td>
                    <td><div class="skeleton-shimmer h-6 w-28"></div></td>
                    <td><div class="skeleton-shimmer h-6 w-48"></div></td>
                    <td><div class="skeleton-shimmer h-6 w-20"></div></td>
                  </tr>
                }
              } @else if (filteredLogs.length === 0) {
                <tr>
                  <td colspan="6" class="empty-log-cell">
                    No matching audit records found.
                  </td>
                </tr>
              } @else {
                @for (log of filteredLogs; track log.id) {
                  <tr class="log-row">
                    <td class="tabular-nums timestamp-cell">
                      {{ log.timestamp | date:'yyyy-MM-dd HH:mm:ss' }}
                    </td>

                    <td>
                      <span class="action-pill" [attr.data-action]="log.action">
                        {{ formatAction(log.action) }}
                      </span>
                    </td>

                    <td class="tabular-nums doc-cell font-mono">
                      {{ log.documentNumber || 'System' }}
                    </td>

                    <td>
                      <div class="actor-info">
                        <span class="actor-name">{{ log.actorName }}</span>
                        <span class="actor-role">{{ log.actorRole }}</span>
                      </div>
                    </td>

                    <td class="details-cell">
                      <div class="details-text">{{ log.details }}</div>
                      @if (log.previousValue && log.newValue) {
                        <div class="diff-box">
                          <span class="diff-prev">Prev: {{ log.previousValue }}</span>
                          <span class="diff-arrow">→</span>
                          <span class="diff-next">New: {{ log.newValue }}</span>
                        </div>
                      }
                    </td>

                    <td class="hash-cell font-mono tabular-nums" [title]="'SHA-256 Record Hash: ' + (log.recordHash || 'Genesis block')">
                      <span class="hash-chip">
                        #{{ (log.recordHash || 'GENESIS').substring(0, 8) }}
                      </span>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background-color: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(4px);
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }

    .modal-dialog {
      background-color: var(--bg-surface);
      border: 1px solid var(--border-prominent);
      border-radius: var(--radius-xl);
      width: 100%;
      max-width: 1120px;
      max-height: 88vh;
      display: flex;
      flex-direction: column;
      box-shadow: var(--shadow-xl);
      overflow: hidden;
      animation: modalEnter 250ms cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes modalEnter {
      from { opacity: 0; transform: scale(0.97); }
      to { opacity: 1; transform: scale(1); }
    }

    .modal-header {
      padding: 1.25rem 1.75rem;
      border-bottom: 1px solid var(--border-subtle);
      display: flex;
      align-items: center;
      justify-content: space-between;
      background-color: var(--bg-card);
    }

    .modal-title {
      font-size: 1.125rem;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0 0 0.25rem;
      letter-spacing: -0.01em;
    }

    .modal-subtitle {
      font-size: 0.8125rem;
      color: var(--text-muted);
    }

    .close-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: var(--radius-md);
      background: transparent;
      border: 1px solid transparent;
      color: var(--text-muted);
      cursor: pointer;
      transition: all 150ms ease;
    }

    .close-btn:hover {
      background-color: rgba(255, 255, 255, 0.05);
      color: var(--text-primary);
      border-color: var(--border-subtle);
    }

    .integrity-banner {
      background: linear-gradient(90deg, rgba(16, 185, 129, 0.08) 0%, rgba(14, 19, 31, 0.95) 100%);
      border-bottom: 1px solid rgba(16, 185, 129, 0.2);
      padding: 0.75rem 1.75rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .integrity-left {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .shield-badge {
      width: 32px;
      height: 32px;
      border-radius: var(--radius-md);
      background-color: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .shield-badge.verified {
      box-shadow: 0 0 12px rgba(16, 185, 129, 0.25);
    }

    .integrity-title {
      font-size: 0.8125rem;
      color: var(--text-secondary);
    }

    .text-emerald { color: #34d399; }
    .text-amber { color: #fbbf24; }
    .text-rose { color: #f43f5e; }

    .integrity-desc {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-top: 0.1rem;
    }

    .btn-verify {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background-color: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: var(--text-primary);
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.35rem 0.75rem;
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: all 150ms ease;
      white-space: nowrap;
    }

    .btn-verify:hover:not(:disabled) {
      background-color: rgba(255, 255, 255, 0.08);
      border-color: rgba(16, 185, 129, 0.4);
      color: #34d399;
    }

    .btn-verify:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .spin {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      100% { transform: rotate(360deg); }
    }

    .audit-filter-bar {
      padding: 0.75rem 1.75rem;
      border-bottom: 1px solid var(--border-subtle);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      background-color: rgba(0, 0, 0, 0.15);
    }

    .search-wrap {
      position: relative;
      flex: 1;
      max-width: 480px;
    }

    .search-icon {
      position: absolute;
      left: 0.75rem;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-muted);
    }

    .audit-search-input {
      width: 100%;
      padding: 0.45rem 0.75rem 0.45rem 2.25rem;
      font-size: 0.8125rem;
      background-color: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      color: var(--text-primary);
      outline: none;
    }

    .audit-search-input:focus {
      border-color: var(--accent-primary);
    }

    .log-count {
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .audit-table-wrap {
      overflow-y: auto;
      max-height: calc(88vh - 190px);
    }

    .audit-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8125rem;
      text-align: left;
    }

    .audit-table th {
      background-color: rgba(255, 255, 255, 0.02);
      color: var(--text-muted);
      font-size: 0.6875rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      font-weight: 600;
      padding: 0.65rem 1.25rem;
      border-bottom: 1px solid var(--border-subtle);
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .audit-table td {
      padding: 0.75rem 1.25rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      vertical-align: top;
    }

    .log-row:hover {
      background-color: rgba(255, 255, 255, 0.015);
    }

    .timestamp-cell {
      font-size: 0.75rem;
      color: var(--text-muted);
      white-space: nowrap;
    }

    .font-mono {
      font-family: 'JetBrains Mono', monospace;
    }

    .hash-chip {
      background-color: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      padding: 0.15rem 0.4rem;
      border-radius: var(--radius-sm);
      font-size: 0.6875rem;
      color: #a78bfa;
    }

    .action-pill {
      font-size: 0.6875rem;
      font-weight: 600;
      padding: 0.15rem 0.45rem;
      border-radius: var(--radius-sm);
      text-transform: uppercase;
      letter-spacing: 0.02em;
      display: inline-block;
      white-space: nowrap;
    }

    .action-pill[data-action="Uploaded"] { background-color: rgba(59, 130, 246, 0.15); color: #60a5fa; }
    .action-pill[data-action="AiAnalyzed"] { background-color: rgba(168, 85, 247, 0.15); color: #c084fc; }
    .action-pill[data-action="ApprovedLevel1"] { background-color: rgba(245, 158, 11, 0.15); color: #fbbf24; }
    .action-pill[data-action="ApprovedLevel2"] { background-color: rgba(16, 185, 129, 0.15); color: #34d399; }
    .action-pill[data-action="Rejected"] { background-color: rgba(244, 63, 94, 0.15); color: #fb7185; }
    .action-pill[data-action="RevisionRequested"] { background-color: rgba(251, 146, 60, 0.15); color: #fb923c; }
    .action-pill[data-action="Resubmitted"] { background-color: rgba(34, 197, 94, 0.15); color: #4ade80; }
    .action-pill[data-action="FieldEdited"] { background-color: rgba(148, 163, 184, 0.15); color: #cbd5e1; }
    .action-pill[data-action="ReAnalyzed"] { background-color: rgba(99, 102, 241, 0.15); color: #818cf8; }

    .doc-cell {
      color: var(--accent-primary);
      font-weight: 500;
      white-space: nowrap;
    }

    .actor-info {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
    }

    .actor-name {
      color: var(--text-primary);
      font-weight: 500;
    }

    .actor-role {
      font-size: 0.6875rem;
      color: var(--text-muted);
    }

    .details-cell {
      max-width: 380px;
    }

    .details-text {
      color: var(--text-secondary);
      line-height: 1.4;
      font-size: 0.8125rem;
    }

    .diff-box {
      margin-top: 0.35rem;
      padding: 0.35rem 0.5rem;
      background-color: rgba(0, 0, 0, 0.3);
      border-radius: var(--radius-sm);
      font-size: 0.75rem;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      border: 1px dashed var(--border-subtle);
    }

    .diff-prev { color: #f43f5e; }
    .diff-arrow { color: var(--text-muted); }
    .diff-next { color: #10b981; }

    .empty-log-cell {
      text-align: center;
      padding: 3rem;
      color: var(--text-muted);
    }
  `]
})
export class AuditModalComponent implements OnInit {
  @Output() closed = new EventEmitter<void>();

  private docService = inject(DocumentService);

  logs: AuditLog[] = [];
  filteredLogs: AuditLog[] = [];
  isLoading = true;
  isVerifying = false;
  searchQuery = '';
  integrityReport: AuditIntegrityReport | null = null;

  ngOnInit() {
    this.loadLogs();
    this.verifyIntegrity();
  }

  loadLogs() {
    this.isLoading = true;
    this.docService.getAuditLogs().subscribe({
      next: (data) => {
        this.logs = data;
        this.applySearch();
        this.isLoading = false;
      },
      error: (e) => {
        console.error('Failed to load logs', e);
        this.isLoading = false;
      }
    });
  }

  verifyIntegrity() {
    this.isVerifying = true;
    this.docService.verifyAuditIntegrity().subscribe({
      next: (report) => {
        this.integrityReport = report;
        this.isVerifying = false;
      },
      error: (e) => {
        console.error('Failed to verify audit integrity', e);
        this.isVerifying = false;
      }
    });
  }

  applySearch() {
    if (!this.searchQuery.trim()) {
      this.filteredLogs = [...this.logs];
      return;
    }
    const q = this.searchQuery.toLowerCase().trim();
    this.filteredLogs = this.logs.filter(l => 
      (l.documentNumber && l.documentNumber.toLowerCase().includes(q)) ||
      l.action.toLowerCase().includes(q) ||
      l.actorName.toLowerCase().includes(q) ||
      l.details.toLowerCase().includes(q) ||
      (l.recordHash && l.recordHash.toLowerCase().includes(q))
    );
  }

  formatAction(action: string): string {
    switch (action) {
      case 'Uploaded': return 'Uploaded';
      case 'AiAnalyzed': return 'AI Scanned';
      case 'ApprovedLevel1': return 'L1 Approved';
      case 'ApprovedLevel2': return 'L2 Approved';
      case 'Rejected': return 'Rejected';
      case 'RevisionRequested': return 'Revision Req.';
      case 'Resubmitted': return 'Resubmitted';
      case 'FieldEdited': return 'Field Edit';
      case 'ReAnalyzed': return 'Re-Analyzed';
      default: return action;
    }
  }

  onBackdropClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closed.emit();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.closed.emit();
  }
}
