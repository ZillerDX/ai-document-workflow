import { Component, Input, Output, EventEmitter, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface SelectOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-custom-select',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="custom-select-container">
      <button 
        type="button" 
        class="select-trigger" 
        [class.is-open]="isOpen"
        (click)="toggleOpen()">
        <span class="selected-label">{{ selectedLabel }}</span>
        <svg class="chevron-icon" [class.rotated]="isOpen" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      @if (isOpen) {
        <div class="select-dropdown-menu">
          @for (option of options; track option.value) {
            <div 
              class="select-option-item" 
              [class.is-selected]="option.value === value"
              (click)="selectOption(option.value)">
              <span class="option-text">{{ option.label }}</span>
              @if (option.value === value) {
                <svg class="checkmark-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .custom-select-container {
      position: relative;
      display: inline-block;
      width: 100%;
      min-width: 140px;
    }

    .select-trigger {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      background-color: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      color: var(--text-primary);
      font-size: 0.875rem;
      text-align: left;
      transition: var(--spring-micro);
    }

    .select-trigger:hover {
      background-color: var(--bg-card-hover);
      border-color: var(--border-prominent);
    }

    .select-trigger.is-open {
      border-color: var(--border-active);
      box-shadow: 0 0 0 1px var(--border-active);
    }

    .selected-label {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .chevron-icon {
      flex-shrink: 0;
      color: var(--text-secondary);
      transition: transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    .chevron-icon.rotated {
      transform: rotate(180deg);
    }

    .select-dropdown-menu {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      z-index: 50;
      background-color: var(--bg-surface);
      border: 1px solid var(--border-prominent);
      border-radius: var(--radius-md);
      padding: 0.25rem;
      box-shadow: var(--shadow-xl);
      max-height: 240px;
      overflow-y: auto;
      backdrop-filter: blur(8px);
    }

    .select-option-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.5rem 0.65rem;
      border-radius: calc(var(--radius-md) - 2px);
      color: var(--text-secondary);
      font-size: 0.875rem;
      cursor: pointer;
      transition: var(--spring-micro);
    }

    .select-option-item:hover {
      background-color: var(--bg-card-hover);
      color: var(--text-primary);
    }

    .select-option-item.is-selected {
      background-color: var(--accent-primary-subtle);
      color: var(--accent-primary);
      font-weight: 500;
    }

    .checkmark-icon {
      color: var(--accent-primary);
      flex-shrink: 0;
    }
  `]
})
export class CustomSelectComponent {
  @Input() options: SelectOption[] = [];
  @Input() value: string = '';
  @Input() placeholder: string = 'Select...';
  @Output() valueChange = new EventEmitter<string>();

  isOpen = false;

  constructor(private elementRef: ElementRef) {}

  get selectedLabel(): string {
    const found = this.options.find(o => o.value === this.value);
    return found ? found.label : this.placeholder;
  }

  toggleOpen() {
    this.isOpen = !this.isOpen;
  }

  selectOption(val: string) {
    this.value = val;
    this.valueChange.emit(val);
    this.isOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isOpen = false;
    }
  }

  @HostListener('keydown.escape')
  onEscape() {
    this.isOpen = false;
  }
}
