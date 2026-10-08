import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ShellComponent } from './layout/shell.component';
import { ToastHostComponent } from './shared/ui/toast-host.component';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ShellComponent, ToastHostComponent],
  template: `
    <app-shell />
    <app-toast-host />
  `,
})
export class App {}
