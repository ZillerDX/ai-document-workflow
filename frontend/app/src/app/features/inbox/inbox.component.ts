import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DocumentApi, errorMessage } from '../../core/api/document-api';
import { SessionService } from '../../core/auth/session.service';
import { DOCUMENT_TYPE_LABEL, DocumentItem } from '../../core/models';
import { canSubmit, canViewFinancialTotals, needsMyAction } from '../../core/workflow-rules';
import { formatDate, formatMoney } from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { StatusBadgeComponent } from '../../shared/ui/status-badge.component';

type Tab = 'mine' | 'progress' | 'decided' | 'all';

const TABS: { id: Tab; label: string }[] = [
  { id: 'mine', label: 'Needs my action' },
  { id: 'progress', label: 'In progress' },
  { id: 'decided', label: 'Decided' },
  { id: 'all', label: 'All' },
];

@Component({
  selector: 'app-inbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent, StatusBadgeComponent],
  templateUrl: './inbox.component.html',
  styleUrl: './inbox.component.css',
})
export class InboxComponent {
  private readonly api = inject(DocumentApi);
  private readonly router = inject(Router);
  protected readonly session = inject(SessionService);

  protected readonly tabs = TABS;
  protected readonly typeLabels = DOCUMENT_TYPE_LABEL;
  protected readonly typeOptions = Object.entries(DOCUMENT_TYPE_LABEL);
  protected readonly formatDate = formatDate;
  protected readonly formatMoney = formatMoney;

  protected readonly tab = signal<Tab | null>(null);
  protected readonly search = signal('');
  protected readonly type = signal('all');

  protected readonly docs = resource({
    params: () => this.session.user().id,
    loader: () => this.api.listDocuments(),
  });
  protected readonly stats = resource({
    params: () => this.session.user().id,
    loader: () => this.api.getStats(),
  });

  protected readonly error = computed(() => {
    const err = this.docs.error() ?? this.stats.error();
    return err ? errorMessage(err) : null;
  });

  protected readonly canUpload = computed(() => canSubmit(this.session.user()));
  protected readonly showTotals = computed(() => canViewFinancialTotals(this.session.user()));

  private readonly all = computed(() => this.docs.value() ?? []);
  protected readonly mine = computed(() =>
    this.all().filter((d) => needsMyAction(d, this.session.user())),
  );

  /** Auditors never have actions, so their default view is everything. */
  protected readonly activeTab = computed<Tab>(
    () => this.tab() ?? (this.session.user().role === 'Auditor' ? 'all' : 'mine'),
  );

  protected readonly counts = computed<Record<Tab, number>>(() => {
    const all = this.all();
    return {
      mine: this.mine().length,
      progress: all.filter((d) => this.inProgress(d)).length,
      decided: all.filter((d) => d.status === 'Approved' || d.status === 'Rejected').length,
      all: all.length,
    };
  });

  protected readonly visible = computed(() => {
    const user = this.session.user();
    const q = this.search().trim().toLowerCase();
    const type = this.type();
    return this.all().filter((d) => {
      switch (this.activeTab()) {
        case 'mine':
          if (!needsMyAction(d, user)) return false;
          break;
        case 'progress':
          if (!this.inProgress(d)) return false;
          break;
        case 'decided':
          if (d.status !== 'Approved' && d.status !== 'Rejected') return false;
          break;
      }
      if (type !== 'all' && d.documentType !== type) return false;
      return (
        !q ||
        [d.documentNumber, d.vendorName, d.customerName].some((v) => v.toLowerCase().includes(q))
      );
    });
  });

  private inProgress(d: DocumentItem): boolean {
    return (
      d.status === 'PendingLevel1' ||
      d.status === 'PendingLevel2' ||
      d.status === 'RevisionRequested'
    );
  }

  protected open(doc: DocumentItem): void {
    void this.router.navigate(['/documents', doc.id]);
  }

  protected reload(): void {
    this.docs.reload();
    this.stats.reload();
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected onType(event: Event): void {
    this.type.set((event.target as HTMLSelectElement).value);
  }
}
