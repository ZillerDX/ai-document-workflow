import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  resource,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiError, DocumentApi, errorMessage } from '../../core/api/document-api';
import { SessionService } from '../../core/auth/session.service';
import { DOCUMENT_TYPE_LABEL, DocumentEdit, DocumentItem, WorkflowAction } from '../../core/models';
import {
  Decision,
  evaluateDecision,
  evaluateEdit,
  evaluateReanalyze,
  evaluateResubmit,
  taxMismatch,
} from '../../core/workflow-rules';
import {
  formatBytes,
  formatDate,
  formatDateTime,
  formatMoney,
  shortHash,
} from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { StatusBadgeComponent } from '../../shared/ui/status-badge.component';
import { ToastService } from '../../shared/ui/toast.service';

const ACTION_LABEL: Record<string, string> = {
  Uploaded: 'Uploaded',
  AiAnalyzed: 'AI analysis',
  ReAnalyzed: 'AI re-analysis',
  FieldEdited: 'Fields corrected',
  ApprovedLevel1: 'Level 1 approved',
  ApprovedLevel2: 'Final approval',
  Rejected: 'Rejected',
  RevisionRequested: 'Revision requested',
  Resubmitted: 'Resubmitted',
};

type DraftKey =
  | 'documentNumber'
  | 'vendorName'
  | 'taxId'
  | 'subTotal'
  | 'taxRate'
  | 'taxAmount'
  | 'totalAmount'
  | 'editReason';

@Component({
  selector: 'app-document-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, StatusBadgeComponent],
  templateUrl: './document-detail.component.html',
  styleUrl: './document-detail.component.css',
})
export class DocumentDetailComponent {
  private readonly api = inject(DocumentApi);
  private readonly toast = inject(ToastService);
  protected readonly session = inject(SessionService);

  readonly id = input.required<string>();

  protected readonly typeLabels = DOCUMENT_TYPE_LABEL;
  protected readonly formatDate = formatDate;
  protected readonly formatDateTime = formatDateTime;
  protected readonly formatMoney = formatMoney;
  protected readonly formatBytes = formatBytes;
  protected readonly shortHash = shortHash;
  protected readonly actionLabel = (a: string) => ACTION_LABEL[a] ?? a;

  protected readonly doc = resource({
    params: () => ({ id: this.id(), user: this.session.user().id }),
    loader: ({ params }) => this.api.getDocument(params.id),
  });
  protected readonly logs = resource({
    params: () => ({ id: this.id(), user: this.session.user().id }),
    loader: ({ params }) => this.api.getAuditLogs(params.id),
  });

  protected readonly loadError = computed(() => {
    const err = this.doc.error();
    return err ? errorMessage(err) : null;
  });
  protected readonly notFound = computed(() => {
    const err = this.doc.error();
    return err instanceof ApiError && err.status === 404;
  });

  protected readonly comment = signal('');
  protected readonly busy = signal(false);
  protected readonly draft = signal<Record<DraftKey, string> | null>(null);

  protected readonly decision = computed(() =>
    this.rule((d) => evaluateDecision(d, this.session.user())),
  );
  protected readonly resubmit = computed(() =>
    this.rule((d) => evaluateResubmit(d, this.session.user())),
  );
  protected readonly edit = computed(() =>
    this.rule((d) => evaluateEdit(d, this.session.user())),
  );
  protected readonly reanalyzeRule = computed(() =>
    this.rule((d) => evaluateReanalyze(d, this.session.user())),
  );
  protected readonly mismatch = computed(() => {
    const d = this.doc.value();
    return d ? taxMismatch(d) : 0;
  });

  /** Why the user cannot act, shown instead of the action buttons. */
  protected readonly blockedReason = computed(() => {
    const d = this.doc.value();
    if (!d) return null;
    if (this.resubmit().allowed || this.decision().allowed) return null;
    if (d.status === 'PendingLevel1' && this.edit().allowed) {
      return 'Waiting for a manager. You can still correct the extracted fields until Level 1 is decided.';
    }
    if (d.status === 'RevisionRequested') return this.resubmit().reason ?? null;
    return this.decision().reason ?? null;
  });

  protected readonly commentValid = computed(() => this.comment().trim().length >= 3);

  private rule(fn: (d: DocumentItem) => Decision): Decision {
    const d = this.doc.value();
    return d ? fn(d) : { allowed: false };
  }

  protected async act(action: WorkflowAction): Promise<void> {
    const d = this.doc.value();
    if (!d || this.busy()) return;
    if ((action === 'Reject' || action === 'RequestRevision') && !this.commentValid()) {
      this.toast.error(
        'Please add a short comment (at least 3 characters) explaining your decision.',
      );
      return;
    }
    await this.run(async () => {
      const updated = await this.api.processAction(
        d.id,
        action,
        this.comment().trim() || undefined,
        d.version,
      );
      this.doc.set(updated);
      this.comment.set('');
      this.toast.success(this.successText(action));
    });
  }

  protected async reanalyzeDoc(): Promise<void> {
    const d = this.doc.value();
    if (!d) return;
    await this.run(async () => {
      this.doc.set(await this.api.reanalyze(d.id));
      this.toast.success('Re-analysis complete.');
    });
  }

  protected startEdit(): void {
    const d = this.doc.value();
    if (!d) return;
    this.draft.set({
      documentNumber: d.documentNumber,
      vendorName: d.vendorName,
      taxId: d.taxId ?? '',
      subTotal: String(d.subTotal),
      taxRate: String(d.taxRate),
      taxAmount: String(d.taxAmount),
      totalAmount: String(d.totalAmount),
      editReason: '',
    });
  }

  protected setDraft(key: DraftKey, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.draft.update((cur) => (cur ? { ...cur, [key]: value } : cur));
  }

  protected cancelEdit(): void {
    this.draft.set(null);
  }

  protected async saveEdit(): Promise<void> {
    const d = this.doc.value();
    const draft = this.draft();
    if (!d || !draft) return;
    const num = (v: string) => (v.trim() === '' ? undefined : Number(v));
    const payload: DocumentEdit = {
      documentNumber: draft.documentNumber.trim() || undefined,
      vendorName: draft.vendorName.trim() || undefined,
      taxId: draft.taxId.trim() || undefined,
      subTotal: num(draft.subTotal),
      taxRate: num(draft.taxRate),
      taxAmount: num(draft.taxAmount),
      totalAmount: num(draft.totalAmount),
      editReason: draft.editReason.trim() || undefined,
      version: d.version,
    };
    if (
      [payload.subTotal, payload.taxRate, payload.taxAmount, payload.totalAmount].some(
        (v) => v !== undefined && Number.isNaN(v),
      )
    ) {
      this.toast.error('Amounts must be valid numbers.');
      return;
    }
    await this.run(async () => {
      this.doc.set(await this.api.updateDocument(d.id, payload));
      this.draft.set(null);
      this.toast.success('Fields updated.');
    });
  }

  private async run(work: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    try {
      await work();
      this.logs.reload();
    } catch (err) {
      this.toast.error(errorMessage(err));
      if (err instanceof ApiError && err.status === 409) this.doc.reload();
    } finally {
      this.busy.set(false);
    }
  }

  private successText(action: WorkflowAction): string {
    switch (action) {
      case 'Approve':
        return 'Approved.';
      case 'Reject':
        return 'Document rejected.';
      case 'RequestRevision':
        return 'Sent back for revision.';
      case 'Resubmit':
        return 'Resubmitted for Level 1 review.';
    }
  }
}
