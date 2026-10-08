export type Role = 'Staff' | 'Manager' | 'Finance' | 'Auditor';
export type DocumentType = 'Invoice' | 'Quotation' | 'PurchaseOrder' | 'Receipt';
export type DocumentStatus =
  'PendingLevel1' | 'PendingLevel2' | 'Approved' | 'Rejected' | 'RevisionRequested';
export type StepStatus = 'Pending' | 'Approved' | 'Rejected' | 'RevisionRequested';
export type WorkflowAction = 'Approve' | 'Reject' | 'RequestRevision' | 'Resubmit';
export type PresetType = 'clean-invoice' | 'tax-anomaly' | 'quotation' | 'purchase-order';

export interface LineItem {
  id: string;
  documentId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface ApprovalStep {
  id: string;
  documentId: string;
  stepNumber: number;
  roleRequired: string;
  title: string;
  status: StepStatus;
  approverUserId?: string;
  approverUserName?: string;
  comment?: string;
  decidedAt?: string;
}

export interface DocumentItem {
  id: string;
  documentNumber: string;
  documentType: DocumentType;
  originalFileName: string;
  contentType?: string;
  fileSizeBytes: number;
  /** Browser mode only: bundled sample PDF or a locally stored copy of the upload. */
  fileUrl?: string;
  vendorName: string;
  customerName: string;
  taxId?: string;
  issueDate?: string;
  dueDate?: string;
  subTotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  status: DocumentStatus;
  currentApprovalLevel: number;
  totalApprovalLevels: number;
  aiSummary?: string;
  aiAnomalyDetected: boolean;
  aiAnomalyNotes?: string;
  aiConfidenceScore: number;
  uploadedByUserId: string;
  uploadedByUserName: string;
  createdAt: string;
  updatedAt: string;
  /** Optimistic-concurrency token; echoed back on writes. */
  version: number;
  lineItems: LineItem[];
  approvalSteps: ApprovalStep[];
}

export interface AuditLog {
  id: string;
  sequence?: number;
  documentId?: string;
  documentNumber?: string;
  action: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  details: string;
  previousValue?: string;
  newValue?: string;
  timestamp: string;
  previousHash?: string;
  recordHash?: string;
}

export interface IntegrityReport {
  verified: boolean;
  count: number;
  status: string;
  message?: string;
  genesisHash?: string;
  latestHash?: string;
  algorithm?: string;
  verifiedAt?: string;
}

export interface DashboardStats {
  totalDocuments: number;
  pendingApprovals: number;
  approvedDocuments: number;
  rejectedDocuments: number;
  anomalyCount: number;
  approvalRatePercentage: number;
  totalApprovedSpend: number;
  totalPendingSpend: number;
}

export interface DocumentFilter {
  status?: string;
  type?: string;
  search?: string;
}

export interface DocumentEdit {
  documentNumber?: string;
  vendorName?: string;
  taxId?: string;
  subTotal?: number;
  taxRate?: number;
  taxAmount?: number;
  totalAmount?: number;
  editReason?: string;
  version?: number;
}

export interface Persona {
  id: string;
  name: string;
  role: Role;
  title: string;
  blurb: string;
}

export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  Invoice: 'Invoice',
  Quotation: 'Quotation',
  PurchaseOrder: 'Purchase order',
  Receipt: 'Receipt',
};

export const STATUS_LABEL: Record<DocumentStatus, string> = {
  PendingLevel1: 'Awaiting manager',
  PendingLevel2: 'Awaiting finance',
  Approved: 'Approved',
  Rejected: 'Rejected',
  RevisionRequested: 'Revision requested',
};
