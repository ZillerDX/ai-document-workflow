import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DocumentService } from '../../services/document.service';
import { AuthPersonaService } from '../../services/auth-persona.service';
import { UiStateService } from '../../services/ui-state.service';
import { DocumentItem, DashboardStats } from '../../models/document.model';
import { CustomSelectComponent, SelectOption } from '../custom-select/custom-select.component';
import { DocumentModalComponent } from '../document-modal/document-modal.component';
import { UploadModalComponent } from '../upload-modal/upload-modal.component';
import { AuditModalComponent } from '../audit-modal/audit-modal.component';

export interface RowRoleAuthority {
  badgeType: 'action-required' | 'waiting-other' | 'completed' | 'forensics';
  badgeLabel: string;
  dutyText: string;
  subtext: string;
  isActionRequired: boolean;
  actionBtnLabel: string;
  actionBtnClass: string;
  icon: 'sign' | 'authorize' | 'fix' | 'shield' | 'eye';
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    CustomSelectComponent, 
    DocumentModalComponent, 
    UploadModalComponent, 
    AuditModalComponent
  ],
  template: `
    <div class="dashboard-page">
      <!-- Executive Role & Permission Authority Bar -->
      <section class="role-scope-banner" [attr.data-role]="currentPersona().role">
        <div class="scope-left">
          <div class="role-avatar-circle" [attr.data-role]="currentPersona().role">
            {{ currentPersona().name.charAt(0) }}
          </div>
          <div class="scope-details">
            <div class="scope-title-row">
              <span class="user-name">{{ currentPersona().name }}</span>
              <span class="role-pill" [attr.data-role]="currentPersona().role">
                {{ currentPersona().badgeLabel }}
              </span>
              <span class="dept-text">• {{ currentPersona().department }}</span>
            </div>
            <div class="role-scope-desc">
              <span class="scope-statement">{{ currentPersona().description }}</span>
              <span class="scope-divider">|</span>
              <span class="scope-governance">{{ getRoleScopeSummary() }}</span>
            </div>
          </div>
        </div>

        <div class="scope-right">
          <span class="switch-hint">Active Session:</span>
          <div class="persona-pills">
            @for (p of authService.personas; track p.id) {
              <button 
                type="button" 
                class="role-switch-btn" 
                [class.active]="p.role === currentPersona().role"
                [attr.data-role]="p.role"
                (click)="onRoleSwitch(p.role)">
                <span class="pill-dot"></span>
                <span>{{ p.role }}</span>
              </button>
            }
          </div>
        </div>
      </section>

      <!-- Dynamic Bento Grid Top Metrics (Tailored by Active Role) -->
      <section class="metrics-grid">
        <!-- ROLE: STAFF -->
        @if (currentPersona().role === 'Staff') {
          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-label">My Ingested Docs</span>
              <div class="metric-icon primary-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
              </div>
            </div>
            <div class="metric-value tabular-nums text-primary">{{ documents.length }}</div>
            <div class="metric-subtext">Submitted operational documents</div>
          </div>

          <div class="metric-card highlight-pending clickable-card" (click)="setSmartTab('action')">
            <div class="metric-header">
              <span class="metric-label">Action Required</span>
              <div class="metric-icon pending-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M2.5 2v6h6M21.5 22v-6h-6"></path>
                  <path d="M22 11.5A10 10 0 0 0 3.2 7.2M2 12.5a10 10 0 0 0 18.8 4.2"></path>
                </svg>
              </div>
            </div>
            <div class="metric-value tabular-nums text-amber">{{ countRevisionRequested() }}</div>
            <div class="metric-subtext">Revisions returned for field fixes</div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-label">Successfully Authorized</span>
              <div class="metric-icon success-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              </div>
            </div>
            <div class="metric-value tabular-nums text-emerald">{{ stats()?.approvedDocuments ?? 0 }}</div>
            <div class="metric-subtext">Concluded full 2-tier approval</div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-label">AI Extraction Accuracy</span>
              <div class="metric-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
              </div>
            </div>
            <div class="metric-value tabular-nums text-cyan">98.5%</div>
            <div class="metric-subtext">Gemini Multimodal parser score</div>
          </div>
        }

        <!-- ROLE: MANAGER -->
        @if (currentPersona().role === 'Manager') {
          <div class="metric-card highlight-pending clickable-card" (click)="setSmartTab('action')">
            <div class="metric-header">
              <span class="metric-label">Awaiting Your L1 Review</span>
              <div class="metric-icon pending-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
              </div>
            </div>
            <div class="metric-value tabular-nums text-amber">{{ countPendingL1() }}</div>
            <div class="metric-subtext">Immediate action required by your role</div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-label">Department Inflow</span>
              <div class="metric-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
              </div>
            </div>
            <div class="metric-value tabular-nums">{{ documents.length }}</div>
            <div class="metric-subtext">Across Operations & Engineering</div>
          </div>

          <div class="metric-card clickable-card" [class.active-filter]="activeTab === 'anomaly'" (click)="setSmartTab('anomaly')">
            <div class="metric-header">
              <span class="metric-label">AI Discrepancy Alerts</span>
              <div class="metric-icon anomaly-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
              </div>
            </div>
            <div class="metric-value tabular-nums text-rose">{{ stats()?.anomalyCount ?? 0 }}</div>
            <div class="metric-subtext">Tax calculation & math flags</div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-label">Manager Approval Rate</span>
              <div class="metric-icon success-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
            </div>
            <div class="metric-value tabular-nums text-emerald">{{ stats()?.approvalRatePercentage ?? 100 }}%</div>
            <div class="metric-subtext">SLA turnaround &lt; 24 hours</div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-label">Pending L1 Spend</span>
              <div class="metric-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="1" x2="12" y2="23"></line>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
              </div>
            </div>
            <div class="metric-value tabular-nums">\${{ sumPendingL1() | number:'1.2-2' }}</div>
            <div class="metric-subtext">Volume awaiting your authorization</div>
          </div>
        }

        <!-- ROLE: FINANCE -->
        @if (currentPersona().role === 'Finance') {
          <div class="metric-card highlight-cfo clickable-card" (click)="setSmartTab('action')">
            <div class="metric-header">
              <span class="metric-label">Awaiting CFO Release (L2)</span>
              <div class="metric-icon success-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
              </div>
            </div>
            <div class="metric-value tabular-nums text-emerald">{{ countPendingL2() }}</div>
            <div class="metric-subtext">Ready for disbursement authorization</div>
          </div>

          <div class="metric-card clickable-card" [class.active-filter]="activeTab === 'anomaly'" (click)="setSmartTab('anomaly')">
            <div class="metric-header">
              <span class="metric-label">AI Tax Discrepancies</span>
              <div class="metric-icon anomaly-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
              </div>
            </div>
            <div class="metric-value tabular-nums text-rose">{{ stats()?.anomalyCount ?? 0 }}</div>
            <div class="metric-subtext">Requires tax audit reconciliation</div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-label">Pending Cash Release</span>
              <div class="metric-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="1" x2="12" y2="23"></line>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
              </div>
            </div>
            <div class="metric-value tabular-nums">\${{ (stats()?.totalPendingSpend ?? 0) | number:'1.2-2' }}</div>
            <div class="metric-subtext">Pending disbursement release</div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-label">Disbursed to Date</span>
              <div class="metric-icon success-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
            </div>
            <div class="metric-value tabular-nums text-emerald">\${{ (stats()?.totalApprovedSpend ?? 0) | number:'1.2-2' }}</div>
            <div class="metric-subtext">Fully settled corporate spend</div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-label">Payment Authorization %</span>
              <div class="metric-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M12 6v6l4 2"></path>
                </svg>
              </div>
            </div>
            <div class="metric-value tabular-nums text-cyan">{{ stats()?.approvalRatePercentage ?? 100 }}%</div>
            <div class="metric-subtext">{{ stats()?.approvedDocuments ?? 0 }} authorized invoices</div>
          </div>
        }

        <!-- ROLE: AUDITOR -->
        @if (currentPersona().role === 'Auditor') {
          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-label">Audit Log Ledger</span>
              <div class="metric-icon purple-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 20h9"></path>
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                </svg>
              </div>
            </div>
            <div class="metric-value tabular-nums text-purple">{{ stats()?.recentActivities?.length ?? 18 }}</div>
            <div class="metric-subtext">Immutable recorded events</div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-label">Tamper Integrity</span>
              <div class="metric-icon success-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
              </div>
            </div>
            <div class="metric-value tabular-nums text-emerald">100%</div>
            <div class="metric-subtext">SHA-256 hash chains verified</div>
          </div>

          <div class="metric-card highlight-pending clickable-card" (click)="setSmartTab('anomaly')">
            <div class="metric-header">
              <span class="metric-label">Compliance Discrepancies</span>
              <div class="metric-icon anomaly-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
              </div>
            </div>
            <div class="metric-value tabular-nums text-rose">{{ stats()?.anomalyCount ?? 0 }}</div>
            <div class="metric-subtext">Discrepant records flagged for review</div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-label">Total Audited Volume</span>
              <div class="metric-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                </svg>
              </div>
            </div>
            <div class="metric-value tabular-nums">{{ stats()?.totalDocuments ?? 0 }} Docs</div>
            <div class="metric-subtext">100% trace coverage</div>
          </div>

          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-label">Audited Asset Value</span>
              <div class="metric-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="1" x2="12" y2="23"></line>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
              </div>
            </div>
            <div class="metric-value tabular-nums">\${{ ((stats()?.totalPendingSpend ?? 0) + (stats()?.totalApprovedSpend ?? 0)) | number:'1.2-2' }}</div>
            <div class="metric-subtext">Cumulative verified transactions</div>
          </div>
        }
      </section>

      <!-- Smart Queue Navigation Tabs & Presets Toolbar -->
      <section class="smart-tabs-bar">
        <div class="tabs-group">
          <button 
            type="button" 
            class="tab-btn highlight-tab" 
            [class.active]="activeTab === 'action'" 
            (click)="setSmartTab('action')">
            <span class="pulse-dot" *ngIf="getActionQueueCount() > 0"></span>
            <span>Awaiting My Role ({{ currentPersona().role }})</span>
            <span class="tab-badge warning-badge">{{ getActionQueueCount() }}</span>
          </button>

          <button 
            type="button" 
            class="tab-btn" 
            [class.active]="activeTab === 'all'" 
            (click)="setSmartTab('all')">
            <span>{{ currentPersona().role === 'Staff' ? 'My Ingested Docs' : 'Scoped Documents' }}</span>
            <span class="tab-badge">{{ filteredDocuments.length }}</span>
          </button>

          <button 
            type="button" 
            class="tab-btn" 
            [class.active]="activeTab === 'anomaly'" 
            (click)="setSmartTab('anomaly')">
            <span>AI Discrepancies</span>
            <span class="tab-badge danger-badge">{{ stats()?.anomalyCount ?? 0 }}</span>
          </button>

          <button 
            type="button" 
            class="tab-btn" 
            [class.active]="activeTab === 'approved'" 
            (click)="setSmartTab('approved')">
            <span>Settled & Approved</span>
            <span class="tab-badge success-badge">{{ stats()?.approvedDocuments ?? 0 }}</span>
          </button>
        </div>

        <div class="quick-preset-actions" *ngIf="currentPersona().role === 'Staff' || currentPersona().role === 'Manager'">
          <span class="preset-label">Test 1-Click:</span>
          <button type="button" class="btn-xs btn-preset" (click)="injectPreset('acme')">+ Acme Invoice</button>
          <button type="button" class="btn-xs btn-preset-danger" (click)="injectPreset('hyperion')">+ Tax Discrepancy</button>
          <button type="button" class="btn-xs btn-preset" (click)="injectPreset('nexus')">+ Nexus Quote</button>
        </div>
      </section>

      <!-- Search & Filters Toolbar -->
      <section class="toolbar-section">
        <div class="search-box">
          <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input 
            type="text" 
            placeholder="Search by doc #, vendor, customer, or filename..." 
            [(ngModel)]="searchQuery" 
            (ngModelChange)="applyFilters()"
            class="search-input" />
        </div>

        <div class="filter-controls">
          <div class="filter-item">
            <label class="filter-label">Status</label>
            <app-custom-select 
              [options]="statusOptions" 
              [value]="selectedStatus" 
              (valueChange)="onStatusChange($event)">
            </app-custom-select>
          </div>

          <div class="filter-item">
            <label class="filter-label">Type</label>
            <app-custom-select 
              [options]="typeOptions" 
              [value]="selectedType" 
              (valueChange)="onTypeChange($event)">
            </app-custom-select>
          </div>

          <button type="button" class="btn-ghost" (click)="loadData()" title="Refresh dataset">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
          </button>
        </div>
      </section>

      <!-- Enterprise Document Queue Table with Role Authority Guidance -->
      <section class="queue-section">
        <div class="table-container">
          <table class="documents-table">
            <thead>
              <tr>
                <th style="width: 18%;">Document Reference</th>
                <th style="width: 18%;">Counterparty</th>
                <th style="width: 11%;">Issue Date</th>
                <th style="width: 13%;" class="text-right">Total Amount</th>
                <th style="width: 12%;">AI Status</th>
                <th style="width: 10%;">Approval Flow</th>
                <th style="width: 18%;" class="text-right">My Role Duty & Action</th>
              </tr>
            </thead>
            <tbody>
              @if (isLoading) {
                @for (i of [1, 2, 3, 4]; track i) {
                  <tr class="skeleton-row">
                    <td><div class="skeleton-shimmer h-8 w-40"></div></td>
                    <td><div class="skeleton-shimmer h-8 w-36"></div></td>
                    <td><div class="skeleton-shimmer h-8 w-24"></div></td>
                    <td><div class="skeleton-shimmer h-8 w-24 ml-auto"></div></td>
                    <td><div class="skeleton-shimmer h-8 w-28"></div></td>
                    <td><div class="skeleton-shimmer h-8 w-28"></div></td>
                    <td><div class="skeleton-shimmer h-8 w-32 ml-auto"></div></td>
                  </tr>
                }
              } @else if (filteredDocuments.length === 0) {
                <tr>
                  <td colspan="7" class="empty-state-cell">
                    <div class="empty-state-box">
                      <div class="empty-icon">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                          <circle cx="11" cy="11" r="8"></circle>
                          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                      </div>
                      <div class="empty-title">Zero documents in this view</div>
                      <div class="empty-desc">
                        @if (activeTab === 'action') {
                          No pending actions required for <strong>{{ currentPersona().role }}</strong> at this moment.
                        } @else {
                          No documents currently scoped to <strong>{{ currentPersona().role }}</strong>.
                        }
                      </div>

                      <div class="empty-actions">
                        <button type="button" class="btn-secondary btn-sm" (click)="resetFilters()">
                          Clear Filters
                        </button>
                        @if (currentPersona().role === 'Staff') {
                          <button type="button" class="btn-primary btn-sm" (click)="uiState.openUpload()">
                            Upload First Document
                          </button>
                        } @else {
                          <button type="button" class="btn-primary btn-sm" (click)="injectPreset('acme')">
                            Load Demo Document
                          </button>
                        }
                      </div>
                    </div>
                  </td>
                </tr>
              } @else {
                @for (doc of filteredDocuments; track doc.id) {
                  <tr 
                    class="document-row" 
                    [class.row-action-priority]="getRoleAuthority(doc).isActionRequired"
                    [class.has-anomaly]="doc.aiAnomalyDetected"
                    [attr.data-acting-role]="currentPersona().role"
                    (click)="openDetailModal(doc)"
                    title="Click row to view full itemized breakdown & details">
                    <!-- 1. Document Reference -->
                    <td>
                      <div class="doc-identifier-compact">
                        <span class="doc-ref-chip">{{ doc.documentNumber }}</span>
                        <span class="doc-type-pill" [attr.data-type]="doc.documentType">
                          {{ doc.documentType }}
                        </span>
                      </div>
                    </td>

                    <!-- 2. Counterparty -->
                    <td>
                      <div class="vendor-name-compact truncate" [title]="doc.vendorName">{{ doc.vendorName }}</div>
                    </td>

                    <!-- 3. Dates -->
                    <td>
                      <div class="date-compact tabular-nums">{{ doc.issueDate ? (doc.issueDate | date:'yyyy-MM-dd') : 'N/A' }}</div>
                    </td>

                    <!-- 4. Total Amount -->
                    <td class="text-right">
                      <div class="amount-compact tabular-nums">
                        <span class="currency-code">{{ doc.currency }}</span>
                        <span class="amount-val">{{ doc.totalAmount | number:'1.2-2' }}</span>
                      </div>
                    </td>

                    <!-- 5. AI Verification -->
                    <td>
                      <div class="ai-status-compact">
                        @if (doc.aiAnomalyDetected) {
                          <span class="anomaly-tag-compact" [title]="doc.aiAnomalyNotes">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                              <line x1="12" y1="9" x2="12" y2="13"></line>
                              <line x1="12" y1="17" x2="12.01" y2="17"></line>
                            </svg>
                            Tax Anomaly
                          </span>
                        } @else {
                          <span class="clean-tag-compact">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                            Verified Clean
                          </span>
                        }
                      </div>
                    </td>

                    <!-- 6. Visual Stepper Workflow Stage -->
                    <td>
                      <div class="workflow-stepper-compact">
                        <!-- Step 1: Manager -->
                        <div 
                          class="stepper-step" 
                          [class.step-done]="isStepApproved(doc, 1)" 
                          [class.step-active]="doc.currentApprovalLevel === 1 && doc.status === 'PendingLevel1'"
                          [class.step-rejected]="doc.status === 'Rejected' && doc.currentApprovalLevel === 1"
                          [class.step-revision]="doc.status === 'RevisionRequested'">
                          <div class="step-indicator">
                            @if (isStepApproved(doc, 1)) {
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                            } @else if (doc.status === 'RevisionRequested') {
                              <span>!</span>
                            } @else {
                              <span>1</span>
                            }
                          </div>
                          <span class="step-label">L1</span>
                        </div>

                        <!-- Connector Bar -->
                        <div class="stepper-connector" [class.connector-done]="isStepApproved(doc, 1)"></div>

                        <!-- Step 2: Finance -->
                        <div 
                          class="stepper-step" 
                          [class.step-done]="doc.status === 'Approved'" 
                          [class.step-active]="doc.currentApprovalLevel === 2 && doc.status === 'PendingLevel2'"
                          [class.step-rejected]="doc.status === 'Rejected' && doc.currentApprovalLevel === 2">
                          <div class="step-indicator">
                            @if (doc.status === 'Approved') {
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                            } @else {
                              <span>2</span>
                            }
                          </div>
                          <span class="step-label">L2</span>
                        </div>
                      </div>
                    </td>

                    <!-- 7. Role Duty & Action - SAME HORIZONTAL LEVEL ALIGNMENT -->
                    <td class="text-right">
                      <div class="role-duty-action-cell">
                        <!-- Role Duty Badge & Text -->
                        <div class="duty-badge-wrapper">
                          <span class="duty-badge" [attr.data-type]="getRoleAuthority(doc).badgeType">
                            <span class="duty-pulse-dot" *ngIf="getRoleAuthority(doc).isActionRequired"></span>
                            <span class="duty-label">{{ getRoleAuthority(doc).badgeLabel }}</span>
                          </span>
                          <span class="duty-subtext truncate" [title]="getRoleAuthority(doc).dutyText">
                            {{ getRoleAuthority(doc).dutyText }}
                          </span>
                        </div>

                        <!-- Scoped Action Button on Same Horizontal Level -->
                        <button 
                          type="button" 
                          [class]="getRoleAuthority(doc).actionBtnClass"
                          (click)="openDetailModal(doc)">
                          @if (getRoleAuthority(doc).icon === 'sign') {
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          } @else if (getRoleAuthority(doc).icon === 'authorize') {
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                            </svg>
                          } @else if (getRoleAuthority(doc).icon === 'fix') {
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <path d="M12 20h9"></path>
                              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                            </svg>
                          } @else if (getRoleAuthority(doc).icon === 'shield') {
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                            </svg>
                          } @else {
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <circle cx="11" cy="11" r="8"></circle>
                              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                          }
                          <span>{{ getRoleAuthority(doc).actionBtnLabel }}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      </section>

      <!-- Modals -->
      @if (selectedDocForModal) {
        <app-document-modal 
          [document]="selectedDocForModal" 
          (closed)="onModalClosed()" 
          (documentUpdated)="onDocumentUpdated()">
        </app-document-modal>
      }

      @if (uiState.isUploadModalOpen()) {
        <app-upload-modal 
          (closed)="uiState.closeUpload()" 
          (documentCreated)="onNewDocumentCreated($event)">
        </app-upload-modal>
      }

      @if (uiState.isAuditModalOpen()) {
        <app-audit-modal 
          (closed)="uiState.closeAudit()">
        </app-audit-modal>
      }
    </div>
  `,
  styles: [`
    .dashboard-page {
      padding: 1.5rem 2rem 3rem;
      max-width: 1440px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    /* Executive Role Authority Bar */
    .role-scope-banner {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-top: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: var(--radius-lg);
      padding: 1rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1.5rem;
      flex-wrap: wrap;
      box-shadow: var(--shadow-md);
    }

    .scope-left {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .role-avatar-circle {
      width: 44px;
      height: 44px;
      border-radius: var(--radius-md);
      font-size: 1.125rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      color: var(--text-primary);
    }

    .role-avatar-circle[data-role="Staff"] { background: rgba(59, 130, 246, 0.15); color: #60a5fa; border-color: rgba(59, 130, 246, 0.35); }
    .role-avatar-circle[data-role="Manager"] { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border-color: rgba(245, 158, 11, 0.35); }
    .role-avatar-circle[data-role="Finance"] { background: rgba(16, 185, 129, 0.15); color: #34d399; border-color: rgba(16, 185, 129, 0.35); }
    .role-avatar-circle[data-role="Auditor"] { background: rgba(168, 85, 247, 0.15); color: #c084fc; border-color: rgba(168, 85, 247, 0.35); }

    .scope-details {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .scope-title-row {
      display: flex;
      align-items: center;
      gap: 0.65rem;
    }

    .user-name {
      font-size: 1rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .role-pill {
      font-size: 0.6875rem;
      font-weight: 700;
      padding: 0.2rem 0.55rem;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .role-pill[data-role="Staff"] { background: rgba(59, 130, 246, 0.15); color: #93c5fd; }
    .role-pill[data-role="Manager"] { background: rgba(245, 158, 11, 0.15); color: #fde68a; }
    .role-pill[data-role="Finance"] { background: rgba(16, 185, 129, 0.15); color: #a7f3d0; }
    .role-pill[data-role="Auditor"] { background: rgba(168, 85, 247, 0.15); color: #e9d5ff; }

    .dept-text {
      font-size: 0.8125rem;
      color: var(--text-muted);
    }

    .role-scope-desc {
      font-size: 0.8125rem;
      color: var(--text-secondary);
      margin: 0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .scope-statement {
      color: var(--text-secondary);
    }

    .scope-divider {
      color: var(--border-prominent);
      font-weight: 300;
    }

    .scope-governance {
      color: var(--text-muted);
      font-size: 0.75rem;
      font-style: italic;
    }

    .scope-right {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .switch-hint {
      font-size: 0.6875rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-weight: 600;
    }

    .persona-pills {
      display: flex;
      gap: 0.35rem;
      background: var(--bg-card);
      padding: 0.25rem;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-subtle);
    }

    .role-switch-btn {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.35rem 0.75rem;
      border-radius: var(--radius-sm);
      font-size: 0.75rem;
      font-weight: 600;
      border: 1px solid transparent;
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      transition: var(--spring-micro);
    }

    .role-switch-btn:hover {
      color: var(--text-primary);
      background: rgba(255, 255, 255, 0.04);
    }

    .role-switch-btn.active {
      color: var(--text-primary);
      background: var(--bg-surface);
      border-color: var(--border-prominent);
      box-shadow: var(--shadow-sm);
    }

    .pill-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--text-muted);
    }

    .role-switch-btn.active .pill-dot {
      background: var(--accent-emerald);
      box-shadow: 0 0 6px var(--accent-emerald);
    }

    /* Bento Grid Metrics */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 1rem;
    }

    .metric-card {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 1.15rem 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      box-shadow: var(--shadow-sm);
      transition: var(--spring-micro);
    }

    .metric-card:hover {
      border-color: var(--border-prominent);
      transform: translateY(-1px);
    }

    .highlight-pending {
      border-color: rgba(245, 158, 11, 0.35);
      background: linear-gradient(135deg, var(--bg-card) 0%, rgba(245, 158, 11, 0.05) 100%);
    }

    .highlight-cfo {
      border-color: rgba(16, 185, 129, 0.35);
      background: linear-gradient(135deg, var(--bg-card) 0%, rgba(16, 185, 129, 0.05) 100%);
    }

    .clickable-card {
      cursor: pointer;
    }

    .clickable-card.active-filter {
      border-color: var(--accent-rose);
      background: rgba(239, 68, 68, 0.06);
    }

    .metric-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .metric-label {
      font-size: 0.6875rem;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .metric-icon { color: var(--text-muted); }
    .pending-icon { color: var(--accent-amber); }
    .anomaly-icon { color: var(--accent-rose); }
    .success-icon { color: var(--accent-emerald); }
    .primary-icon { color: var(--accent-primary); }
    .purple-icon { color: var(--accent-purple); }

    .metric-value {
      font-size: 1.75rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1.2;
      color: var(--text-primary);
    }

    .text-amber { color: #fbbf24; }
    .text-rose { color: #f87171; }
    .text-emerald { color: #34d399; }
    .text-primary { color: #60a5fa; }
    .text-cyan { color: #38bdf8; }
    .text-purple { color: #c084fc; }

    .metric-subtext {
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    /* Smart Tabs Bar */
    .smart-tabs-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
      border-bottom: 1px solid var(--border-subtle);
      padding-bottom: 0.5rem;
    }

    .tabs-group {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .tab-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.875rem;
      border-radius: var(--radius-md);
      background: transparent;
      border: 1px solid transparent;
      color: var(--text-muted);
      font-size: 0.8125rem;
      font-weight: 600;
      cursor: pointer;
      transition: var(--spring-micro);
    }

    .tab-btn:hover {
      color: var(--text-primary);
      background: var(--bg-card);
    }

    .tab-btn.active {
      color: var(--text-primary);
      background: var(--bg-card);
      border-color: var(--border-prominent);
      box-shadow: var(--shadow-sm);
    }

    .tab-badge {
      font-size: 0.6875rem;
      padding: 0.15rem 0.45rem;
      border-radius: 9999px;
      background: rgba(255, 255, 255, 0.08);
      color: var(--text-secondary);
    }

    .warning-badge { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }
    .danger-badge { background: rgba(239, 68, 68, 0.2); color: #fca5a5; }
    .success-badge { background: rgba(16, 185, 129, 0.2); color: #6ee7b7; }

    .pulse-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #f59e0b;
      box-shadow: 0 0 6px #f59e0b;
      animation: pulse 1.5s infinite;
    }

    @keyframes pulse {
      0% { opacity: 0.4; }
      50% { opacity: 1; }
      100% { opacity: 0.4; }
    }

    .quick-preset-actions {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .preset-label {
      font-size: 0.75rem;
      color: var(--text-muted);
      font-weight: 500;
    }

    .btn-preset {
      background: rgba(59, 130, 246, 0.1);
      border: 1px solid rgba(59, 130, 246, 0.25);
      color: #93c5fd;
      padding: 0.25rem 0.55rem;
      border-radius: var(--radius-sm);
      font-size: 0.6875rem;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-preset-danger {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #fca5a5;
      padding: 0.25rem 0.55rem;
      border-radius: var(--radius-sm);
      font-size: 0.6875rem;
      font-weight: 600;
      cursor: pointer;
    }

    /* Toolbar Section */
    .toolbar-section {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 1rem;
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 0.75rem 1.25rem;
    }

    .search-box {
      position: relative;
      flex: 1;
      min-width: 260px;
    }

    .search-icon {
      position: absolute;
      left: 0.875rem;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-muted);
      pointer-events: none;
    }

    .search-input {
      width: 100%;
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      padding: 0.5rem 0.875rem 0.5rem 2.4rem;
      color: var(--text-primary);
      font-size: 0.8125rem;
      outline: none;
      transition: var(--spring-micro);
    }

    .search-input:focus {
      border-color: var(--accent-primary);
      box-shadow: 0 0 0 1px var(--accent-primary);
    }

    .filter-controls {
      display: flex;
      align-items: center;
      gap: 0.85rem;
    }

    .filter-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .filter-label {
      font-size: 0.75rem;
      color: var(--text-muted);
      font-weight: 500;
    }

    .btn-ghost {
      background: transparent;
      border: 1px solid var(--border-subtle);
      color: var(--text-muted);
      border-radius: var(--radius-sm);
      padding: 0.45rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: var(--spring-micro);
    }

    .btn-ghost:hover {
      color: var(--text-primary);
      background: var(--bg-card);
      border-color: var(--border-prominent);
    }

    /* Enterprise Table & Queue */
    .table-container {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      overflow-x: auto;
      box-shadow: var(--shadow-sm);
    }

    .documents-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8125rem;
      text-align: left;
    }

    .documents-table th {
      background: rgba(255, 255, 255, 0.02);
      color: var(--text-muted);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-size: 0.6875rem;
      padding: 0.875rem 1.25rem;
      border-bottom: 1px solid var(--border-subtle);
    }

    .documents-table td {
      padding: 0.65rem 1.25rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      vertical-align: middle;
      white-space: nowrap;
      height: 52px;
      transition: background-color 150ms ease;
    }

    .document-row {
      cursor: pointer;
    }

    .document-row:hover td {
      background: rgba(255, 255, 255, 0.035);
    }

    /* Row Priority Accent when Active Role has Action Duty */
    .document-row.row-action-priority td:first-child {
      border-left: 3px solid #f59e0b;
    }

    .document-row.row-action-priority[data-acting-role="Finance"] td:first-child {
      border-left: 3px solid #10b981;
    }

    .document-row.row-action-priority[data-acting-role="Staff"] td:first-child {
      border-left: 3px solid #ef4444;
    }

    .document-row.row-action-priority {
      background: rgba(255, 255, 255, 0.015);
    }

    .document-row.has-anomaly td {
      background: rgba(239, 68, 68, 0.02);
    }

    /* 1. Document Reference Cell - Compact */
    .doc-identifier-compact {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
    }

    .doc-ref-chip {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 600;
      font-size: 0.75rem;
      color: #38bdf8;
      background: rgba(56, 189, 248, 0.08);
      padding: 0.15rem 0.45rem;
      border-radius: var(--radius-sm);
      border: 1px solid rgba(56, 189, 248, 0.2);
    }

    .doc-type-pill {
      font-size: 0.625rem;
      font-weight: 600;
      padding: 0.15rem 0.45rem;
      border-radius: var(--radius-sm);
      background: var(--bg-card);
      color: var(--text-secondary);
      border: 1px solid var(--border-subtle);
      text-transform: uppercase;
    }

    .doc-type-pill[data-type="Quotation"] {
      background: rgba(168, 85, 247, 0.1);
      color: #d8b4fe;
      border-color: rgba(168, 85, 247, 0.25);
    }

    .doc-type-pill[data-type="PurchaseOrder"] {
      background: rgba(245, 158, 11, 0.1);
      color: #fde68a;
      border-color: rgba(245, 158, 11, 0.25);
    }

    /* 2. Counterparty Cell - Single Line */
    .vendor-name-compact {
      font-weight: 600;
      color: var(--text-primary);
      font-size: 0.8125rem;
      max-width: 200px;
    }

    /* 3. Dates Cell - Single Line */
    .date-compact {
      color: var(--text-secondary);
      font-size: 0.75rem;
    }

    /* 4. Total Amount Cell - Single Line */
    .amount-compact {
      display: inline-flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.25rem;
      font-size: 0.875rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .currency-code {
      font-size: 0.6875rem;
      color: var(--text-muted);
      font-weight: 600;
    }

    /* 5. AI Status Cell - Compact */
    .ai-status-compact {
      display: inline-flex;
      align-items: center;
    }

    .clean-tag-compact {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.6875rem;
      font-weight: 600;
      color: #34d399;
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.25);
      padding: 0.2rem 0.5rem;
      border-radius: var(--radius-sm);
    }

    .anomaly-tag-compact {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.6875rem;
      font-weight: 600;
      color: #f87171;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.25);
      padding: 0.2rem 0.5rem;
      border-radius: var(--radius-sm);
    }

    /* 6. Visual Stepper Workflow Stage - Compact */
    .workflow-stepper-compact {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
    }

    .stepper-step {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }

    .step-indicator {
      width: 17px;
      height: 17px;
      border-radius: 50%;
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      color: var(--text-muted);
      font-size: 0.5625rem;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .step-label {
      font-size: 0.6875rem;
      color: var(--text-muted);
      font-weight: 500;
    }

    .stepper-step.step-active .step-indicator {
      border-color: #f59e0b;
      color: #f59e0b;
      box-shadow: 0 0 5px rgba(245, 158, 11, 0.35);
    }

    .stepper-step.step-active .step-label {
      color: #fbbf24;
      font-weight: 600;
    }

    .stepper-step.step-done .step-indicator {
      background: rgba(16, 185, 129, 0.15);
      border-color: rgba(16, 185, 129, 0.4);
      color: #34d399;
    }

    .stepper-step.step-done .step-label {
      color: #34d399;
    }

    .stepper-step.step-rejected .step-indicator {
      background: rgba(239, 68, 68, 0.15);
      border-color: rgba(239, 68, 68, 0.4);
      color: #f87171;
    }

    .stepper-step.step-rejected .step-label {
      color: #f87171;
    }

    .stepper-step.step-revision .step-indicator {
      background: rgba(245, 158, 11, 0.15);
      border-color: rgba(245, 158, 11, 0.4);
      color: #fbbf24;
    }

    .stepper-connector {
      width: 14px;
      height: 2px;
      background: var(--border-subtle);
    }

    .stepper-connector.connector-done {
      background: #34d399;
    }

    /* 7. Role Duty & Action Cell - HORIZONTAL SAME LEVEL ALIGNMENT */
    .role-duty-action-cell {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: flex-end;
      gap: 0.75rem;
      white-space: nowrap;
    }

    .duty-badge-wrapper {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .duty-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.625rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 0.15rem 0.45rem;
      border-radius: var(--radius-sm);
    }

    .duty-badge[data-type="action-required"] {
      background: rgba(245, 158, 11, 0.15);
      color: #fde68a;
      border: 1px solid rgba(245, 158, 11, 0.35);
    }

    .duty-badge[data-type="waiting-other"] {
      background: var(--bg-card);
      color: var(--text-muted);
      border: 1px solid var(--border-subtle);
    }

    .duty-badge[data-type="completed"] {
      background: rgba(16, 185, 129, 0.12);
      color: #a7f3d0;
      border: 1px solid rgba(16, 185, 129, 0.25);
    }

    .duty-badge[data-type="forensics"] {
      background: rgba(168, 85, 247, 0.12);
      color: #e9d5ff;
      border: 1px solid rgba(168, 85, 247, 0.25);
    }

    .duty-pulse-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: #fbbf24;
      box-shadow: 0 0 5px #fbbf24;
      animation: pulse 1.2s infinite;
    }

    .duty-subtext {
      font-size: 0.6875rem;
      color: var(--text-muted);
      max-width: 140px;
    }

    /* Action Buttons */
    .btn-row-action-l1 {
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 0.35rem 0.75rem;
      border-radius: var(--radius-sm);
      font-size: 0.75rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 0.35rem;
      cursor: pointer;
      box-shadow: 0 1px 4px rgba(245, 158, 11, 0.3);
      transition: var(--spring-micro);
      flex-shrink: 0;
    }

    .btn-row-action-l1:hover {
      filter: brightness(1.1);
      transform: translateY(-1px);
    }

    .btn-row-action-l2 {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 0.35rem 0.75rem;
      border-radius: var(--radius-sm);
      font-size: 0.75rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 0.35rem;
      cursor: pointer;
      box-shadow: 0 1px 4px rgba(16, 185, 129, 0.3);
      transition: var(--spring-micro);
      flex-shrink: 0;
    }

    .btn-row-action-l2:hover {
      filter: brightness(1.1);
      transform: translateY(-1px);
    }

    .btn-row-action-staff {
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 0.35rem 0.75rem;
      border-radius: var(--radius-sm);
      font-size: 0.75rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 0.35rem;
      cursor: pointer;
      box-shadow: 0 1px 4px rgba(239, 68, 68, 0.3);
      transition: var(--spring-micro);
      flex-shrink: 0;
    }

    .btn-row-action-staff:hover {
      filter: brightness(1.1);
      transform: translateY(-1px);
    }

    .btn-row-action-audit {
      background: rgba(168, 85, 247, 0.15);
      color: #d8b4fe;
      border: 1px solid rgba(168, 85, 247, 0.35);
      padding: 0.35rem 0.75rem;
      border-radius: var(--radius-sm);
      font-size: 0.75rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 0.35rem;
      cursor: pointer;
      transition: var(--spring-micro);
      flex-shrink: 0;
    }

    .btn-row-action-audit:hover {
      background: rgba(168, 85, 247, 0.25);
      border-color: rgba(168, 85, 247, 0.5);
      transform: translateY(-1px);
    }

    .btn-row-inspect {
      background: var(--bg-card);
      color: var(--text-secondary);
      border: 1px solid var(--border-subtle);
      padding: 0.35rem 0.75rem;
      border-radius: var(--radius-sm);
      font-size: 0.75rem;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 0.35rem;
      cursor: pointer;
      transition: var(--spring-micro);
      flex-shrink: 0;
    }

    .btn-row-inspect:hover {
      background: var(--bg-card-hover);
      color: var(--text-primary);
      border-color: var(--border-prominent);
      transform: translateY(-1px);
    }

    /* Empty State */
    .empty-state-cell {
      padding: 4rem 1rem !important;
      text-align: center;
    }

    .empty-state-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      max-width: 420px;
      margin: 0 auto;
    }

    .empty-icon {
      color: var(--text-muted);
      margin-bottom: 0.25rem;
    }

    .empty-title {
      font-size: 1rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .empty-desc {
      font-size: 0.8125rem;
      color: var(--text-muted);
      line-height: 1.5;
    }

    .empty-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }

    .btn-sm {
      padding: 0.4rem 0.8rem;
      font-size: 0.75rem;
    }

    /* Responsive Media Queries */
    @media (max-width: 1024px) {
      .documents-table {
        min-width: 820px;
      }
      .metrics-grid {
        grid-template-columns: repeat(2, 1fr) !important;
      }
    }

    @media (max-width: 768px) {
      .dashboard-page {
        padding: 1rem 0.75rem 2rem;
      }
      .metrics-grid {
        grid-template-columns: 1fr !important;
      }
      .smart-tabs-bar {
        overflow-x: auto;
        padding-bottom: 0.5rem;
      }
      .tabs-group {
        flex-wrap: nowrap;
        overflow-x: auto;
      }
      .quick-preset-actions {
        display: none;
      }
      .toolbar-section {
        flex-direction: column;
        align-items: stretch;
      }
      .search-box {
        max-width: 100%;
      }
      .filter-controls {
        flex-wrap: wrap;
        width: 100%;
      }
      .filter-item {
        flex: 1;
        min-width: 130px;
      }
    }
  `]
})
export class DashboardComponent implements OnInit {
  private docService = inject(DocumentService);
  public authService = inject(AuthPersonaService);
  public uiState = inject(UiStateService);

