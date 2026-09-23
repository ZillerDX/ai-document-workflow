import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class UiStateService {
  isUploadModalOpen = signal(false);
  isAuditModalOpen = signal(false);
  theme = signal<'light' | 'dark'>('light');

  constructor() {
    this.initTheme();
  }

  private initTheme() {
    try {
      const savedTheme = localStorage.getItem('aegisflow_theme') as 'light' | 'dark' | null;
      const initialTheme = savedTheme === 'dark' ? 'dark' : 'light';
      this.theme.set(initialTheme);
      this.applyTheme(initialTheme);
    } catch {
      this.applyTheme('light');
    }
  }

  toggleTheme() {
    const nextTheme = this.theme() === 'light' ? 'dark' : 'light';
    this.theme.set(nextTheme);
    this.applyTheme(nextTheme);
    try {
      localStorage.setItem('aegisflow_theme', nextTheme);
    } catch {
      // ignore storage errors
    }
  }

  private applyTheme(theme: 'light' | 'dark') {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }

  openUpload() {
    this.isUploadModalOpen.set(true);
  }

  closeUpload() {
    this.isUploadModalOpen.set(false);
  }

  openAudit() {
    this.isAuditModalOpen.set(true);
  }

  closeAudit() {
    this.isAuditModalOpen.set(false);
  }
}
