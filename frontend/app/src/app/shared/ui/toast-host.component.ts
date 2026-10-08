import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toasts" role="status" aria-live="polite">
      @for (t of toasts.toasts(); track t.id) {
        <div
          class="toast notice"
          [class.notice-ok]="t.kind === 'ok'"
          [class.notice-danger]="t.kind === 'danger'"
        >
          <span>{{ t.text }}</span>
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            (click)="toasts.dismiss(t.id)"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .toasts {
      position: fixed;
      right: 16px;
      bottom: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      z-index: 50;
      max-width: min(420px, calc(100vw - 32px));
    }
    .toast {
      justify-content: space-between;
      align-items: center;
      box-shadow: var(--shadow);
      border: 1px solid var(--border);
    }
  `,
})
export class ToastHostComponent {
  protected readonly toasts = inject(ToastService);
}
