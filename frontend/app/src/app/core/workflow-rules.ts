import { DocumentItem, Persona, Role } from './models';

/**
 * Pure workflow rules, mirrored from the backend (`DocumentWorkflowService`).
 * Browser mode enforces them for real; in HTTP mode the server is authoritative and the UI
 * uses the same functions only to decide which buttons to show.
 */

export interface Decision {
  allowed: boolean;
  reason?: string;
}

const ALLOW: Decision = { allowed: true };
const deny = (reason: string): Decision => ({ allowed: false, reason });

export const SUBMITTER_ROLES: readonly Role[] = ['Staff', 'Manager', 'Finance'];
export const LEDGER_ROLES: readonly Role[] = ['Manager', 'Finance', 'Auditor'];

export function isTerminal(doc: DocumentItem): boolean {
  return doc.status === 'Approved' || doc.status === 'Rejected';
}

export function canSubmit(user: Persona): boolean {
  return SUBMITTER_ROLES.includes(user.role);
}

export function canViewLedger(user: Persona): boolean {
  return LEDGER_ROLES.includes(user.role);
}

export function canViewFinancialTotals(user: Persona): boolean {
  return user.role !== 'Staff';
}

/** Approve / reject / request revision at the document's current level. */
export function evaluateDecision(doc: DocumentItem, user: Persona): Decision {
  if (user.role === 'Auditor') return deny('Auditors have read-only access.');
  if (isTerminal(doc)) return deny(`This document is already ${doc.status.toLowerCase()}.`);
  if (doc.status === 'RevisionRequested') return deny('Waiting for the submitter to resubmit.');

  const level = doc.currentApprovalLevel;
  const required: Role = level === 1 ? 'Manager' : 'Finance';
  if (user.role !== required) {
    return deny(
      `Level ${level} must be decided by ${required === 'Manager' ? 'a manager' : 'finance'}.`,
    );
  }
  if (user.id === doc.uploadedByUserId) {
    return deny('Segregation of duties: you submitted this document, so you cannot decide on it.');
  }
  if (level === 2) {
    const step1 = doc.approvalSteps.find((s) => s.stepNumber === 1);
    if (step1?.approverUserId === user.id) {
      return deny('Segregation of duties: you already decided Level 1 of this document.');
    }
  }
  return ALLOW;
}

/** Field corrections: Staff only, and only before Level 1 is decided or while a revision is requested. */
export function evaluateEdit(doc: DocumentItem, user: Persona): Decision {
  if (user.role !== 'Staff') return deny('Only Staff can correct extracted fields.');
  if (doc.status !== 'PendingLevel1' && doc.status !== 'RevisionRequested') {
    return deny('Fields are locked once Level 1 has been decided.');
  }
  return ALLOW;
}

export function evaluateResubmit(doc: DocumentItem, user: Persona): Decision {
  if (doc.status !== 'RevisionRequested')
    return deny('Only documents with a requested revision can be resubmitted.');
  const isSubmitter = user.id === doc.uploadedByUserId && SUBMITTER_ROLES.includes(user.role);
  if (user.role !== 'Staff' && !isSubmitter)
    return deny('Only the submitter or Staff can resubmit.');
  return ALLOW;
}

export function evaluateReanalyze(doc: DocumentItem, user: Persona): Decision {
  if (!canSubmit(user)) return deny('Auditors have read-only access.');
  if (isTerminal(doc)) return deny('Decided documents cannot be re-analyzed.');
  return ALLOW;
}

/** Does this document currently wait for this user to do something? Drives the inbox "My queue". */
export function needsMyAction(doc: DocumentItem, user: Persona): boolean {
  if (doc.status === 'RevisionRequested') return evaluateResubmit(doc, user).allowed;
  return evaluateDecision(doc, user).allowed;
}

export function taxMismatch(doc: Pick<DocumentItem, 'subTotal' | 'taxRate' | 'taxAmount'>): number {
  const expected = Math.round(doc.subTotal * (doc.taxRate / 100) * 100) / 100;
  return Math.round((doc.taxAmount - expected) * 100) / 100;
}
