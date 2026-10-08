import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { DocumentApi, errorMessage } from '../../core/api/document-api';
import { SessionService } from '../../core/auth/session.service';
import { IntegrityReport } from '../../core/models';
import { formatDateTime, shortHash } from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { ToastService } from '../../shared/ui/toast.service';

@Component({
  selector: 'app-audit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent],
  templateUrl: './audit.component.html',
  styleUrl: './audit.component.css',
})
export class AuditComponent {
  private readonly api = inject(DocumentApi);
  private readonly toast = inject(ToastService);
  private readonly session = inject(SessionService);

  protected readonly formatDateTime = formatDateTime;
  protected readonly shortHash = shortHash;
  protected readonly isHttp = this.session.mode === 'http';

  protected readonly search = signal('');
  protected readonly verifying = signal(false);
  protected readonly report = signal<IntegrityReport | null>(null);

  protected readonly logs = resource({
    params: () => ({ user: this.session.user().id, q: this.search() }),
    loader: ({ params }) => this.api.getAuditLogs(undefined, params.q),
  });
  protected readonly error = computed(() => {
    const err = this.logs.error();
    return err ? errorMessage(err) : null;
  });

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected async verify(): Promise<void> {
    this.verifying.set(true);
    try {
      this.report.set(await this.api.verifyAudit());
    } catch (err) {
      this.toast.error(errorMessage(err));
    } finally {
      this.verifying.set(false);
    }
  }
}
