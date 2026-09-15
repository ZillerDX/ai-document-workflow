export interface DocumentLineItem {
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
  roleRequired: 'Manager' | 'Finance' | 'Executive';
  title: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'RevisionRequested';
  approverUserId?: string;
  approverUserName?: string;
  comment?: string;
  decidedAt?: string;
}

export interface AuditLog {
  id: string;
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

export interface AuditIntegrityReport {
  verified: boolean;
  count: number;
  genesisHash?: string;
  latestHash?: string;
  algorithm: string;
  status: string;
  verifiedAt: string;
  message?: string;
}

export interface DocumentItem {
  id: string;
  documentNumber: string;
  documentType: 'Invoice' | 'Quotation' | 'PurchaseOrder' | 'Receipt';
  originalFileName: string;
  storedFilePath?: string;
  contentType?: string;
  fileSizeBytes: number;
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
  status: 'PendingLevel1' | 'PendingLevel2' | 'Approved' | 'Rejected' | 'RevisionRequested';
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
  lineItems: DocumentLineItem[];
  approvalSteps: ApprovalStep[];
  auditLogs?: AuditLog[];
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
  recentActivities: RecentActivity[];
}

export interface RecentActivity {
  id: string;
  action: string;
  actorName: string;
  actorRole: string;
  details: string;
  timestamp: string;
  documentNumber?: string;
}

export interface RolePermissions {
  canUpload: boolean;
  canEditFields: boolean;
  canApproveLevel1: boolean;
  canApproveLevel2: boolean;
  canViewAuditLedger: boolean;
  canViewFinancialTotals: boolean;
}

export interface UserPersona {
  id: string;
  name: string;
  role: 'Staff' | 'Manager' | 'Finance' | 'Auditor';
  title: string;
  department: string;
  badgeLabel: string;
  description: string;
  permissions: RolePermissions;
}
