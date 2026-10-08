import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { PERSONAS } from '../auth/personas';
import { SessionService } from '../auth/session.service';
import { Persona } from '../models';
import { BrowserDocumentApi } from './browser-document-api';
import { ApiError } from './document-api';

const [staff, manager, finance, auditor] = PERSONAS as unknown as [
  Persona,
  Persona,
  Persona,
  Persona,
];

describe('BrowserDocumentApi', () => {
  const current = signal<Persona>(staff);
  let api: BrowserDocumentApi;
  const as = (p: Persona) => current.set(p);

  beforeEach(() => {
    localStorage.clear();
    current.set(staff);
    TestBed.configureTestingModule({
      providers: [
        BrowserDocumentApi,
        { provide: SessionService, useValue: { user: current, mode: 'browser' } },
      ],
    });
    api = TestBed.inject(BrowserDocumentApi);
  });

  const reject = async (p: Promise<unknown>, status: number) => {
    const err = await p.then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(status);
  };

  it('walks a document through both approval levels', async () => {
    const doc = await api.createPreset('clean-invoice');
    expect(doc.status).toBe('PendingLevel1');

    as(manager);
    const l1 = await api.processAction(doc.id, 'Approve', 'ok', doc.version);
    expect(l1.status).toBe('PendingLevel2');
    expect(l1.approvalSteps[0].approverUserId).toBe(manager.id);

    as(finance);
    const l2 = await api.processAction(doc.id, 'Approve', undefined, l1.version);
    expect(l2.status).toBe('Approved');
  });

  it('blocks wrong roles, auditors and self-approval', async () => {
    const doc = await api.createPreset('clean-invoice');
    await reject(api.processAction(doc.id, 'Approve', undefined, doc.version), 403); // staff

    as(auditor);
    await reject(api.processAction(doc.id, 'Approve', undefined, doc.version), 403);
    await reject(api.createPreset('quotation'), 403);

    as(manager);
    const own = await api.createPreset('quotation'); // manager submits
    await reject(api.processAction(own.id, 'Approve', undefined, own.version), 403);
  });

  it('rejects a stale version with 409 and locks decided documents', async () => {
    const doc = await api.createPreset('clean-invoice');
    as(manager);
    await api.processAction(doc.id, 'Approve', undefined, doc.version);
    await reject(api.processAction(doc.id, 'Approve', undefined, doc.version), 409);

    as(finance);
    const current2 = await api.getDocument(doc.id);
    await api.processAction(doc.id, 'Reject', 'no budget', current2.version);
    await reject(api.processAction(doc.id, 'Approve', undefined, current2.version + 1), 409);
  });

  it('locks field edits once level 1 is decided and keeps omitted fields untouched', async () => {
    const doc = await api.createPreset('tax-anomaly');
    expect(doc.aiAnomalyDetected).toBe(true);

    const edited = await api.updateDocument(doc.id, { vendorName: 'Renamed Vendor' });
    expect(edited.vendorName).toBe('Renamed Vendor');
    expect(edited.totalAmount).toBe(doc.totalAmount);

    const fixed = await api.updateDocument(doc.id, { taxAmount: 700 });
    expect(fixed.aiAnomalyDetected).toBe(false);

    as(manager);
    await api.processAction(doc.id, 'Approve', undefined, fixed.version);
    as(staff);
    await reject(api.updateDocument(doc.id, { vendorName: 'Too late' }), 403);
  });

  it('supports the revision loop', async () => {
    const doc = await api.createPreset('clean-invoice');
    as(manager);
    const revised = await api.processAction(doc.id, 'RequestRevision', 'fix totals', doc.version);
    expect(revised.status).toBe('RevisionRequested');
    as(staff);
    const back = await api.processAction(doc.id, 'Resubmit', undefined, revised.version);
    expect(back.status).toBe('PendingLevel1');
    expect(back.approvalSteps[0].status).toBe('Pending');
  });

  it('keeps a valid hash chain and detects tampering, including the actor name', async () => {
    const doc = await api.createPreset('clean-invoice');
    as(manager);
    await api.processAction(doc.id, 'Approve', undefined, doc.version);

    expect((await api.verifyAudit()).verified).toBe(true);

    const logs = JSON.parse(localStorage.getItem('aegisflow_audit_logs_v2')!);
    logs[1].actorName = 'Mallory';
    localStorage.setItem('aegisflow_audit_logs_v2', JSON.stringify(logs));
    const report = await api.verifyAudit();
    expect(report.verified).toBe(false);
    expect(report.status).toBe('RECORD_CONTENT_TAMPERED');
  });

  it('only governance roles can read the full ledger; staff can read one document history', async () => {
    const doc = await api.createPreset('clean-invoice');
    await reject(api.getAuditLogs(), 403);
    expect((await api.getAuditLogs(doc.id)).length).toBeGreaterThan(0);
    as(auditor);
    expect((await api.getAuditLogs()).length).toBeGreaterThan(0);
  });

  it('hides aggregate spend from staff', async () => {
    const doc = await api.createPreset('clean-invoice');
    expect((await api.getStats()).totalPendingSpend).toBe(0);
    as(manager);
    expect((await api.getStats()).totalPendingSpend).toBe(doc.totalAmount);
  });

  it('rejects unsupported uploads', async () => {
    const exe = new File(['x'], 'evil.exe', { type: 'application/x-msdownload' });
    await reject(api.uploadDocument(exe), 415);
  });
});
