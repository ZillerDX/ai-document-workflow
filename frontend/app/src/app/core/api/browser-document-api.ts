import { Injectable, inject } from '@angular/core';
import {
  ApprovalStep,
  AuditLog,
  DashboardStats,
  DocumentEdit,
  DocumentFilter,
  DocumentItem,
  DocumentType,
  IntegrityReport,
  LineItem,
  PresetType,
  WorkflowAction,
} from '../models';
import { SessionService } from '../auth/session.service';
import {
  Decision,
  canSubmit,
  canViewFinancialTotals,
  canViewLedger,
  evaluateDecision,
  evaluateEdit,
  evaluateReanalyze,
  evaluateResubmit,
  isTerminal,
  taxMismatch,
} from '../workflow-rules';
import { ApiError, DocumentApi, validateUpload } from './document-api';

const DOCS_KEY = 'aegisflow_documents_v2';
const LOGS_KEY = 'aegisflow_audit_logs_v2';
export const GENESIS_HASH = '0'.repeat(64);
/** Uploads larger than this are not kept in localStorage (the ~5 MB quota is shared with everything else). */
const MAX_STORED_FILE_BYTES = 1_000_000;

const BASE_URL = typeof document !== 'undefined' ? document.baseURI : '/';

/**
 * Self-contained mode for static hosting. Everything lives in localStorage and the same workflow rules as the
 * backend are enforced here. The hash chain is a client-side demo only: whoever controls the browser can
 * recompute it, so it is NOT tamper-proof (the .NET API mode is the authoritative ledger).
 */
@Injectable()
export class BrowserDocumentApi extends DocumentApi {
  private readonly session = inject(SessionService);

  // ---- reads ---------------------------------------------------------------------------------

