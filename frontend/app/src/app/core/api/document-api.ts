import {
  AuditLog,
  DashboardStats,
  DocumentEdit,
  DocumentFilter,
  DocumentItem,
  IntegrityReport,
  PresetType,
  WorkflowAction,
} from '../models';

/** Error with an HTTP-like status, produced by both API implementations so the UI handles one shape. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong. Please try again.';
}

/**
 * The single seam between the UI and the data source.
 * The acting user is NOT a parameter: the HTTP implementation sends a JWT and the server derives the
 * identity; the browser implementation reads the current persona from the session.
 */
export abstract class DocumentApi {
  abstract listDocuments(filter?: DocumentFilter): Promise<DocumentItem[]>;
  abstract getDocument(id: string): Promise<DocumentItem>;
  abstract uploadDocument(file: File): Promise<DocumentItem>;
  abstract createPreset(preset: PresetType): Promise<DocumentItem>;
  abstract updateDocument(id: string, edit: DocumentEdit): Promise<DocumentItem>;
  abstract processAction(
    id: string,
    action: WorkflowAction,
    comment: string | undefined,
    version: number,
  ): Promise<DocumentItem>;
  abstract reanalyze(id: string): Promise<DocumentItem>;
  abstract getAuditLogs(documentId?: string, search?: string): Promise<AuditLog[]>;
  abstract verifyAudit(): Promise<IntegrityReport>;
  abstract getStats(): Promise<DashboardStats>;
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_UPLOAD_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
export const ACCEPTED_UPLOAD_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg'];

export function validateUpload(file: File): string | null {
  const name = file.name.toLowerCase();
  const okExt = ACCEPTED_UPLOAD_EXTENSIONS.some((e) => name.endsWith(e));
  if (!okExt || !ACCEPTED_UPLOAD_TYPES.includes(file.type))
    return 'Only PDF, PNG and JPEG files are accepted.';
  if (file.size > MAX_UPLOAD_BYTES) return 'File is larger than 10 MB.';
  if (file.size === 0) return 'The file is empty.';
  return null;
}

export const PRESET_API_KEY: Record<PresetType, string> = {
  'clean-invoice': 'invoice',
  'tax-anomaly': 'discrepancy',
  quotation: 'quotation',
  'purchase-order': 'po',
};

