import { Component, Input, Output, EventEmitter, OnInit, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DocumentItem } from '../../models/document.model';
import { DocumentService } from '../../services/document.service';
import { AuthPersonaService } from '../../services/auth-persona.service';

@Component({
  selector: 'app-document-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-backdrop" (click)="onBackdropClick($event)">
      <div class="modal-dialog">
        <!-- Modal Header -->
        <div class="modal-header">
          <div class="header-left">
            <div class="doc-badge-row">
              <span class="type-pill" [attr.data-type]="doc.documentType">{{ doc.documentType }}</span>
              <span class="status-pill" [attr.data-status]="doc.status">{{ formatStatus(doc.status) }}</span>
              <span class="doc-id-pill">{{ doc.documentNumber }}</span>
            </div>
            <h2 class="doc-title">{{ doc.vendorName }}</h2>
          </div>
          
          <div class="header-right-actions">
            <button 
              type="button" 
              class="btn-open-original" 
              (click)="openOriginalFile()" 
              title="Open Original Document / PDF in new tab">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
              <span>Open Original File</span>
            </button>

            <button type="button" class="close-btn" (click)="closed.emit()" title="Close (Esc)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        <!-- Modal Body (Two-Column Split Layout) -->
        <div class="modal-body-split">
          <!-- Left Column: Document File & Line Items & Audit Logs -->
          <div class="left-column">
            <!-- Document Visual Sheet / Preview -->
            <div class="preview-sheet">
              <div class="sheet-original-bar">
                <div class="sheet-original-meta">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                  </svg>
                  <span class="sheet-original-filename truncate">{{ doc.originalFileName }}</span>
                </div>
                <button type="button" class="btn-sheet-original-link" (click)="openOriginalFile()">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                  </svg>
                  <span>View / Download PDF</span>
                </button>
              </div>

              <div class="sheet-header">
                <div class="sheet-company">
                  <div class="sheet-vendor">{{ doc.vendorName }}</div>
                  <div class="sheet-tax-id">Tax ID / VAT: {{ doc.taxId || 'N/A' }}</div>
                </div>
                <div class="sheet-meta tabular-nums">
                  <div><strong>Date:</strong> {{ doc.issueDate ? (doc.issueDate | date:'yyyy-MM-dd') : 'N/A' }}</div>
                  <div><strong>Due:</strong> {{ doc.dueDate ? (doc.dueDate | date:'yyyy-MM-dd') : 'N/A' }}</div>
                  <div><strong>Ref #:</strong> {{ doc.documentNumber }}</div>
                </div>
              </div>

              <div class="sheet-client-box">
                <span class="client-label">Billed To:</span>
                <span class="client-name">{{ doc.customerName }}</span>
              </div>

              <!-- Line Items Table -->
              <div class="line-items-section">
                <div class="section-title">Itemized Breakdown</div>
                <table class="items-table">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th class="text-right">Qty</th>
                      <th class="text-right">Unit Price</th>
                      <th class="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (item of doc.lineItems; track item.id) {
                      <tr>
                        <td>{{ item.description }}</td>
                        <td class="text-right tabular-nums">{{ item.quantity }}</td>
                        <td class="text-right tabular-nums">{{ doc.currency }} {{ item.unitPrice | number:'1.2-2' }}</td>
                        <td class="text-right tabular-nums font-semibold">{{ doc.currency }} {{ item.amount | number:'1.2-2' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>

              <!-- Financial Totals Box -->
              <div class="financial-summary-box tabular-nums">
                <div class="summary-line">
                  <span>Subtotal:</span>
                  <span>{{ doc.currency }} {{ doc.subTotal | number:'1.2-2' }}</span>
                </div>
                <div class="summary-line">
                  <span>Tax ({{ doc.taxRate }}%):</span>
                  <span [class.tax-discrepant]="doc.aiAnomalyDetected">
                    {{ doc.currency }} {{ doc.taxAmount | number:'1.2-2' }}
                  </span>
                </div>
                <div class="summary-line total-line">
                  <span>Total Due:</span>
                  <span class="total-amount">{{ doc.currency }} {{ doc.totalAmount | number:'1.2-2' }}</span>
                </div>
              </div>
            </div>

            <!-- Document Audit Trail -->
            <div class="doc-audit-section">
              <div class="section-title">Document Audit History</div>
              <div class="timeline">
                @for (log of doc.auditLogs; track log.id) {
                  <div class="timeline-item">
                    <div class="timeline-dot"></div>
                    <div class="timeline-content">
                      <div class="timeline-header">
                        <span class="timeline-actor">{{ log.actorName }}</span>
                        <span class="timeline-role">({{ log.actorRole }})</span>
                        <span class="timeline-time tabular-nums">{{ log.timestamp | date:'short' }}</span>
                      </div>
                      <div class="timeline-details">{{ log.details }}</div>
                    </div>
                  </div>
                }
              </div>
            </div>
          </div>

          <!-- Right Column: AI Analysis & Multi-Level Workflow & Action Controls -->
          <div class="right-column">
            <!-- AI Intelligence Card -->
            <div class="ai-intelligence-card" [class.anomaly-border]="doc.aiAnomalyDetected">
              <div class="ai-card-header">
                <div class="ai-badge">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                  </svg>
                  Gemini AI Summary & Audit
                </div>
                <div class="ai-confidence tabular-nums">
                  Confidence: {{ (doc.aiConfidenceScore * 100) | number:'1.0-0' }}%
                </div>
              </div>

              <div class="ai-summary-text">
                {{ doc.aiSummary || 'Document analyzed automatically. Financial fields and vendor counterparty mapped.' }}
              </div>

              @if (doc.aiAnomalyDetected) {
                <div class="anomaly-alert-box">
                  <div class="alert-title">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                      <line x1="12" y1="9" x2="12" y2="13"></line>
                      <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                    Anomaly Detected
                  </div>
                  <div class="alert-desc">{{ doc.aiAnomalyNotes }}</div>
                </div>
              }
            </div>

            <!-- Multi-Tier Approval Pipeline Card -->
            <div class="approval-pipeline-card">
              <div class="section-title">Multi-Level Approval Pipeline</div>
              
              <div class="steps-flow">
                @for (step of doc.approvalSteps; track step.stepNumber) {
                  <div class="workflow-step-card" [class.step-active]="step.stepNumber === doc.currentApprovalLevel && doc.status !== 'Approved' && doc.status !== 'Rejected'">
                    <div class="step-icon-col">
                      @if (step.status === 'Approved') {
                        <div class="step-circle step-passed">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        </div>
                      } @else if (step.status === 'Rejected') {
                        <div class="step-circle step-failed">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                          </svg>
                        </div>
                      } @else {
                        <div class="step-circle step-waiting">{{ step.stepNumber }}</div>
                      }
                    </div>

                    <div class="step-info-col">
                      <div class="step-row-top">
                        <span class="step-title">Level {{ step.stepNumber }}: {{ step.title }}</span>
                        <span class="step-status-tag" [attr.data-status]="step.status">{{ step.status }}</span>
                      </div>
                      <div class="step-meta">Required Role: <strong>{{ step.roleRequired }}</strong></div>

                      @if (step.approverUserName) {
                        <div class="step-decided-info">
                          Decided by <strong>{{ step.approverUserName }}</strong> on {{ step.decidedAt | date:'medium' }}
                        </div>
                      }

                      @if (step.comment) {
                        <div class="step-comment-box">"{{ step.comment }}"</div>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>

            <!-- Editable Fields & Corrections -->
            <div class="editable-fields-card">
              <div class="section-header-row">
                <span class="section-title">Extracted Metadata Verification</span>
                @if (isEditing) {
                  <button type="button" class="btn-ghost btn-xs" (click)="cancelEditing()">Cancel</button>
                } @else {
                  <button type="button" class="btn-secondary btn-xs" (click)="startEditing()">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M12 20h9"></path>
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                    </svg>
                    Edit Fields
                  </button>
                }
              </div>

              <div class="fields-form-grid">
                <div class="form-field">
                  <label>Document #</label>
                  <input type="text" [(ngModel)]="editForm.documentNumber" [disabled]="!isEditing" />
                </div>

                <div class="form-field">
                  <label>Vendor Name</label>
                  <input type="text" [(ngModel)]="editForm.vendorName" [disabled]="!isEditing" />
                </div>

                <div class="form-field">
                  <label>Tax ID / VAT</label>
                  <input type="text" [(ngModel)]="editForm.taxId" [disabled]="!isEditing" />
                </div>

                <div class="form-field">
                  <label>Subtotal ({{ doc.currency }})</label>
                  <input 
                    type="number" 
                    [(ngModel)]="editForm.subTotal" 
                    (ngModelChange)="onSubTotalChange($event)" 
                    [disabled]="!isEditing" 
                    class="tabular-nums" />
                </div>

                <div class="form-field">
                  <label>Tax Rate %</label>
                  <input 
                    type="number" 
                    [(ngModel)]="editForm.taxRate" 
                    (ngModelChange)="onTaxRateChange($event)" 
                    [disabled]="!isEditing" 
                    class="tabular-nums" />
                </div>

                <div class="form-field">
                  <label>Tax Amount ({{ doc.currency }})</label>
                  <input 
                    type="number" 
                    [(ngModel)]="editForm.taxAmount" 
                    (ngModelChange)="onTaxAmountChange($event)" 
                    [disabled]="!isEditing" 
                    class="tabular-nums" />
                </div>

                <div class="form-field full-width">
                  <label>Total Amount ({{ doc.currency }})</label>
                  <input 
                    type="number" 
                    [(ngModel)]="editForm.totalAmount" 
                    [disabled]="!isEditing" 
                    class="tabular-nums font-bold" />
                </div>
              </div>

              @if (isEditing) {
                <div class="edit-actions-row">
                  <input 
                    type="text" 
                    placeholder="Reason for correction (required for audit trail)..." 
                    [(ngModel)]="editReason" 
                    class="reason-input" />
                  <button 
                    type="button" 
                    class="btn-primary btn-xs" 
                    (click)="saveFieldCorrections()" 
                    [disabled]="isSaving">
                    {{ isSaving ? 'Saving...' : 'Save & Log Audit' }}
                  </button>
                </div>
              }
            </div>

            <!-- Workflow Action Decision Area -->
            <div class="decision-action-box">
              <div class="decision-header">
                <span class="decision-title">Workflow Action</span>
                <span class="active-acting-role">
                  Acting as: <strong>{{ currentPersona().name }} ({{ currentPersona().role }})</strong>
                </span>
              </div>

              @if (canApprove) {
                <div class="action-panel">
                  <textarea 
                    rows="2" 
                    placeholder="Optional review comment or notes for this stage..." 
                    [(ngModel)]="actionComment" 
                    class="comment-textarea">
                  </textarea>

                  <div class="action-btn-row">
                    <button 
                      type="button" 
                      class="btn-danger" 
                      (click)="submitWorkflowAction('Reject')" 
                      [disabled]="isSubmitting">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                      Reject
                    </button>

                    <button 
                      type="button" 
                      class="btn-secondary" 
                      (click)="submitWorkflowAction('RequestRevision')" 
                      [disabled]="isSubmitting">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M2.5 2v6h6M21.5 22v-6h-6"></path>
                        <path d="M22 11.5A10 10 0 0 0 3.2 7.2M2 12.5a10 10 0 0 0 18.8 4.2"></path>
                      </svg>
                      Request Revision
                    </button>

                    <button 
                      type="button" 
                      class="btn-success ml-auto" 
                      (click)="submitWorkflowAction('Approve')" 
                      [disabled]="isSubmitting">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                      Approve Level {{ doc.currentApprovalLevel }}
                    </button>
                  </div>
                </div>
              } @else {
                <div class="role-requirement-notice">
                  @if (doc.status === 'Approved') {
                    <div class="notice-text text-emerald">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                      </svg>
                      This document has concluded the multi-tier approval workflow and is fully authorized for disbursement.
                    </div>
                  } @else if (doc.status === 'Rejected') {
                    <div class="notice-text text-rose">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="15" y1="9" x2="9" y2="15"></line>
                        <line x1="9" y1="9" x2="15" y2="15"></line>
                      </svg>
                      This document was rejected during review and its workflow is terminated.
                    </div>
                  } @else if (currentPersona().role === 'Staff') {
                    <div class="notice-text text-primary">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="16" x2="12" y2="12"></line>
                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                      </svg>
                      <div>
                        <strong>Staff Submitter Scope:</strong> You have permission to edit and reconcile extracted fields. Approval sign-offs require Level 1 (Manager) or Level 2 (Finance).
                        @if (doc.status === 'RevisionRequested') {
                          <div class="mt-2">
                            <button type="button" class="btn-primary btn-xs" (click)="reSubmitForReview()">
                              Re-Submit for Manager Review
                            </button>
                          </div>
                        }
                      </div>
                    </div>
                  } @else if (currentPersona().role === 'Auditor') {
                    <div class="notice-text text-purple">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                      </svg>
                      <div>
                        <strong>Auditor Read-Only Scope:</strong> Independent compliance inspection. All audit logs, field diffs, and actor signatures are cryptographically recorded.
                      </div>
                    </div>
                  } @else if (currentPersona().role === 'Manager' && doc.status === 'PendingLevel2') {
                    <div class="notice-text text-cyan">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                      </svg>
                      Level 1 Manager review already approved! Currently in Level 2 queue for Finance (CFO) sign-off.
                    </div>
                  } @else if (currentPersona().role === 'Finance' && doc.status === 'PendingLevel1') {
                    <div class="notice-text text-amber">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                      Currently in Level 1 (Manager) review queue. Finance authorization unlocks once operational sign-off is granted.
                    </div>
                  } @else {
                    <div class="notice-text text-amber">
                      Waiting for <strong>Level {{ doc.currentApprovalLevel }} ({{ getRequiredRoleName(doc) }})</strong> review. 
                      Switch to that persona in the workspace banner to take action.
                    </div>
                  }
                </div>
              }
            </div>
          </div>
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
      max-width: 1200px;
      max-height: 90vh;
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

    .doc-badge-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.25rem;
    }

    .type-pill, .status-pill, .doc-id-pill {
      font-size: 0.6875rem;
      font-weight: 600;
      padding: 0.2rem 0.5rem;
      border-radius: var(--radius-sm);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .type-pill {
      background-color: var(--accent-primary-subtle);
      color: var(--accent-primary);
    }

    .doc-id-pill {
      font-family: 'JetBrains Mono', monospace;
      background-color: var(--bg-subtle);
      color: var(--text-primary);
    }

    .status-pill[data-status="Approved"] {
      background-color: var(--accent-emerald-subtle);
      color: var(--accent-emerald);
    }

    .status-pill[data-status="PendingLevel1"], .status-pill[data-status="PendingLevel2"] {
      background-color: var(--accent-amber-subtle);
      color: var(--accent-amber);
    }

    .status-pill[data-status="Rejected"] {
      background-color: var(--accent-rose-subtle);
      color: var(--accent-rose);
    }

    .doc-title {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--text-primary);
      letter-spacing: -0.01em;
    }

    .header-right-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .btn-open-original {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      background: rgba(56, 189, 248, 0.1);
      color: #38bdf8;
      border: 1px solid rgba(56, 189, 248, 0.3);
      padding: 0.4rem 0.75rem;
      border-radius: var(--radius-md);
      font-size: 0.8125rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 150ms ease;
    }

    .btn-open-original:hover {
      background: rgba(56, 189, 248, 0.2);
      border-color: #38bdf8;
      transform: translateY(-1px);
    }

    .close-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 0.4rem;
      border-radius: var(--radius-md);
    }

    .close-btn:hover {
      background-color: var(--bg-subtle);
      color: var(--text-primary);
    }

    .sheet-original-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--bg-subtle);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 0.6rem 0.85rem;
      margin-bottom: 0.25rem;
    }

    .sheet-original-meta {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--text-secondary);
      font-size: 0.75rem;
      max-width: 60%;
    }

    .sheet-original-filename {
      font-family: 'JetBrains Mono', monospace;
      color: #94a3b8;
    }

    .btn-sheet-original-link {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      background: transparent;
      border: 1px solid rgba(56, 189, 248, 0.3);
      color: #38bdf8;
      padding: 0.25rem 0.6rem;
      border-radius: var(--radius-sm);
      font-size: 0.6875rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 150ms ease;
    }

    .btn-sheet-original-link:hover {
      background: rgba(56, 189, 248, 0.15);
      border-color: #38bdf8;
    }

    .modal-body-split {
      display: grid;
      grid-template-columns: 1.15fr 1fr;
      gap: 1.5rem;
      padding: 1.5rem 1.75rem;
      overflow-y: auto;
      max-height: calc(90vh - 80px);
    }

    @media (max-width: 960px) {
      .modal-body-split {
        grid-template-columns: 1fr;
      }
    }

    /* Left Column Styles */
    .left-column {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .preview-sheet {
      background-color: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .sheet-header {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid var(--border-subtle);
      padding-bottom: 1rem;
    }

    .sheet-vendor {
      font-size: 1.125rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .sheet-tax-id {
      font-size: 0.75rem;
      color: var(--text-muted);
      font-family: 'JetBrains Mono', monospace;
    }

    .sheet-meta {
      font-size: 0.75rem;
      color: var(--text-secondary);
      text-align: right;
      line-height: 1.4;
    }

    .sheet-client-box {
      background-color: var(--bg-subtle);
      border-radius: var(--radius-md);
      padding: 0.65rem 0.85rem;
      font-size: 0.8125rem;
      display: flex;
      gap: 0.5rem;
    }

    .client-label { color: var(--text-muted); }
    .client-name { font-weight: 600; color: var(--text-primary); }

    .section-title {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 600;
      color: var(--text-secondary);
      margin-bottom: 0.5rem;
    }

    .items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8125rem;
    }

    .items-table th {
      color: var(--text-muted);
      border-bottom: 1px solid var(--border-subtle);
      padding: 0.5rem 0.5rem;
      font-weight: 500;
    }

    .items-table td {
      padding: 0.65rem 0.5rem;
      border-bottom: 1px solid var(--border-subtle);
    }

    .financial-summary-box {
      margin-left: auto;
      width: 260px;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      font-size: 0.8125rem;
      border-top: 1px solid var(--border-subtle);
      padding-top: 0.75rem;
    }

    .summary-line {
      display: flex;
      justify-content: space-between;
      color: var(--text-secondary);
    }

    .tax-discrepant {
      color: var(--accent-rose);
      font-weight: 700;
    }

    .total-line {
      border-top: 1px solid var(--border-subtle);
      padding-top: 0.5rem;
      margin-top: 0.25rem;
      font-size: 1rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .total-amount {
      color: var(--accent-emerald);
    }

    /* Audit Timeline */
    .doc-audit-section {
      background-color: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: 1.25rem;
    }

    .timeline {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      position: relative;
      margin-top: 0.75rem;
    }

    .timeline::before {
      content: '';
      position: absolute;
      left: 7px;
      top: 6px;
      bottom: 6px;
      width: 2px;
      background-color: var(--border-subtle);
    }

    .timeline-item {
      display: flex;
      gap: 0.85rem;
      position: relative;
    }

    .timeline-dot {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background-color: var(--bg-surface);
      border: 2px solid var(--accent-primary);
      flex-shrink: 0;
      z-index: 1;
    }

    .timeline-content {
      font-size: 0.75rem;
      flex: 1;
    }

    .timeline-header {
      display: flex;
      gap: 0.35rem;
      margin-bottom: 0.15rem;
    }

    .timeline-actor { font-weight: 600; color: var(--text-primary); }
    .timeline-role { color: var(--text-muted); }
    .timeline-time { color: var(--text-muted); margin-left: auto; }
    .timeline-details { color: var(--text-secondary); line-height: 1.35; }

    /* Right Column Styles */
    .right-column {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .ai-intelligence-card {
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(59, 130, 246, 0.04) 100%);
      border: 1px solid rgba(139, 92, 246, 0.25);
      border-radius: var(--radius-lg);
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .ai-intelligence-card.anomaly-border {
      border-color: var(--accent-rose-border);
      background: linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(245, 158, 11, 0.04) 100%);
    }

    .ai-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .ai-badge {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--accent-purple);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .ai-confidence {
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .ai-summary-text {
      font-size: 0.8125rem;
      line-height: 1.45;
      color: var(--text-primary);
    }

    .anomaly-alert-box {
      background-color: var(--accent-rose-subtle);
      border: 1px solid var(--accent-rose-border);
      border-radius: var(--radius-md);
      padding: 0.65rem 0.85rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .alert-title {
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--accent-rose);
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }

    .alert-desc {
      font-size: 0.75rem;
      color: var(--text-primary);
      line-height: 1.35;
    }

    /* Workflow Step Cards */
    .approval-pipeline-card {
      background-color: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: 1.25rem;
    }

    .steps-flow {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-top: 0.5rem;
    }

    .workflow-step-card {
      display: flex;
      gap: 0.75rem;
      background-color: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 0.75rem;
    }

    .workflow-step-card.step-active {
      border-color: var(--accent-amber);
      background-color: rgba(245, 158, 11, 0.03);
    }

    .step-circle {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 700;
      flex-shrink: 0;
    }

    .step-passed {
      background-color: var(--accent-emerald);
      color: #ffffff;
    }

    .step-failed {
      background-color: var(--accent-rose);
      color: #ffffff;
    }

    .step-waiting {
      background-color: var(--bg-subtle);
      color: var(--text-muted);
    }

    .step-info-col {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .step-row-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .step-title {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    .step-status-tag {
      font-size: 0.625rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .step-status-tag[data-status="Approved"] { color: var(--accent-emerald); }
    .step-status-tag[data-status="Pending"] { color: var(--accent-amber); }
    .step-status-tag[data-status="Rejected"] { color: var(--accent-rose); }

    .step-meta {
      font-size: 0.6875rem;
      color: var(--text-muted);
    }

    .step-decided-info {
      font-size: 0.6875rem;
      color: var(--text-secondary);
      margin-top: 0.2rem;
    }

    .step-comment-box {
      font-size: 0.6875rem;
      font-style: italic;
      color: var(--text-muted);
      background-color: var(--bg-subtle);
      padding: 0.35rem 0.5rem;
      border-radius: var(--radius-sm);
      margin-top: 0.25rem;
    }

    /* Editable Fields Card */
    .editable-fields-card {
      background-color: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: 1.25rem;
    }

    .section-header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }

    .fields-form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
    }

    .form-field {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .form-field.full-width {
      grid-column: 1 / -1;
    }

    .form-field label {
      font-size: 0.6875rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      font-weight: 500;
    }

    .form-field input {
      padding: 0.45rem 0.65rem;
      font-size: 0.8125rem;
      background-color: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      color: var(--text-primary);
      outline: none;
    }

    .form-field input:disabled {
      background-color: var(--bg-subtle);
      color: var(--text-secondary);
      cursor: not-allowed;
    }

    .form-field input:focus:not(:disabled) {
      border-color: var(--accent-primary);
    }

    .edit-actions-row {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.75rem;
    }

    .reason-input {
      flex: 1;
      padding: 0.35rem 0.65rem;
      font-size: 0.75rem;
      background-color: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      color: var(--text-primary);
    }

    /* Decision Area */
    .decision-action-box {
      background-color: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: 1.25rem;
    }

    .decision-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }

    .decision-title {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    .active-acting-role {
      font-size: 0.6875rem;
      color: var(--text-muted);
    }

    .comment-textarea {
      width: 100%;
      padding: 0.5rem 0.75rem;
      font-size: 0.8125rem;
      background-color: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      color: var(--text-primary);
      outline: none;
      resize: vertical;
      font-family: inherit;
      margin-bottom: 0.75rem;
    }

    .comment-textarea:focus {
      border-color: var(--accent-primary);
    }

    .action-btn-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .role-requirement-notice {
      padding: 0.75rem;
      border-radius: var(--radius-md);
      background-color: var(--bg-surface);
      font-size: 0.75rem;
    }

    .notice-text {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      line-height: 1.4;
    }

    .text-emerald { color: var(--accent-emerald); }
    .text-rose { color: var(--accent-rose); }
    .text-amber { color: var(--accent-amber); }
    .font-semibold { font-weight: 600; }
    .font-bold { font-weight: 700; }
    .ml-auto { margin-left: auto; }
    .text-right { text-align: right; }
    .btn-xs { padding: 0.25rem 0.6rem; font-size: 0.75rem; }
  `]
})
export class DocumentModalComponent implements OnInit {
  @Input({ required: true }) document!: DocumentItem;
  @Output() closed = new EventEmitter<void>();
  @Output() documentUpdated = new EventEmitter<void>();

  docService = inject(DocumentService);
  authService = inject(AuthPersonaService);
  currentPersona = this.authService.currentPersona;

  doc!: DocumentItem;
  isEditing = false;
  isSaving = false;
  isSubmitting = false;

  actionComment = '';
  editReason = '';

  editForm = {
    documentNumber: '',
    vendorName: '',
    taxId: '',
    subTotal: 0,
    taxRate: 7,
    taxAmount: 0,
    totalAmount: 0
  };

  ngOnInit() {
    this.doc = { ...this.document };
    this.syncEditForm();
  }

  syncEditForm() {
    this.editForm = {
      documentNumber: this.doc.documentNumber,
      vendorName: this.doc.vendorName,
      taxId: this.doc.taxId || '',
      subTotal: this.doc.subTotal,
      taxRate: this.doc.taxRate,
      taxAmount: this.doc.taxAmount,
      totalAmount: this.doc.totalAmount
    };
  }

  formatStatus(status: string): string {
    switch (status) {
      case 'PendingLevel1': return 'Pending L1 (Manager)';
      case 'PendingLevel2': return 'Pending L2 (Finance)';
      case 'Approved': return 'Approved';
      case 'Rejected': return 'Rejected';
      case 'RevisionRequested': return 'Revision Needed';
      default: return status;
    }
  }

  get canApprove(): boolean {
    const role = this.currentPersona().role;
    if (role === 'Auditor' || role === 'Staff') return false;

    if (role === 'Manager' && this.doc.currentApprovalLevel === 1 && this.doc.status === 'PendingLevel1') {
      return true;
    }
    if (role === 'Finance' && this.doc.currentApprovalLevel === 2 && this.doc.status === 'PendingLevel2') {
      return true;
    }
    return false;
  }

  getRequiredRoleName(doc: DocumentItem): string {
    if (doc.currentApprovalLevel === 1) return 'Department Manager';
    if (doc.currentApprovalLevel === 2) return 'Finance Director';
    return 'Authorized Approver';
  }

  startEditing() {
    this.isEditing = true;
  }

  cancelEditing() {
    this.isEditing = false;
    this.syncEditForm();
  }

  onSubTotalChange(val: any) {
    if (val === '' || val === null || val === undefined) return;
    const sub = Number(val);
    if (!isNaN(sub)) {
      this.editForm.subTotal = sub;
      this.recalculateTaxAndTotal();
    }
  }

  onTaxRateChange(val: any) {
    if (val === '' || val === null || val === undefined) return;
    const rate = Number(val);
    if (!isNaN(rate)) {
      this.editForm.taxRate = rate;
      this.recalculateTaxAndTotal();
    }
  }

  onTaxAmountChange(val: any) {
    if (val === '' || val === null || val === undefined) return;
    const tax = Number(val);
    if (!isNaN(tax)) {
      this.editForm.taxAmount = tax;
      this.editForm.totalAmount = Math.round((this.editForm.subTotal + tax) * 100) / 100;
    }
  }

  private recalculateTaxAndTotal() {
    const calculatedTax = Math.round((this.editForm.subTotal * (this.editForm.taxRate / 100)) * 100) / 100;
    this.editForm.taxAmount = calculatedTax;
    this.editForm.totalAmount = Math.round((this.editForm.subTotal + calculatedTax) * 100) / 100;
  }

  saveFieldCorrections() {
    this.isSaving = true;
    const p = this.currentPersona();
    const payload = {
      ...this.editForm,
      actorId: p.id,
      actorName: p.name,
      actorRole: p.role,
      editReason: this.editReason.trim() || 'Manual OCR field reconciliation'
    };

    this.docService.updateDocument(this.doc.id, payload).subscribe({
      next: (updated) => {
        this.doc = updated;
        this.isEditing = false;
        this.isSaving = false;
        this.documentUpdated.emit();
      },
      error: (err) => {
        console.error('Update failed', err);
        this.isSaving = false;
      }
    });
  }

  submitWorkflowAction(action: 'Approve' | 'Reject' | 'RequestRevision') {
    this.isSubmitting = true;
    const p = this.currentPersona();
    this.docService.processWorkflowAction(
      this.doc.id,
      action,
      p.id,
      p.name,
      p.role,
      this.actionComment.trim() || undefined
    ).subscribe({
      next: (updated) => {
        this.doc = updated;
        this.isSubmitting = false;
        this.documentUpdated.emit();
      },
      error: (err) => {
        console.error('Action failed', err);
        this.isSubmitting = false;
      }
    });
  }

  reSubmitForReview() {
    this.isSubmitting = true;
    const p = this.currentPersona();
    this.docService.processWorkflowAction(
      this.doc.id,
      'Resubmit',
      p.id,
      p.name,
      p.role,
      'Staff corrected and re-submitted fields for Level 1 review.'
    ).subscribe({
      next: (updated) => {
        this.doc = updated;
        this.isSubmitting = false;
        this.documentUpdated.emit();
      },
      error: (err) => {
        console.error('Re-submission failed', err);
        this.isSubmitting = false;
      }
    });
  }

  openOriginalFile() {
    if (!this.doc) return;

    // 1. If document has a fileDataUrl (user-uploaded file)
    if (this.doc.fileDataUrl) {
      const win = window.open();
      if (win) {
        if (this.doc.fileDataUrl.startsWith('data:application/pdf')) {
          win.document.write(`
            <!DOCTYPE html><html><head><title>${this.doc.originalFileName} - Original PDF</title></head>
            <body style="margin:0;padding:0;overflow:hidden;background:#1e293b;">
              <iframe src="${this.doc.fileDataUrl}" frameborder="0" style="width:100%;height:100vh;border:none;" allowfullscreen></iframe>
            </body></html>
          `);
        } else {
          win.document.write(`
            <!DOCTYPE html><html><head><title>${this.doc.originalFileName} - Original Document</title></head>
            <body style="margin:0;padding:24px;background:#0f172a;display:flex;justify-content:center;align-items:center;min-height:100vh;">
              <img src="${this.doc.fileDataUrl}" style="max-width:95%;max-height:95vh;box-shadow:0 10px 25px rgba(0,0,0,0.5);border-radius:8px;" />
            </body></html>
          `);
        }
        win.document.close();
        return;
      }
    }

    // 2. If it has a samplePdfUrl or matches a known sample
    let sampleUrl = this.doc.samplePdfUrl;
    if (!sampleUrl) {
      const fn = (this.doc.originalFileName || '').toLowerCase();
      const vn = (this.doc.vendorName || '').toLowerCase();
      if (this.doc.aiAnomalyDetected || fn.includes('anomaly') || fn.includes('overcharge') || vn.includes('hyperion')) {
        sampleUrl = 'samples/Sample_2_Invoice_Tax_Anomaly.pdf';
      } else if (this.doc.documentType === 'Quotation' || vn.includes('nexus') || fn.includes('quote')) {
        sampleUrl = 'samples/Sample_3_Quotation_GPU_Cluster.pdf';
      } else {
        sampleUrl = 'samples/Sample_1_Invoice_Clean.pdf';
      }
    }

    if (sampleUrl) {
      window.open(sampleUrl, '_blank');
      return;
    }

    // 3. Fallback: Printable Document View
    this.printGeneratedOriginal();
  }

  private printGeneratedOriginal() {
    const w = window.open('', '_blank');
    if (!w) return;
    const doc = this.doc;
    const itemsHtml = (doc.lineItems || []).map(item => `
      <tr>
        <td style="padding:10px; border-bottom:1px solid #e2e8f0;">${item.description}</td>
        <td style="padding:10px; border-bottom:1px solid #e2e8f0; text-align:center;">${item.quantity}</td>
        <td style="padding:10px; border-bottom:1px solid #e2e8f0; text-align:right;">$${item.unitPrice.toFixed(2)}</td>
        <td style="padding:10px; border-bottom:1px solid #e2e8f0; text-align:right; font-weight:bold;">$${item.amount.toFixed(2)}</td>
      </tr>
    `).join('');

    w.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${doc.documentNumber} - ${doc.vendorName}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 40px; color: #0f172a; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px; }
          .title { font-size: 26px; font-weight: 800; color: #0f172a; }
          .meta-grid { display: flex; justify-content: space-between; margin-bottom: 30px; background: #f8fafc; padding: 16px; border-radius: 8px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th { background: #f1f5f9; padding: 10px; text-align: left; border-bottom: 2px solid #cbd5e1; font-size: 12px; font-weight: 700; color: #475569; }
          .totals { margin-left: auto; width: 300px; margin-top: 24px; }
          .totals-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
          .total-due { font-weight: 800; font-size: 20px; border-top: 2px solid #0f172a; border-bottom: none; padding-top: 12px; color: #0f172a; }
          .print-btn { background: #0284c7; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 600; margin-bottom: 20px; }
          @media print { .print-btn { display: none; } }
        </style>
      </head>
      <body>
        <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
        <div class="header">
          <div>
            <div class="title">${doc.vendorName}</div>
            <div style="color:#64748b; font-size:14px;">Tax ID / VAT: ${doc.taxId || 'N/A'}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size: 20px; font-weight: 800; color:#0284c7;">${doc.documentType.toUpperCase()}</div>
            <div style="font-family:monospace; font-weight:bold;">${doc.documentNumber}</div>
          </div>
        </div>
        <div class="meta-grid">
          <div>
            <strong style="font-size:12px; color:#64748b; text-transform:uppercase;">Billed To:</strong><br>
            <span style="font-size:16px; font-weight:bold;">${doc.customerName}</span><br>
            <span style="color:#64748b; font-size:13px;">Corporate Accounts Payable</span>
          </div>
          <div style="text-align:right;">
            <strong>Issue Date:</strong> ${doc.issueDate || 'N/A'}<br>
            <strong>Due Date:</strong> ${doc.dueDate || 'N/A'}
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>DESCRIPTION</th>
              <th style="text-align:center;">QTY</th>
              <th style="text-align:right;">UNIT PRICE</th>
              <th style="text-align:right;">AMOUNT</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <div class="totals">
          <div class="totals-row"><span>Subtotal:</span><span>$${doc.subTotal.toFixed(2)}</span></div>
          <div class="totals-row"><span>Tax (${doc.taxRate}%):</span><span>$${doc.taxAmount.toFixed(2)}</span></div>
          <div class="totals-row total-due"><span>Total Due:</span><span>$${doc.totalAmount.toFixed(2)}</span></div>
        </div>
      </body>
      </html>
    `);
    w.document.close();
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
