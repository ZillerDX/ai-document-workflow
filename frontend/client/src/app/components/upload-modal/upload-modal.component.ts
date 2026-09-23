import { Component, Output, EventEmitter, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DocumentService } from '../../services/document.service';
import { AuthPersonaService } from '../../services/auth-persona.service';
import { DocumentItem } from '../../models/document.model';

@Component({
  selector: 'app-upload-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-backdrop" (click)="onBackdropClick($event)">
      <div class="modal-dialog">
        <!-- Header -->
        <div class="modal-header">
          <div class="header-info">
            <h2 class="modal-title">Ingest Business Document</h2>
            <div class="modal-subtitle">Upload PDF, Invoice, Quotation, or select an instant enterprise preset</div>
          </div>

          <button type="button" class="close-btn" (click)="closed.emit()" title="Close (Esc)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="modal-body">
          @if (isProcessing) {
            <div class="processing-state">
              <div class="scanner-visual">
                <div class="scanner-document">
                  <div class="scanner-line"></div>
                  <div class="doc-mock-line w-3-4"></div>
                  <div class="doc-mock-line w-1-2"></div>
                  <div class="doc-mock-line w-full"></div>
                  <div class="doc-mock-line w-2-3"></div>
                </div>
              </div>

              <div class="processing-title">Gemini AI Engine Analyzing Document</div>
              <div class="processing-desc">
                {{ processingStepText }}
              </div>
              <div class="progress-bar-container">
                <div class="progress-bar-fill" [style.width.%]="progressPercentage"></div>
              </div>
            </div>
          } @else {
            <!-- File Dropzone -->
            <div 
              class="dropzone-area" 
              [class.drag-over]="isDragOver"
              (dragover)="onDragOver($event)"
              (dragleave)="isDragOver = false"
              (drop)="onFileDrop($event)"
              (click)="fileInput.click()">
              
              <input 
                #fileInput 
                type="file" 
                class="hidden-file-input" 
                accept=".pdf,.png,.jpg,.jpeg" 
                (change)="onFileSelected($event)" />

              <div class="dropzone-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
              </div>

              <div class="dropzone-title">Click to upload or drag & drop</div>
              <div class="dropzone-help">Supports PDF, PNG, JPG (Invoices, Quotations, POs up to 10MB)</div>
            </div>

            <!-- Instant Sample Presets -->
            <div class="presets-section">
              <div class="presets-header">
                <span class="presets-title">Or test instantly with 1-Click Business Presets:</span>
                <span class="presets-badge">Zero setup required</span>
              </div>

              <div class="presets-grid">
                <button type="button" class="preset-card" (click)="loadPreset('standard')">
                  <div class="preset-card-top">
                    <span class="preset-type-tag">Invoice</span>
                    <span class="preset-status-clean">Clean</span>
                  </div>
                  <div class="preset-name">Acme Cloud Services</div>
                  <div class="preset-desc">Standard SaaS cloud infrastructure bill with line items ($5,564.00)</div>
                </button>

                <button type="button" class="preset-card" (click)="loadPreset('quotation')">
                  <div class="preset-card-top">
                    <span class="preset-type-tag type-quo">Quotation</span>
                    <span class="preset-status-clean">Clean</span>
                  </div>
                  <div class="preset-name">Nexus AI Cluster Quote</div>
                  <div class="preset-desc">Enterprise quotation for dedicated GPU hardware ($8,346.00)</div>
                </button>

                <button type="button" class="preset-card anomaly-preset" (click)="loadPreset('discrepancy')">
                  <div class="preset-card-top">
                    <span class="preset-type-tag">Invoice</span>
                    <span class="preset-status-anomaly">Tax Anomaly</span>
                  </div>
                  <div class="preset-name">Hyperion Networks</div>
                  <div class="preset-desc">Features an irregular tax overcharge detected by Gemini ($17,500.00)</div>
                </button>

                <button type="button" class="preset-card" (click)="loadPreset('po')">
                  <div class="preset-card-top">
                    <span class="preset-type-tag type-po">Purchase Order</span>
                    <span class="preset-status-clean">Clean</span>
                  </div>
                  <div class="preset-name">Starlight Furnishings PO</div>
                  <div class="preset-desc">Corporate procurement PO for office ergonomic hardware (EUR 4,284.00)</div>
                </button>
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background-color: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(4px);
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }

    .modal-dialog {
      background-color: var(--bg-surface);
      border: 1px solid var(--border-prominent);
      border-radius: var(--radius-xl);
      width: 100%;
      max-width: 820px;
      display: flex;
      flex-direction: column;
      box-shadow: var(--shadow-xl);
      overflow: hidden;
      animation: modalEnter 250ms cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes modalEnter {
      from { opacity: 0; transform: scale(0.97); }
      to { opacity: 1; transform: scale(1); }
    }

    .modal-header {
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--border-subtle);
      display: flex;
      align-items: center;
      justify-content: space-between;
      background-color: var(--bg-card);
    }

    .modal-title {
      font-size: 1.125rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .modal-subtitle {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-top: 0.15rem;
    }

    .close-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 0.4rem;
      border-radius: var(--radius-md);
    }

    .close-btn:hover {
      background-color: var(--bg-subtle);
      color: var(--text-primary);
    }

    .modal-body {
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    /* Dashed Dropzone Strictly Reserved for Uploads */
    .dropzone-area {
      border: 2px dashed var(--border-prominent);
      border-radius: var(--radius-lg);
      padding: 2.5rem 1.5rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      cursor: pointer;
      background-color: var(--bg-card);
      transition: var(--spring-micro);
    }

    .dropzone-area:hover, .dropzone-area.drag-over {
      border-color: var(--accent-primary);
      background-color: var(--accent-primary-subtle);
    }

    .hidden-file-input {
      display: none;
    }

    .dropzone-icon {
      color: var(--accent-primary);
      margin-bottom: 0.25rem;
    }

    .dropzone-title {
      font-size: 0.9375rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    .dropzone-help {
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    /* Presets Grid */
    .presets-section {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .presets-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .presets-title {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .presets-badge {
      font-size: 0.6875rem;
      color: var(--accent-emerald);
      font-weight: 500;
    }

    .presets-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.875rem;
    }

    .preset-card {
      background-color: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 0.875rem 1rem;
      text-align: left;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      justify-content: flex-start;
      gap: 0.35rem;
      transition: var(--spring-micro);
      white-space: normal;
      width: 100%;
    }

    .preset-card:hover {
      border-color: var(--border-prominent);
      background-color: var(--bg-card-hover);
      transform: translateY(-1px);
    }

    .preset-card.anomaly-preset {
      border-color: rgba(239, 68, 68, 0.2);
    }

    .preset-card.anomaly-preset:hover {
      border-color: var(--accent-rose);
      background-color: var(--accent-rose-subtle);
    }

    .preset-card-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
    }

    .preset-type-tag {
      font-size: 0.625rem;
      font-weight: 600;
      text-transform: uppercase;
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
      background-color: var(--accent-primary-subtle);
      color: var(--accent-primary);
    }

    .preset-type-tag.type-quo {
      background-color: var(--accent-purple-subtle);
      color: var(--accent-purple);
    }

    .preset-type-tag.type-po {
      background-color: var(--accent-amber-subtle);
      color: var(--accent-amber);
    }

    .preset-status-clean {
      font-size: 0.625rem;
      font-weight: 600;
      color: var(--accent-emerald);
    }

    .preset-status-anomaly {
      font-size: 0.625rem;
      font-weight: 600;
      color: var(--accent-rose);
    }

    .preset-name {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--text-primary);
      white-space: normal;
      overflow-wrap: break-word;
    }

    .preset-desc {
      font-size: 0.75rem;
      color: var(--text-muted);
      line-height: 1.4;
      white-space: normal;
      word-break: normal;
      overflow-wrap: break-word;
    }

    /* Processing Scanner State */
    .processing-state {
      padding: 2.5rem 1rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      text-align: center;
    }

    .scanner-visual {
      position: relative;
      width: 80px;
      height: 100px;
      background-color: var(--bg-card);
      border: 1px solid var(--border-prominent);
      border-radius: var(--radius-md);
      padding: 0.75rem;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    .scanner-line {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, transparent, #3b82f6, transparent);
      box-shadow: 0 0 8px #3b82f6;
      animation: scanAnim 1.6s infinite ease-in-out alternate;
    }

    @keyframes scanAnim {
      0% { top: 4px; }
      100% { top: 94px; }
    }

    .doc-mock-line {
      height: 6px;
      background-color: var(--bg-subtle);
      border-radius: 3px;
      margin-bottom: 6px;
    }
    .w-3-4 { width: 75%; }
    .w-1-2 { width: 50%; }
    .w-full { width: 100%; }
    .w-2-3 { width: 66%; }

    .processing-title {
      font-size: 1rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .processing-desc {
      font-size: 0.8125rem;
      color: var(--text-secondary);
      max-width: 400px;
    }

    .progress-bar-container {
      width: 260px;
      height: 4px;
      background-color: var(--bg-subtle);
      border-radius: 2px;
      overflow: hidden;
      margin-top: 0.5rem;
    }

    .progress-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--accent-primary), var(--accent-purple));
      transition: width 300ms ease;
    }
  `]
})
export class UploadModalComponent {
  @Output() closed = new EventEmitter<void>();
  @Output() documentCreated = new EventEmitter<DocumentItem>();

  docService = inject(DocumentService);
  authService = inject(AuthPersonaService);
  currentPersona = this.authService.currentPersona;

  isDragOver = false;
  isProcessing = false;
  processingStepText = 'Initializing multimodal OCR scan...';
  progressPercentage = 15;

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = true;
  }

  onFileDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.handleFile(event.dataTransfer.files[0]);
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
    }
  }

  private handleFile(file: File) {
    this.isProcessing = true;
    this.processingStepText = `Extracting financial tables and parsing metadata from "${file.name}"...`;
    this.progressPercentage = 35;

    const p = this.currentPersona();

    setTimeout(() => {
      this.processingStepText = 'Executing Gemini Anomaly & Tax reconciliation model...';
      this.progressPercentage = 75;
    }, 600);

    this.docService.uploadDocument(file, p.id, p.name).subscribe({
      next: (doc) => {
        this.progressPercentage = 100;
        this.processingStepText = 'Document ingested and staged in workflow!';
        setTimeout(() => {
          this.isProcessing = false;
          this.documentCreated.emit(doc);
        }, 400);
      },
      error: (err) => {
        console.error('Upload failed', err);
        this.isProcessing = false;
        alert('Document upload failed. Check backend logs.');
      }
    });
  }

  loadPreset(presetType: string) {
    this.isProcessing = true;
    this.processingStepText = `Generating preset "${presetType}" with Gemini validation...`;
    this.progressPercentage = 40;

    const p = this.currentPersona();

    setTimeout(() => {
      this.processingStepText = 'Performing fraud & math checks...';
      this.progressPercentage = 80;
    }, 500);

    this.docService.createPreset(presetType, p.id, p.name).subscribe({
      next: (doc) => {
        this.progressPercentage = 100;
        this.processingStepText = 'Preset document ready!';
        setTimeout(() => {
          this.isProcessing = false;
          this.documentCreated.emit(doc);
        }, 350);
      },
      error: (err) => {
        console.error('Preset failed', err);
        this.isProcessing = false;
        alert('Failed to generate preset.');
      }
    });
  }

  onBackdropClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop') && !this.isProcessing) {
      this.closed.emit();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (!this.isProcessing) {
      this.closed.emit();
    }
  }
}