  currentPersona = this.authService.currentPersona;

  documents: DocumentItem[] = [];
  filteredDocuments: DocumentItem[] = [];
  stats = signal<DashboardStats | null>(null);

  isLoading = true;
  searchQuery = '';
  // Default to 'action' so each role immediately sees their own pending duties
  activeTab: 'all' | 'action' | 'anomaly' | 'approved' = 'action';
  selectedStatus = 'all';
  selectedType = 'all';

  statusOptions: SelectOption[] = [
    { value: 'all', label: 'All Statuses' },
    { value: 'PendingLevel1', label: 'Pending L1 (Manager)' },
    { value: 'PendingLevel2', label: 'Pending L2 (Finance)' },
    { value: 'Approved', label: 'Approved' },
    { value: 'Rejected', label: 'Rejected' },
    { value: 'RevisionRequested', label: 'Revision Needed' }
  ];

  typeOptions: SelectOption[] = [
    { value: 'all', label: 'All Types' },
    { value: 'Invoice', label: 'Invoice' },
    { value: 'Quotation', label: 'Quotation' },
    { value: 'PurchaseOrder', label: 'Purchase Order' }
  ];

  selectedDocForModal: DocumentItem | null = null;

  constructor() {
    effect(() => {
      const p = this.authService.currentPersona();
      if (p.role === 'Manager' || p.role === 'Finance') {
        this.activeTab = 'action';
      } else {
        this.activeTab = 'all';
      }
      this.selectedStatus = 'all';
      this.selectedType = 'all';
      this.applyFilters();
    });
  }

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.isLoading = true;
    this.docService.getStats().subscribe({
      next: (s) => this.stats.set(s),
      error: (e) => console.error('Failed to load stats', e)
    });

