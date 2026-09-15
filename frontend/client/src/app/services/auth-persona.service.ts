import { Injectable, signal, computed } from '@angular/core';
import { UserPersona } from '../models/document.model';

@Injectable({
  providedIn: 'root'
})
export class AuthPersonaService {
  readonly personas: UserPersona[] = [
    {
      id: 'usr-staff-01',
      name: 'Elena Vance',
      role: 'Staff',
      title: 'Systems Administrator',
      department: 'IT Infrastructure',
      badgeLabel: 'Staff (Ingestion & Submitter)',
      description: 'Uploads and reconciles operational invoices, quotations, and procurement receipts.',
      permissions: {
        canUpload: true,
        canEditFields: true,
        canApproveLevel1: false,
        canApproveLevel2: false,
        canViewAuditLedger: false,
        canViewFinancialTotals: false
      }
    },
    {
      id: 'usr-mgr-01',
      name: 'Sarah Connor',
      role: 'Manager',
      title: 'Operations Director',
      department: 'Infrastructure & Operations',
      badgeLabel: 'Manager (Level 1 Reviewer)',
      description: 'Reviews operational budgets and grants Level 1 sign-off.',
      permissions: {
        canUpload: true,
        canEditFields: false,
        canApproveLevel1: true,
        canApproveLevel2: false,
        canViewAuditLedger: true,
        canViewFinancialTotals: true
      }
    },
    {
      id: 'usr-fin-01',
      name: 'David Sterling',
      role: 'Finance',
      title: 'Chief Financial Officer',
      department: 'Corporate Finance',
      badgeLabel: 'Finance (Level 2 CFO)',
      description: 'Authorizes corporate disbursements, monitors cash flow and flags tax discrepancies.',
      permissions: {
        canUpload: true,
        canEditFields: false,
        canApproveLevel1: false,
        canApproveLevel2: true,
        canViewAuditLedger: true,
        canViewFinancialTotals: true
      }
    },
    {
      id: 'usr-audit-01',
      name: 'Morgan Hayes',
      role: 'Auditor',
      title: 'Senior Compliance Auditor',
      department: 'Internal Audit & Governance',
      badgeLabel: 'Auditor (Compliance & Forensics)',
      description: 'Read-only access to verify cryptographic SHA256 hashes and tamper-evident audit logs.',
      permissions: {
        canUpload: false,
        canEditFields: false,
        canApproveLevel1: false,
        canApproveLevel2: false,
        canViewAuditLedger: true,
        canViewFinancialTotals: true
      }
    }
  ];

  // Default to Staff so natural workflow order (Staff -> Manager -> Finance -> Auditor) begins at Step 1
  currentPersona = signal<UserPersona>(this.personas[0]);

  // Computed permission signals for reactive UI bindings
  canUpload = computed(() => this.currentPersona().permissions.canUpload);
  canEditFields = computed(() => this.currentPersona().permissions.canEditFields);
  canApproveLevel1 = computed(() => this.currentPersona().permissions.canApproveLevel1);
  canApproveLevel2 = computed(() => this.currentPersona().permissions.canApproveLevel2);
  canViewAuditLedger = computed(() => this.currentPersona().permissions.canViewAuditLedger);
  canViewFinancialTotals = computed(() => this.currentPersona().permissions.canViewFinancialTotals);

  setPersona(role: 'Staff' | 'Manager' | 'Finance' | 'Auditor') {
    const p = this.personas.find(x => x.role === role) || this.personas[0];
    this.currentPersona.set(p);
  }
}
