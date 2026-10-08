using System;
using System.Collections.Generic;
using System.Linq;

namespace AiDocumentWorkflow.Api.Models
{
    public class DocumentDto
    {
        public Guid Id { get; set; }
        public string DocumentNumber { get; set; } = string.Empty;
        public string DocumentType { get; set; } = string.Empty;
        public string OriginalFileName { get; set; } = string.Empty;
        public string? ContentType { get; set; }
        public long FileSizeBytes { get; set; }
        public string VendorName { get; set; } = string.Empty;
        public string CustomerName { get; set; } = string.Empty;
        public string? TaxId { get; set; }
        public DateTime? IssueDate { get; set; }
        public DateTime? DueDate { get; set; }
        public decimal SubTotal { get; set; }
        public decimal TaxRate { get; set; }
        public decimal TaxAmount { get; set; }
        public decimal TotalAmount { get; set; }
        public string Currency { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public int CurrentApprovalLevel { get; set; }
        public int TotalApprovalLevels { get; set; }
        public string? AiSummary { get; set; }
        public bool AiAnomalyDetected { get; set; }
        public string? AiAnomalyNotes { get; set; }
        public double AiConfidenceScore { get; set; }
        public string UploadedByUserId { get; set; } = string.Empty;
        public string UploadedByUserName { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public int Version { get; set; }
        public List<DocumentLineItem> LineItems { get; set; } = new();
        public List<ApprovalStep> ApprovalSteps { get; set; } = new();

        public static DocumentDto From(Document d) => new()
        {
            Id = d.Id, DocumentNumber = d.DocumentNumber, DocumentType = d.DocumentType,
            OriginalFileName = d.OriginalFileName, ContentType = d.ContentType, FileSizeBytes = d.FileSizeBytes,
            VendorName = d.VendorName, CustomerName = d.CustomerName, TaxId = d.TaxId,
            IssueDate = d.IssueDate, DueDate = d.DueDate,
            SubTotal = d.SubTotal, TaxRate = d.TaxRate, TaxAmount = d.TaxAmount, TotalAmount = d.TotalAmount,
            Currency = d.Currency, Status = d.Status,
            CurrentApprovalLevel = d.CurrentApprovalLevel, TotalApprovalLevels = d.TotalApprovalLevels,
            AiSummary = d.AiSummary, AiAnomalyDetected = d.AiAnomalyDetected, AiAnomalyNotes = d.AiAnomalyNotes,
            AiConfidenceScore = d.AiConfidenceScore,
            UploadedByUserId = d.UploadedByUserId, UploadedByUserName = d.UploadedByUserName,
            CreatedAt = d.CreatedAt, UpdatedAt = d.UpdatedAt, Version = d.Version,
            LineItems = d.LineItems.ToList(), ApprovalSteps = d.ApprovalSteps.OrderBy(s => s.StepNumber).ToList()
        };
    }

    public class UpdateDocumentDto
    {
        public string? DocumentNumber { get; set; }
        public string? DocumentType { get; set; }
        public string? VendorName { get; set; }
        public string? CustomerName { get; set; }
        public string? TaxId { get; set; }
        public DateTime? IssueDate { get; set; }
        public DateTime? DueDate { get; set; }
        public decimal? SubTotal { get; set; }
        public decimal? TaxRate { get; set; }
        public decimal? TaxAmount { get; set; }
        public decimal? TotalAmount { get; set; }
        public string? Currency { get; set; }
        public List<LineItemDto>? LineItems { get; set; }
        public string? EditReason { get; set; }
        public int? Version { get; set; }
    }

    public class LineItemDto
    {
        public Guid? Id { get; set; }
        public string Description { get; set; } = string.Empty;
        public decimal Quantity { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal Amount { get; set; }
    }

    public class WorkflowActionDto
    {
        public string Action { get; set; } = "Approve"; // Approve, Reject, RequestRevision, Resubmit
        public string? Comment { get; set; }
        public int? Version { get; set; }
    }

    public class DashboardStatsDto
    {
        public int TotalDocuments { get; set; }
        public int PendingApprovals { get; set; }
        public int ApprovedDocuments { get; set; }
        public int RejectedDocuments { get; set; }
        public int AnomalyCount { get; set; }
        public double ApprovalRatePercentage { get; set; }
        public decimal TotalApprovedSpend { get; set; }
        public decimal TotalPendingSpend { get; set; }
        public List<RecentActivityDto> RecentActivities { get; set; } = new();
    }

    public class RecentActivityDto
    {
        public Guid Id { get; set; }
        public string Action { get; set; } = string.Empty;
        public string ActorName { get; set; } = string.Empty;
        public string ActorRole { get; set; } = string.Empty;
        public string Details { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; }
        public string? DocumentNumber { get; set; }
    }

    public class GeminiExtractionResult
    {
        public string DocumentType { get; set; } = "Invoice";
        public string DocumentNumber { get; set; } = string.Empty;
        public string VendorName { get; set; } = string.Empty;
        public string CustomerName { get; set; } = string.Empty;
        public string? TaxId { get; set; }
        public DateTime? IssueDate { get; set; }
        public DateTime? DueDate { get; set; }
        public decimal SubTotal { get; set; }
        public decimal TaxRate { get; set; }
        public decimal TaxAmount { get; set; }
        public decimal TotalAmount { get; set; }
        public string Currency { get; set; } = "USD";
        public List<LineItemDto> LineItems { get; set; } = new();
        public string ExecutiveSummary { get; set; } = string.Empty;
        public bool AnomalyDetected { get; set; }
        public string? AnomalyNotes { get; set; }
        public double ConfidenceScore { get; set; } = 0.95;
    }
}
