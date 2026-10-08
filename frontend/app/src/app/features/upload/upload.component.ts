import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  ACCEPTED_UPLOAD_EXTENSIONS,
  DocumentApi,
  errorMessage,
  validateUpload,
} from '../../core/api/document-api';
import { DocumentItem, PresetType } from '../../core/models';
import { formatBytes } from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { ToastService } from '../../shared/ui/toast.service';

interface Sample {
  id: PresetType;
  title: string;
  blurb: string;
  flagged?: boolean;
}

@Component({
  selector: 'app-upload',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  templateUrl: './upload.component.html',
  styleUrl: './upload.component.css',
})
export class UploadComponent {
  private readonly api = inject(DocumentApi);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly accept = ACCEPTED_UPLOAD_EXTENSIONS.join(',');
  protected readonly formatBytes = formatBytes;
  protected readonly samples: Sample[] = [
    {
      id: 'clean-invoice',
      title: 'Clean invoice',
      blurb: 'Totals and tax add up. Goes straight to review.',
    },
    {
      id: 'tax-anomaly',
      title: 'Invoice with a tax error',
      blurb: 'Billed 15% tax instead of 7%. The AI flags it.',
      flagged: true,
    },
    {
      id: 'quotation',
      title: 'GPU cluster quotation',
      blurb: 'A larger quotation with clean math.',
    },
    {
      id: 'purchase-order',
      title: 'Purchase order (EUR)',
      blurb: 'A euro-denominated procurement order.',
    },
  ];

  protected readonly file = signal<File | null>(null);
  protected readonly problem = signal<string | null>(null);
  protected readonly dragging = signal(false);
  protected readonly busy = signal<string | null>(null);

  protected onPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.choose(input.files?.[0] ?? null);
    input.value = '';
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    this.choose(event.dataTransfer?.files?.[0] ?? null);
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  protected clear(): void {
    this.file.set(null);
    this.problem.set(null);
  }

  protected async submit(): Promise<void> {
    const file = this.file();
    if (!file || this.busy()) return;
    await this.run('upload', () => this.api.uploadDocument(file));
  }

  protected async useSample(sample: Sample): Promise<void> {
    if (this.busy()) return;
    await this.run(sample.id, () => this.api.createPreset(sample.id));
  }

  private choose(file: File | null): void {
    if (!file) return;
    const problem = validateUpload(file);
    this.problem.set(problem);
    this.file.set(problem ? null : file);
  }

  private async run(key: string, work: () => Promise<DocumentItem>): Promise<void> {
    this.busy.set(key);
    try {
      const doc = await work();
      this.toast.success(`${doc.documentNumber} created and sent for Level 1 review.`);
      await this.router.navigate(['/documents', doc.id]);
    } catch (err) {
      this.toast.error(errorMessage(err));
    } finally {
      this.busy.set(null);
    }
  }
}