    this.docService.getDocuments().subscribe({
      next: (docs) => {
        this.documents = docs;
        this.applyFilters();
        this.isLoading = false;
      },
      error: (e) => {
        console.error('Failed to load documents', e);
        this.isLoading = false;
      }
    });
  }

  onRoleSwitch(role: 'Staff' | 'Manager' | 'Finance' | 'Auditor') {
    this.authService.setPersona(role);
    // Focus automatically on the role's personal action queue
    this.activeTab = 'action';
    this.applyFilters();
  }

  getRoleScopeSummary(): string {
    const role = this.currentPersona().role;
    switch (role) {
      case 'Staff':
        return 'Authorized: Ingestion, OCR verification & field corrections • Restricted: Review approvals';
      case 'Manager':
        return 'Authorized: Level 1 operational sign-off & revision requests • Restricted: Level 2 disbursement release';
      case 'Finance':
        return 'Authorized: Final Level 2 corporate cash release & tax discrepancy reconciliation • Pre-requisite: Level 1 sign-off';
      case 'Auditor':
        return 'Authorized: Independent compliance inspection & cryptographic SHA-256 block chain verification • Strictly Read-Only';
      default:
        return '';
    }
  }

  getRoleAuthority(doc: DocumentItem): RowRoleAuthority {
    const role = this.currentPersona().role;
    const status = doc.status;

    if (role === 'Manager') {
      if (status === 'PendingLevel1') {
        return {
          badgeType: 'action-required',
          badgeLabel: 'Action Required',
          dutyText: 'Needs Your L1 Sign-off',
          subtext: 'Operational sign-off required',
          isActionRequired: true,
          actionBtnLabel: 'Review L1',
          actionBtnClass: 'btn-row-action-l1',
          icon: 'sign'
        };
      } else if (status === 'PendingLevel2') {
        return {
          badgeType: 'waiting-other',
          badgeLabel: 'Handed Off',
          dutyText: 'In Finance (L2) Queue',
          subtext: 'Awaiting CFO cash release',
          isActionRequired: false,
          actionBtnLabel: 'Inspect',
          actionBtnClass: 'btn-row-inspect',
          icon: 'eye'
        };
      } else if (status === 'RevisionRequested') {
        return {
          badgeType: 'waiting-other',
          badgeLabel: 'Revision',
          dutyText: 'With Staff for Fixes',
          subtext: 'Staff amending fields',
          isActionRequired: false,
          actionBtnLabel: 'Inspect',
          actionBtnClass: 'btn-row-inspect',
          icon: 'eye'
        };
      } else if (status === 'Approved') {
        return {
          badgeType: 'completed',
          badgeLabel: 'Settled',
          dutyText: 'Concluded (Approved)',
          subtext: 'Disbursement authorized',
          isActionRequired: false,
          actionBtnLabel: 'View Record',
          actionBtnClass: 'btn-row-inspect',
          icon: 'eye'
        };
      } else {
        return {
          badgeType: 'completed',
          badgeLabel: 'Declined',
          dutyText: 'Workflow Terminated',
          subtext: 'Rejected by reviewer',
          isActionRequired: false,
          actionBtnLabel: 'View Record',
          actionBtnClass: 'btn-row-inspect',
          icon: 'eye'
        };
      }
    }

    if (role === 'Finance') {
      if (status === 'PendingLevel2') {
        return {
          badgeType: 'action-required',
          badgeLabel: 'Action Required',
          dutyText: 'Needs Your CFO Release',
          subtext: 'Final disbursement authorization',
          isActionRequired: true,
          actionBtnLabel: 'Authorize L2',
          actionBtnClass: 'btn-row-action-l2',
          icon: 'authorize'
        };
      } else if (status === 'PendingLevel1') {
        return {
          badgeType: 'waiting-other',
          badgeLabel: 'Upstream',
          dutyText: 'Awaiting Manager L1 First',
          subtext: 'Manager sign-off required',
          isActionRequired: false,
          actionBtnLabel: 'Inspect',
          actionBtnClass: 'btn-row-inspect',
          icon: 'eye'
        };
      } else if (status === 'RevisionRequested') {
        return {
          badgeType: 'waiting-other',
          badgeLabel: 'Revision',
          dutyText: 'Staff Reconciling OCR',
          subtext: 'Line items being corrected',
          isActionRequired: false,
          actionBtnLabel: 'Inspect',
          actionBtnClass: 'btn-row-inspect',
          icon: 'eye'
        };
      } else if (status === 'Approved') {
        return {
          badgeType: 'completed',
          badgeLabel: 'Disbursed',
          dutyText: 'Payment Settled',
          subtext: 'Corporate funds cleared',
          isActionRequired: false,
          actionBtnLabel: 'View Record',
          actionBtnClass: 'btn-row-inspect',
          icon: 'eye'
        };
      } else {
        return {
          badgeType: 'completed',
          badgeLabel: 'Blocked',
          dutyText: 'Disbursement Rejected',
          subtext: 'Workflow terminated',
          isActionRequired: false,
          actionBtnLabel: 'View Record',
          actionBtnClass: 'btn-row-inspect',
          icon: 'eye'
        };
      }
    }

    if (role === 'Staff') {
      if (status === 'RevisionRequested') {
        return {
          badgeType: 'action-required',
          badgeLabel: 'Action Required',
          dutyText: 'Fix Fields & Resubmit',
          subtext: 'Manager requested changes',
          isActionRequired: true,
          actionBtnLabel: 'Fix Revisions',
          actionBtnClass: 'btn-row-action-staff',
          icon: 'fix'
        };
      } else if (status === 'PendingLevel1') {
        return {
          badgeType: 'waiting-other',
          badgeLabel: 'In Review',
          dutyText: 'With Department Manager',
          subtext: 'Level 1 review pending',
          isActionRequired: false,
          actionBtnLabel: 'View Status',
          actionBtnClass: 'btn-row-inspect',
          icon: 'eye'
        };
      } else if (status === 'PendingLevel2') {
        return {
          badgeType: 'waiting-other',
          badgeLabel: 'In Review',
          dutyText: 'With Corporate Finance',
          subtext: 'Level 2 disbursement pending',
          isActionRequired: false,
          actionBtnLabel: 'View Status',
          actionBtnClass: 'btn-row-inspect',
          icon: 'eye'
        };
      } else if (status === 'Approved') {
        return {
          badgeType: 'completed',
          badgeLabel: 'Approved',
          dutyText: 'Authorized & Settled',
          subtext: 'Sign-offs complete',
          isActionRequired: false,
          actionBtnLabel: 'View Record',
          actionBtnClass: 'btn-row-inspect',
          icon: 'eye'
        };
      } else {
        return {
          badgeType: 'completed',
          badgeLabel: 'Rejected',
          dutyText: 'Submission Declined',
          subtext: 'Reviewer rejected document',
          isActionRequired: false,
          actionBtnLabel: 'View Record',
          actionBtnClass: 'btn-row-inspect',
          icon: 'eye'
        };
      }
    }

    // Auditor
    return {
      badgeType: 'forensics',
      badgeLabel: 'Forensics',
      dutyText: doc.aiAnomalyDetected ? 'Tax Discrepancy Flagged' : 'SHA-256 Ledger Verified',
      subtext: 'Read-only compliance audit',
      isActionRequired: false,
      actionBtnLabel: 'Audit Hash Trail',
      actionBtnClass: 'btn-row-action-audit',
      icon: 'shield'
    };
  }

  setSmartTab(tab: 'all' | 'action' | 'anomaly' | 'approved') {
    this.activeTab = tab;
    this.applyFilters();
  }

  onStatusChange(val: string) {
    this.selectedStatus = val;
    this.applyFilters();
  }

  onTypeChange(val: string) {
    this.selectedType = val;
    this.applyFilters();
  }

  resetFilters() {
    this.searchQuery = '';
    this.selectedStatus = 'all';
    this.selectedType = 'all';
    this.activeTab = 'all';
    this.applyFilters();
  }

  applyFilters() {
    let result = [...this.documents];
    const role = this.currentPersona().role;

    // Strict Role Scoping: each persona sees what they are authorized to manage
    if (this.activeTab === 'action') {
      if (role === 'Staff') {
        result = result.filter(d => d.status === 'RevisionRequested');
      } else if (role === 'Manager') {
        result = result.filter(d => d.status === 'PendingLevel1');
      } else if (role === 'Finance') {
        result = result.filter(d => d.status === 'PendingLevel2');
      } else if (role === 'Auditor') {
        result = result.filter(d => d.aiAnomalyDetected);
      }
    } else if (this.activeTab === 'anomaly') {
      result = result.filter(d => d.aiAnomalyDetected);
    } else if (this.activeTab === 'approved') {
      result = result.filter(d => d.status === 'Approved');
    } else if (this.activeTab === 'all') {
      // Scoped 'all' based on role responsibilities:
      if (role === 'Staff') {
        // Staff sees all their ingested documents and revisions
        result = result.filter(d => d.uploadedByUserId === 'usr-staff-01' || d.status === 'RevisionRequested');
      } else if (role === 'Manager') {
        // Manager sees documents in approval stages L1/L2 and revisions
        result = result.filter(d => d.status === 'PendingLevel1' || d.status === 'PendingLevel2' || d.status === 'RevisionRequested');
      } else if (role === 'Finance') {
        // Finance sees L2 pending, approved disbursements, and tax anomalies
        result = result.filter(d => d.status === 'PendingLevel2' || d.status === 'Approved' || d.aiAnomalyDetected);
      }
      // Auditor sees all documents without restriction for compliance
    }

    // Status Dropdown Filter
    if (this.selectedStatus !== 'all') {
      result = result.filter(d => d.status.toLowerCase() === this.selectedStatus.toLowerCase());
    }

    // Type Dropdown Filter
    if (this.selectedType !== 'all') {
      result = result.filter(d => d.documentType.toLowerCase() === this.selectedType.toLowerCase());
    }

    // Search Query Filter
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      result = result.filter(d => 
        d.documentNumber.toLowerCase().includes(q) ||
        d.vendorName.toLowerCase().includes(q) ||
        d.customerName.toLowerCase().includes(q) ||
        d.originalFileName.toLowerCase().includes(q)
      );
    }

    this.filteredDocuments = result;
  }

  getActionQueueCount(): number {
    const role = this.currentPersona().role;
    if (role === 'Manager') return this.countPendingL1();
    if (role === 'Finance') return this.countPendingL2();
    if (role === 'Staff') return this.countRevisionRequested();
    if (role === 'Auditor') return this.stats()?.anomalyCount ?? 0;
    return 0;
  }

  countPendingL1(): number {
    return this.documents.filter(d => d.status === 'PendingLevel1').length;
  }

  countPendingL2(): number {
    return this.documents.filter(d => d.status === 'PendingLevel2').length;
  }

  countRevisionRequested(): number {
    return this.documents.filter(d => d.status === 'RevisionRequested').length;
  }

  sumPendingL1(): number {
    return this.documents
      .filter(d => d.status === 'PendingLevel1')
      .reduce((sum, d) => sum + d.totalAmount, 0);
  }

  isStepApproved(doc: DocumentItem, step: number): boolean {
    const s = doc.approvalSteps?.find(x => x.stepNumber === step);
    return s?.status === 'Approved';
  }

  injectPreset(presetName: string) {
    const p = this.currentPersona();
    this.docService.createPreset(presetName, p.id, p.name).subscribe({
      next: (createdDoc) => {
        this.loadData();
        this.openDetailModal(createdDoc);
      },
      error: (err) => console.error('Preset creation failed', err)
    });
  }

  openDetailModal(doc: DocumentItem) {
    this.selectedDocForModal = doc;
  }

  onModalClosed() {
    this.selectedDocForModal = null;
  }

  onDocumentUpdated() {
    this.selectedDocForModal = null;
    this.loadData();
  }

  onNewDocumentCreated(doc: DocumentItem) {
    this.uiState.closeUpload();
    this.loadData();
    this.openDetailModal(doc);
  }
}