  async listDocuments(filter: DocumentFilter = {}): Promise<DocumentItem[]> {
    let docs = this.readDocs();
    if (filter.status && filter.status !== 'all') {
      docs = docs.filter((d) => d.status.toLowerCase() === filter.status!.toLowerCase());
    }
    if (filter.type && filter.type !== 'all') {
      docs = docs.filter((d) => d.documentType.toLowerCase() === filter.type!.toLowerCase());
    }
    const q = filter.search?.trim().toLowerCase();
    if (q) {
      docs = docs.filter((d) =>
        [d.documentNumber, d.vendorName, d.customerName, d.originalFileName].some((v) =>
          v.toLowerCase().includes(q),
        ),
      );
    }
    return docs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getDocument(id: string): Promise<DocumentItem> {
    return this.mustFind(this.readDocs(), id);
  }

  async getStats(): Promise<DashboardStats> {
    const docs = this.readDocs();
    const pending = docs.filter(
      (d) => d.status === 'PendingLevel1' || d.status === 'PendingLevel2',
    );
    const approved = docs.filter((d) => d.status === 'Approved');
    const rejected = docs.filter((d) => d.status === 'Rejected');
    const decided = approved.length + rejected.length;
    const showTotals = canViewFinancialTotals(this.session.user());
    const sum = (list: DocumentItem[]) => list.reduce((acc, d) => acc + d.totalAmount, 0);
    return {
      totalDocuments: docs.length,
      pendingApprovals: pending.length,
      approvedDocuments: approved.length,
      rejectedDocuments: rejected.length,
      anomalyCount: docs.filter((d) => d.aiAnomalyDetected).length,
      approvalRatePercentage:
        decided > 0 ? Math.round((approved.length / decided) * 1000) / 10 : 100,
      totalApprovedSpend: showTotals ? sum(approved) : 0,
      totalPendingSpend: showTotals ? sum(pending) : 0,
    };
  }

  async getAuditLogs(documentId?: string, search?: string): Promise<AuditLog[]> {
    if (!documentId && !canViewLedger(this.session.user())) {
      throw new ApiError(403, 'Your role may only view the audit history of a single document.');
    }
    let logs = this.readLogs();
    if (documentId) logs = logs.filter((l) => l.documentId === documentId);
    const q = search?.trim().toLowerCase();
    if (q) {
      logs = logs.filter((l) =>
        [l.documentNumber ?? '', l.action, l.actorName, l.details].some((v) =>
          v.toLowerCase().includes(q),
        ),
      );
    }
    return logs.sort((a, b) => (b.sequence ?? 0) - (a.sequence ?? 0)).slice(0, 100);
  }

  async verifyAudit(): Promise<IntegrityReport> {
    if (!canViewLedger(this.session.user()))
      throw new ApiError(403, 'Your role cannot verify the ledger.');
    const logs = this.readLogs().sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
    const base = { algorithm: 'SHA-256', verifiedAt: new Date().toISOString(), count: logs.length };
    if (logs.length === 0) {
      return {
        ...base,
        verified: true,
        status: 'EMPTY_LEDGER',
        message: 'The ledger is empty. Nothing to verify.',
      };
    }
    let expectedPrev = GENESIS_HASH;
    for (const [i, log] of logs.entries()) {
      if (log.previousHash !== expectedPrev) {
        return {
          ...base,
          verified: false,
          status: 'CHAIN_LINKAGE_BROKEN',
          message: `Chain linkage mismatch at record ${i + 1}.`,
        };
      }
      const computed = await computeRecordHash(log);
      if (computed !== log.recordHash) {
        return {
          ...base,
          verified: false,
          status: 'RECORD_CONTENT_TAMPERED',
          message: `Content of record ${i + 1} no longer matches its hash.`,
        };
      }
      expectedPrev = log.recordHash!;
    }
    return {
      ...base,
      verified: true,
      status: 'CRYPTOGRAPHICALLY_VERIFIED',
      genesisHash: GENESIS_HASH,
      latestHash: expectedPrev,
      message: `All ${logs.length} records link to each other from genesis to head.`,
    };
  }

  // ---- writes --------------------------------------------------------------------------------

  async uploadDocument(file: File): Promise<DocumentItem> {
    const user = this.session.user();
    if (!canSubmit(user)) throw new ApiError(403, 'Auditors have read-only access.');
    const problem = validateUpload(file);
    if (problem) throw new ApiError(415, problem);

    const docs = this.readDocs();
    const id = newId('doc');
    const subTotal = Math.floor(1000 + Math.random() * 8000);
    const taxAmount = round2(subTotal * 0.07);
    const doc = this.newDocument(docs, {
      id,
      prefix: file.name.toLowerCase().includes('po') ? 'PO' : 'INV',
      type: file.name.toLowerCase().includes('po') ? 'PurchaseOrder' : 'Invoice',
      fileName: file.name,
      fileSize: file.size,
      fileUrl: file.size <= MAX_STORED_FILE_BYTES ? await readAsDataUrl(file) : undefined,
      vendor: 'Enterprise Partner Corp',
      subTotal,
      taxRate: 7,
      taxAmount,
      currency: 'USD',
      summary: `Simulated extraction of ${file.name}. Totals and line items are consistent.`,
      anomalyNotes: undefined,
      confidence: 0.98,
    });
    docs.unshift(doc);
    await this.commit(docs, [
      this.entry(
        doc,
        'Uploaded',
        `Document ${doc.documentNumber} uploaded and queued for Level 1 review.`,
      ),
      this.entry(
        doc,
        'AiAnalyzed',
        'Simulated extraction completed. No anomalies detected.',
        undefined,
        undefined,
        SYSTEM_ACTOR,
      ),
    ]);
    return structuredClone(doc);
  }

  async createPreset(preset: PresetType): Promise<DocumentItem> {
    const user = this.session.user();
    if (!canSubmit(user)) throw new ApiError(403, 'Auditors have read-only access.');
    const docs = this.readDocs();
    const spec = PRESETS[preset];
    const doc = this.newDocument(docs, { id: newId('doc'), ...spec });
    docs.unshift(doc);
    await this.commit(docs, [
      this.entry(doc, 'Uploaded', `Sample document '${preset}' initialized.`),
      this.entry(
        doc,
        'AiAnalyzed',
        spec.anomalyNotes
          ? `ANOMALY FLAGGED: ${spec.anomalyNotes}`
          : 'Automated extraction completed without discrepancies.',
        undefined,
        undefined,
        SYSTEM_ACTOR,
      ),
    ]);
    return structuredClone(doc);
  }

  async updateDocument(id: string, edit: DocumentEdit): Promise<DocumentItem> {
    const user = this.session.user();
    const docs = this.readDocs();
    const doc = this.mustFind(docs, id);
    this.enforce(evaluateEdit(doc, user));
    this.checkVersion(doc, edit.version);
    for (const v of [edit.subTotal, edit.taxRate, edit.taxAmount, edit.totalAmount]) {
      if (v !== undefined && v < 0)
        throw new ApiError(400, 'Amounts and tax rate must not be negative.');
    }
    if (
      edit.documentNumber &&
      edit.documentNumber !== doc.documentNumber &&
      docs.some((d) => d.documentNumber === edit.documentNumber && d.id !== id)
    ) {
      throw new ApiError(409, `A document numbered '${edit.documentNumber}' already exists.`);
    }

    const changes: string[] = [];
    const set = <K extends keyof DocumentItem>(
      key: K,
      next: DocumentItem[K] | undefined,
      label: string,
    ) => {
      if (next !== undefined && next !== '' && next !== doc[key]) {
        changes.push(`${label}: ${String(doc[key])} -> ${String(next)}`);
        doc[key] = next;
      }
    };
    set('documentNumber', edit.documentNumber, 'Document number');
    set('vendorName', edit.vendorName, 'Vendor');
    set('taxId', edit.taxId, 'Tax ID');
    set('subTotal', edit.subTotal, 'Subtotal');
    set('taxRate', edit.taxRate, 'Tax rate');
    set('taxAmount', edit.taxAmount, 'Tax amount');
    set('totalAmount', edit.totalAmount, 'Total');

    if (doc.aiAnomalyDetected && Math.abs(taxMismatch(doc)) <= 0.05) {
      doc.aiAnomalyDetected = false;
      doc.aiAnomalyNotes =
        'Previously flagged tax anomaly was reviewed and reconciled by the submitter.';
      changes.push('Anomaly resolved by manual reconciliation');
    }
    this.touch(doc);
    await this.commit(docs, [
      this.entry(
        doc,
        'FieldEdited',
        `Manual correction: ${changes.join('; ') || 'no value changes'}. Reason: ${edit.editReason || 'Data accuracy'}`,
      ),
    ]);
    return structuredClone(doc);
  }

  async processAction(
    id: string,
    action: WorkflowAction,
    comment: string | undefined,
    version: number,
  ): Promise<DocumentItem> {
    const user = this.session.user();
    const docs = this.readDocs();
    const doc = this.mustFind(docs, id);
    if (user.role === 'Auditor') throw new ApiError(403, 'Auditors have read-only access.');
    if (isTerminal(doc))
      throw new ApiError(409, `This document is already ${doc.status.toLowerCase()}.`);
    this.checkVersion(doc, version);

    const previous = doc.status;
    let auditAction: string;
    let details: string;

    if (action === 'Resubmit') {
      this.enforce(evaluateResubmit(doc, user));
      doc.status = 'PendingLevel1';
      doc.currentApprovalLevel = 1;
      const step1 = doc.approvalSteps[0];
      Object.assign(step1, {
        status: 'Pending',
        comment: undefined,
        decidedAt: undefined,
        approverUserId: undefined,
        approverUserName: undefined,
      });
      auditAction = 'Resubmitted';
      details = `Corrections submitted by ${user.name}. Routed back to Level 1.`;
    } else {
      this.enforce(evaluateDecision(doc, user));
      const step = doc.approvalSteps.find((s) => s.stepNumber === doc.currentApprovalLevel)!;
      const decide = (status: ApprovalStep['status'], fallback: string) =>
        Object.assign(step, {
          status,
          approverUserId: user.id,
          approverUserName: user.name,
          comment: comment || fallback,
          decidedAt: nowIso(),
        });

      if (action === 'Approve') {
        decide('Approved', 'Approved without additional notes.');
        if (doc.currentApprovalLevel === 1) {
          doc.status = 'PendingLevel2';
          doc.currentApprovalLevel = 2;
          auditAction = 'ApprovedLevel1';
          details = `Level 1 approval granted by ${user.name}. Moved to the Finance queue. Notes: ${comment || 'None'}`;
        } else {
          doc.status = 'Approved';
          doc.currentApprovalLevel = 3;
          auditAction = 'ApprovedLevel2';
          details = `Final approval granted by ${user.name}. Authorized for disbursement. Notes: ${comment || 'None'}`;
        }
      } else if (action === 'Reject') {
        decide('Rejected', 'Document rejected.');
        doc.status = 'Rejected';
        auditAction = 'Rejected';
        details = `Rejected at level ${doc.currentApprovalLevel} by ${user.name}. Reason: ${comment || 'No reason provided'}`;
      } else {
        decide('RevisionRequested', 'Revision requested.');
        doc.status = 'RevisionRequested';
        auditAction = 'RevisionRequested';
        details = `Revision requested by ${user.name}. Instructions: ${comment || 'Please review and reconcile fields.'}`;
      }
    }

    this.touch(doc);
    await this.commit(docs, [this.entry(doc, auditAction, details, previous, doc.status)]);
    return structuredClone(doc);
  }

  async reanalyze(id: string): Promise<DocumentItem> {
    const user = this.session.user();
    const docs = this.readDocs();
    const doc = this.mustFind(docs, id);
    this.enforce(evaluateReanalyze(doc, user));
    const diff = taxMismatch(doc);
    const flagged = Math.abs(diff) > 0.05;
    const expected = round2(doc.subTotal * (doc.taxRate / 100));
    doc.aiAnomalyDetected = flagged;
    doc.aiAnomalyNotes = flagged
      ? `Tax discrepancy: stated ${doc.taxAmount.toFixed(2)}, expected ${expected.toFixed(2)} at ${doc.taxRate}%.`
      : undefined;
    doc.aiConfidenceScore = flagged ? 0.85 : 0.98;
    this.touch(doc);
    await this.commit(docs, [
      this.entry(
        doc,
        'ReAnalyzed',
        `Re-analysis completed: ${flagged ? 'FLAGGED' : 'CLEAN'}. Requested by ${user.name}.`,
        undefined,
        undefined,
        SYSTEM_ACTOR,
      ),
    ]);
    return structuredClone(doc);
  }

  // ---- internals -----------------------------------------------------------------------------

  private enforce(decision: Decision): void {
    if (!decision.allowed) throw new ApiError(403, decision.reason ?? 'Not allowed.');
  }

  private checkVersion(doc: DocumentItem, version: number | undefined): void {
    if (version !== undefined && version !== doc.version) {
      throw new ApiError(409, `${doc.documentNumber} was changed elsewhere. Reload and try again.`);
    }
  }

  private mustFind(docs: DocumentItem[], id: string): DocumentItem {
    const doc = docs.find((d) => d.id === id);
    if (!doc) throw new ApiError(404, `Document ${id} was not found.`);
    return doc;
  }

  private touch(doc: DocumentItem): void {
    doc.updatedAt = nowIso();
    doc.version += 1;
  }

  private entry(
    doc: DocumentItem,
    action: string,
    details: string,
    previousValue?: string,
    newValue?: string,
    actor: { id: string; name: string; role: string } = this.session.user(),
  ): PendingEntry {
    return { doc, action, details, previousValue, newValue, actor };
  }

  /** Persists documents and appends the audit entries; either both land or neither does. */
  private async commit(docs: DocumentItem[], entries: PendingEntry[]): Promise<void> {
    const logs = this.readLogs();
    let prev = logs.at(-1)?.recordHash ?? GENESIS_HASH;
    let seq = logs.at(-1)?.sequence ?? 0;
    for (const e of entries) {
      const log: AuditLog = {
        id: newId('log'),
        sequence: ++seq,
        documentId: e.doc.id,
        documentNumber: e.doc.documentNumber,
        action: e.action,
        actorId: e.actor.id,
        actorName: e.actor.name,
        actorRole: e.actor.role,
        details: e.details,
        previousValue: e.previousValue,
        newValue: e.newValue,
        timestamp: nowIso(),
        previousHash: prev,
      };
      log.recordHash = await computeRecordHash(log);
      prev = log.recordHash;
      logs.push(log);
    }
    const previousDocs = localStorage.getItem(DOCS_KEY);
    try {
      localStorage.setItem(DOCS_KEY, JSON.stringify(docs));
      localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
    } catch {
      this.restore(DOCS_KEY, previousDocs);
      throw new ApiError(
        507,
        'Browser storage is full. Remove some documents or clear site data and try again.',
      );
    }
  }

  private restore(key: string, value: string | null): void {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      // nothing more we can do
    }
  }

