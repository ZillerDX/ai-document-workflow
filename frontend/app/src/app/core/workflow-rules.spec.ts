import { PERSONAS } from './auth/personas';
import { DocumentItem, Persona } from './models';
import {
  evaluateDecision,
  evaluateEdit,
  evaluateReanalyze,
  evaluateResubmit,
  needsMyAction,
  taxMismatch,
} from './workflow-rules';

const [staff, manager, finance, auditor] = PERSONAS as unknown as [
  Persona,
  Persona,
  Persona,
  Persona,
];

function doc(overrides: Partial<DocumentItem> = {}): DocumentItem {
  return {
    id: 'd1',
    documentNumber: 'INV-1',
    documentType: 'Invoice',
    originalFileName: 'a.pdf',
    fileSizeBytes: 1,
    vendorName: 'V',
    customerName: 'C',
    subTotal: 100,
    taxRate: 10,
    taxAmount: 10,
    totalAmount: 110,
    currency: 'USD',
    status: 'PendingLevel1',
    currentApprovalLevel: 1,
    totalApprovalLevels: 2,
    aiAnomalyDetected: false,
    aiConfidenceScore: 0.9,
    uploadedByUserId: staff.id,
    uploadedByUserName: staff.name,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    version: 0,
    lineItems: [],
    approvalSteps: [
      {
        id: 's1',
        documentId: 'd1',
        stepNumber: 1,
        roleRequired: 'Manager',
        title: 'L1',
        status: 'Pending',
      },
      {
        id: 's2',
        documentId: 'd1',
        stepNumber: 2,
        roleRequired: 'Finance',
        title: 'L2',
        status: 'Pending',
      },
    ],
    ...overrides,
  };
}

describe('workflow rules (mirror of the backend)', () => {
  it('only a manager can decide level 1', () => {
    expect(evaluateDecision(doc(), manager).allowed).toBe(true);
    expect(evaluateDecision(doc(), staff).allowed).toBe(false);
    expect(evaluateDecision(doc(), finance).allowed).toBe(false);
  });

  it('only finance can decide level 2', () => {
    const level2 = doc({ status: 'PendingLevel2', currentApprovalLevel: 2 });
    expect(evaluateDecision(level2, finance).allowed).toBe(true);
    expect(evaluateDecision(level2, manager).allowed).toBe(false);
  });

  it('auditors are read-only everywhere', () => {
    expect(evaluateDecision(doc(), auditor).allowed).toBe(false);
    expect(evaluateEdit(doc(), auditor).allowed).toBe(false);
    expect(evaluateReanalyze(doc(), auditor).allowed).toBe(false);
  });

  it('the submitter cannot decide their own document', () => {
    const own = doc({ uploadedByUserId: manager.id });
    const result = evaluateDecision(own, manager);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Segregation of duties');
  });

  it('the same person cannot decide both levels', () => {
    const level2 = doc({ status: 'PendingLevel2', currentApprovalLevel: 2 });
    level2.approvalSteps[0].approverUserId = finance.id;
    expect(evaluateDecision(level2, finance).allowed).toBe(false);
  });

  it('decided documents are locked', () => {
    for (const status of ['Approved', 'Rejected'] as const) {
      const d = doc({ status, currentApprovalLevel: 3 });
      expect(evaluateDecision(d, manager).allowed).toBe(false);
      expect(evaluateEdit(d, staff).allowed).toBe(false);
      expect(evaluateReanalyze(d, staff).allowed).toBe(false);
    }
  });

  it('fields are editable by staff only before level 1 is decided', () => {
    expect(evaluateEdit(doc(), staff).allowed).toBe(true);
    expect(evaluateEdit(doc({ status: 'RevisionRequested' }), staff).allowed).toBe(true);
    expect(
      evaluateEdit(doc({ status: 'PendingLevel2', currentApprovalLevel: 2 }), staff).allowed,
    ).toBe(false);
    expect(evaluateEdit(doc(), manager).allowed).toBe(false);
  });

  it('resubmit is for staff or the original submitter, only after a revision request', () => {
    const revision = doc({ status: 'RevisionRequested' });
    expect(evaluateResubmit(revision, staff).allowed).toBe(true);
    expect(evaluateResubmit(revision, finance).allowed).toBe(false);
    expect(evaluateResubmit(doc(), staff).allowed).toBe(false);
  });

  it('computes the inbox queue per role', () => {
    expect(needsMyAction(doc(), manager)).toBe(true);
    expect(needsMyAction(doc(), staff)).toBe(false);
    expect(needsMyAction(doc({ status: 'RevisionRequested' }), staff)).toBe(true);
    expect(needsMyAction(doc(), auditor)).toBe(false);
  });

  it('detects a tax mismatch', () => {
    expect(taxMismatch(doc())).toBe(0);
    expect(taxMismatch(doc({ taxAmount: 25 }))).toBe(15);
  });
});
