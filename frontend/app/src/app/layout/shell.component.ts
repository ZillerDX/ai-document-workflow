import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SessionService } from '../core/auth/session.service';
import { ThemeService } from '../core/theme.service';
import { canSubmit, canViewLedger } from '../core/workflow-rules';
import { IconComponent } from '../shared/ui/icon.component';
import { ToastService } from '../shared/ui/toast.service';
import { errorMessage } from '../core/api/document-api';

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css',
})
export class ShellComponent {
  protected readonly session = inject(SessionService);
  protected readonly theme = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly switching = signal(false);
  protected readonly showUpload = computed(() => canSubmit(this.session.user()));
  protected readonly showAudit = computed(() => canViewLedger(this.session.user()));
  protected readonly isHttp = this.session.mode === 'http';

  protected async changePersona(personaId: string): Promise<void> {
    this.switching.set(true);
    try {
      await this.session.switchTo(personaId);
      await this.router.navigateByUrl('/inbox');
    } catch (err) {
      this.toast.error(errorMessage(err));
    } finally {
      this.switching.set(false);
    }
  }
}
