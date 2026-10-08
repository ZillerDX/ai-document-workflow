import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DocumentStatus, STATUS_LABEL } from '../../core/models';

const TONE: Record<DocumentStatus, string> = {
  PendingLevel1: 'badge-info',
  PendingLevel2: 'badge-info',
  Approved: 'badge-ok',
  Rejected: 'badge-danger',
  RevisionRequested: 'badge-warn',
};

@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge" [class]="tone()">{{ label() }}</span>`,
})
export class StatusBadgeComponent {
  readonly status = input.required<DocumentStatus>();
  protected readonly tone = computed(() => 'badge ' + TONE[this.status()]);
  protected readonly label = computed(() => STATUS_LABEL[this.status()]);
}
