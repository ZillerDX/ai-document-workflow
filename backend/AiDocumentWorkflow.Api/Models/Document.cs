using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace AiDocumentWorkflow.Api.Models
{
    public class Document
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string DocumentNumber { get; set; } = string.Empty;
        public string DocumentType { get; set; } = "Invoice"; // Invoice, Quotation, PurchaseOrder, Receipt
        public string OriginalFileName { get; set; } = string.Empty;
        public string? StoredFilePath { get; set; }
        public string? ContentType { get; set; }
        public long FileSizeBytes { get; set; }

        public string VendorName { get; set; } = string.Empty;
        public string CustomerName { get; set; } = string.Empty;
        public string? TaxId { get; set; }
        public DateTime? IssueDate { get; set; }
        public DateTime? DueDate { get; set; }

        public decimal SubTotal { get; set; }
        public decimal TaxRate { get; set; } = 7.0m;
        public decimal TaxAmount { get; set; }
        public decimal TotalAmount { get; set; }
        public string Currency { get; set; } = "USD";

        public string Status { get; set; } = "PendingLevel1"; // PendingLevel1, PendingLevel2, Approved, Rejected, RevisionRequested
        public int CurrentApprovalLevel { get; set; } = 1;
        public int TotalApprovalLevels { get; set; } = 2;

        public string? AiSummary { get; set; }
        public bool AiAnomalyDetected { get; set; }
        public string? AiAnomalyNotes { get; set; }
        public double AiConfidenceScore { get; set; } = 0.95;

        public string UploadedByUserId { get; set; } = "usr-staff-01";
        public string UploadedByUserName { get; set; } = "Alex Rivera (Staff)";
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public List<DocumentLineItem> LineItems { get; set; } = new();
        public List<ApprovalStep> ApprovalSteps { get; set; } = new();
        [JsonIgnore]
        public List<AuditLog> AuditLogs { get; set; } = new();
    }

    public class DocumentLineItem
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid DocumentId { get; set; }
        public string Description { get; set; } = string.Empty;
        public decimal Quantity { get; set; } = 1;
        public decimal UnitPrice { get; set; }
        public decimal Amount { get; set; }
    }

    public class ApprovalStep
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid DocumentId { get; set; }
        public int StepNumber { get; set; }
        public string RoleRequired { get; set; } = "Manager"; // Manager, Finance
        public string Title { get; set; } = string.Empty;
        public string Status { get; set; } = "Pending"; // Pending, Approved, Rejected, RevisionRequested
        public string? ApproverUserId { get; set; }
        public string? ApproverUserName { get; set; }
        public string? Comment { get; set; }
        public DateTime? DecidedAt { get; set; }
    }

    public class AuditLog
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public long Sequence { get; set; }
        public Guid? DocumentId { get; set; }
        public string? DocumentNumber { get; set; }
        public string Action { get; set; } = string.Empty; // Uploaded, AiAnalyzed, FieldEdited, ApprovedLevel1, ApprovedLevel2, Rejected, RevisionRequested
        public string ActorId { get; set; } = string.Empty;
        public string ActorName { get; set; } = string.Empty;
        public string ActorRole { get; set; } = string.Empty;
        public string Details { get; set; } = string.Empty;
        public string? PreviousValue { get; set; }
        public string? NewValue { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public string? PreviousHash { get; set; }
        public string? RecordHash { get; set; }
    }
}
