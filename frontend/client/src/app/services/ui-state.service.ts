import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class UiStateService {
  isUploadModalOpen = signal(false);
  isAuditModalOpen = signal(false);

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