  private newDocument(docs: DocumentItem[], spec: NewDocSpec): DocumentItem {
    const user = this.session.user();
    let documentNumber: string;
    do {
      documentNumber = `${spec.prefix}-2025-${Math.floor(1000 + Math.random() * 9000)}`;
    } while (docs.some((d) => d.documentNumber === documentNumber));
    const now = nowIso();
    const lineItem: LineItem = {
      id: newId('item'),
      documentId: spec.id,
      description: `${spec.vendor} primary service unit`,
      quantity: 1,
      unitPrice: spec.subTotal,
      amount: spec.subTotal,
    };
    const steps: ApprovalStep[] = [
      {
        id: newId('step'),
        documentId: spec.id,
        stepNumber: 1,
        roleRequired: 'Manager',
        title: 'Department manager review',
        status: 'Pending',
      },
      {
        id: newId('step'),
        documentId: spec.id,
        stepNumber: 2,
        roleRequired: 'Finance',
        title: 'Finance controller approval',
        status: 'Pending',
      },
    ];
    return {
      id: spec.id,
      documentNumber,
      documentType: spec.type,
      originalFileName: spec.fileName,
      fileSizeBytes: spec.fileSize,
      fileUrl: spec.fileUrl,
      vendorName: spec.vendor,
      customerName: 'Enterprise Global Corp',
      taxId: `VAT-${Math.floor(1_000_000 + Math.random() * 9_000_000)}`,
      issueDate: now.slice(0, 10),
      dueDate: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
      subTotal: spec.subTotal,
      taxRate: spec.taxRate,
      taxAmount: spec.taxAmount,
      totalAmount: round2(spec.subTotal + spec.taxAmount),
      currency: spec.currency,
      status: 'PendingLevel1',
      currentApprovalLevel: 1,
      totalApprovalLevels: 2,
      aiSummary: spec.summary,
      aiAnomalyDetected: !!spec.anomalyNotes,
      aiAnomalyNotes: spec.anomalyNotes,
      aiConfidenceScore: spec.confidence,
      uploadedByUserId: user.id,
      uploadedByUserName: user.name,
      createdAt: now,
      updatedAt: now,
      version: 0,
      lineItems: [lineItem],
      approvalSteps: steps,
    };
  }

