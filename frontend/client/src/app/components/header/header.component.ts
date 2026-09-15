import { Component, Output, EventEmitter, inject, ElementRef, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthPersonaService } from '../../services/auth-persona.service';
import { UiStateService } from '../../services/ui-state.service';
import { UserPersona } from '../../models/document.model';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="app-header">
      <div class="header-brand">
        <div class="brand-symbol">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
        </div>
        <div class="brand-text">
          <div class="brand-title">AegisFlow AI</div>
          <div class="brand-subtitle">Enterprise Document Workflow</div>
        </div>
      </div>

      <div class="header-actions">
        <!-- Persona Role Switcher -->
        <div class="persona-menu-container">
          <button type="button" class="persona-button" (click)="togglePersonaMenu()">
            <div class="persona-avatar">
              {{ currentPersona().name.charAt(0) }}
            </div>
            <div class="persona-meta">
              <span class="persona-name">{{ currentPersona().name }}</span>
              <span class="persona-role-badge" [attr.data-role]="currentPersona().role">
                {{ currentPersona().role }}
              </span>
            </div>
            <svg class="chevron-icon" [class.rotated]="isPersonaMenuOpen()" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>

          @if (isPersonaMenuOpen()) {
            <div class="persona-dropdown">
              <div class="dropdown-header">Switch Active Role</div>
              @for (p of authService.personas; track p.id) {
                <div 
                  class="persona-item" 
                  [class.active]="p.role === currentPersona().role"
                  (click)="selectRole(p.role)">
                  <div class="persona-item-avatar">{{ p.name.charAt(0) }}</div>
                  <div class="persona-item-info">
                    <div class="persona-item-name">{{ p.name }}</div>
                    <div class="persona-item-desc">{{ p.title }} • {{ p.department }}</div>
                  </div>
                  @if (p.role === currentPersona().role) {
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  }
                </div>
              }
            </div>
          }
        </div>

        @if (authService.canViewAuditLedger()) {
          <button type="button" class="btn-secondary" (click)="uiState.openAudit()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
            Audit Ledger
          </button>
        }

        @if (authService.canUpload()) {
          <button type="button" class="btn-primary" (click)="uiState.openUpload()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            Upload Document
          </button>
        }
      </div>
    </header>
  `,
  styles: [`
    .app-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.875rem 2rem;
      background-color: var(--bg-surface);
      border-bottom: 1px solid var(--border-subtle);
      position: sticky;
      top: 0;
      z-index: 40;
    }

    .header-brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .brand-symbol {
      width: 36px;
      height: 36px;
      border-radius: var(--radius-md);
      background: linear-gradient(135deg, var(--accent-primary) 0%, #1e40af 100%);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
    }

    .brand-title {
      font-size: 1rem;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: var(--text-primary);
    }

    .brand-subtitle {
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .persona-menu-container {
      position: relative;
    }

    .persona-button {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      padding: 0.375rem 0.75rem;
      background-color: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      color: var(--text-primary);
    }

    .persona-avatar {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background-color: var(--accent-primary-subtle);
      color: var(--accent-primary);
      font-size: 0.8125rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .persona-meta {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      line-height: 1.2;
    }

    .persona-name {
      font-size: 0.8125rem;
      font-weight: 500;
    }

    .persona-role-badge {
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .persona-role-badge[data-role="Manager"] { color: var(--accent-amber); }
    .persona-role-badge[data-role="Finance"] { color: var(--accent-emerald); }
    .persona-role-badge[data-role="Staff"] { color: var(--accent-primary); }
    .persona-role-badge[data-role="Auditor"] { color: var(--accent-purple); }

    .chevron-icon {
      color: var(--text-secondary);
      transition: transform 150ms ease;
    }

    .chevron-icon.rotated {
      transform: rotate(180deg);
    }

    .persona-dropdown {
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      width: 280px;
      background-color: var(--bg-surface);
      border: 1px solid var(--border-prominent);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-xl);
      padding: 0.35rem;
      z-index: 50;
      backdrop-filter: blur(12px);
    }

    .dropdown-header {
      font-size: 0.6875rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 600;
      color: var(--text-muted);
      padding: 0.5rem 0.65rem 0.35rem;
    }

    .persona-item {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      padding: 0.5rem 0.65rem;
      border-radius: calc(var(--radius-md) - 2px);
      cursor: pointer;
      transition: var(--spring-micro);
    }

    .persona-item:hover {
      background-color: var(--bg-card-hover);
    }

    .persona-item.active {
      background-color: var(--accent-primary-subtle);
    }

    .persona-item-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background-color: var(--bg-subtle);
      color: var(--text-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.8125rem;
      font-weight: 600;
      flex-shrink: 0;
    }

    .persona-item-info {
      flex: 1;
      min-width: 0;
    }

    .persona-item-name {
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--text-primary);
    }

    .persona-item-desc {
      font-size: 0.6875rem;
      color: var(--text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `]
})
export class HeaderComponent {
  @Output() openUpload = new EventEmitter<void>();
  @Output() openAuditTrail = new EventEmitter<void>();

  authService = inject(AuthPersonaService);
  uiState = inject(UiStateService);
  currentPersona = this.authService.currentPersona;
  isPersonaMenuOpen = signal(false);

  constructor(private elementRef: ElementRef) {}

  togglePersonaMenu() {
    this.isPersonaMenuOpen.update(v => !v);
  }

  selectRole(role: 'Staff' | 'Manager' | 'Finance' | 'Auditor') {
    this.authService.setPersona(role);
    this.isPersonaMenuOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent) {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isPersonaMenuOpen.set(false);
    }
  }
}