  private readDocs(): DocumentItem[] {
    return readJson<DocumentItem[]>(DOCS_KEY, []);
  }

  private readLogs(): AuditLog[] {
    return readJson<AuditLog[]>(LOGS_KEY, []);
  }
}

// ---- module helpers ------------------------------------------------------------------------

interface PendingEntry {
  doc: DocumentItem;
  action: string;
  details: string;
  previousValue?: string;
  newValue?: string;
  actor: { id: string; name: string; role: string };
}

interface NewDocSpec {
  id: string;
  prefix: string;
  type: DocumentType;
  fileName: string;
  fileSize: number;
  fileUrl?: string;
  vendor: string;
  subTotal: number;
  taxRate: number;
  taxAmount: number;
  currency: string;
  summary: string;
  anomalyNotes?: string;
  confidence: number;
}

const SYSTEM_ACTOR = { id: 'sys-gemini-ai', name: 'AI engine', role: 'AI Service' };

type PresetSpec = Omit<NewDocSpec, 'id'>;
const sample = (file: string) => `${BASE_URL}samples/${file}`;

const PRESETS: Record<PresetType, PresetSpec> = {
  'clean-invoice': {
    prefix: 'INV',
    type: 'Invoice',
    fileName: 'Sample_1_Invoice_Clean.pdf',
    fileSize: 3710,
    fileUrl: sample('Sample_1_Invoice_Clean.pdf'),
    vendor: 'Acme Cloud Services Corp.',
    subTotal: 5200,
    taxRate: 7,
    taxAmount: 364,
    currency: 'USD',
    summary:
      'Monthly SaaS cloud infrastructure bill with itemized compute clusters. Totals verified.',
    confidence: 0.99,
  },
  'tax-anomaly': {
    prefix: 'INV',
    type: 'Invoice',
    fileName: 'Sample_2_Invoice_Tax_Anomaly.pdf',
    fileSize: 3592,
    fileUrl: sample('Sample_2_Invoice_Tax_Anomaly.pdf'),
    vendor: 'Hyperion Networks LLC',
    subTotal: 10000,
    taxRate: 7,
    taxAmount: 1500,
    currency: 'USD',
    summary:
      'Tax is billed at 15% instead of the statutory 7%. Needs reconciliation before approval.',
    anomalyNotes:
      'Tax mismatch: 7% of 10,000.00 should be 700.00, but the document bills 1,500.00.',
    confidence: 0.89,
  },
  quotation: {
    prefix: 'QUO',
    type: 'Quotation',
    fileName: 'Sample_3_Quotation_GPU_Cluster.pdf',
    fileSize: 3430,
    fileUrl: sample('Sample_3_Quotation_GPU_Cluster.pdf'),
    vendor: 'Nexus AI Systems Inc.',
    subTotal: 7800,
    taxRate: 7,
    taxAmount: 546,
    currency: 'USD',
    summary: 'Quotation for dedicated GPU hardware clusters. Math verified.',
    confidence: 0.99,
  },
  'purchase-order': {
    prefix: 'PO',
    type: 'PurchaseOrder',
    fileName: 'Sample_3_Quotation_GPU_Cluster.pdf',
    fileSize: 3430,
    fileUrl: sample('Sample_3_Quotation_GPU_Cluster.pdf'),
    vendor: 'Starlight Furnishings Corp.',
    subTotal: 4000,
    taxRate: 7.1,
    taxAmount: 284,
    currency: 'EUR',
    summary: 'Procurement order for office ergonomic hardware. All line items verified.',
    confidence: 0.99,
  },
};

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString().slice(0, 19) + 'Z';
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function readAsDataUrl(file: File): Promise<string | undefined> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : undefined);
    reader.onerror = () => resolve(undefined);
    reader.readAsDataURL(file);
  });
}

/** Same field order as the backend `AuditService.ComputeRecordHash` (including the actor name). */
export async function computeRecordHash(log: AuditLog): Promise<string> {
  const raw = [
    log.previousHash ?? GENESIS_HASH,
    log.timestamp,
    log.documentId ?? '',
    log.documentNumber ?? '',
    log.action,
    log.actorId,
    log.actorName,
    log.actorRole,
    log.details,
    log.previousValue ?? '',
    log.newValue ?? '',
  ].join('|');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
