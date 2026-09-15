using System;
using System.Collections.Generic;

namespace AiDocumentWorkflow.Api.Models
{
    public class UpdateDocumentDto
    {
        public string? DocumentNumber { get; set; }
        public string? DocumentType { get; set; }
        public string? VendorName { get; set; }
        public string? CustomerName { get; set; }
        public string? TaxId { get; set; }
        public DateTime? IssueDate { get; set; }
        public DateTime? DueDate { get; set; }
        public decimal SubTotal { get; set; }
        public decimal TaxRate { get; set; }
        public decimal TaxAmount { get; set; }
        public decimal TotalAmount { get; set; }
        public string? Currency { get; set; }
        public List<LineItemDto>? LineItems { get; set; }
        public string? ActorId { get; set; }
        public string? ActorName { get; set; }
        public string? ActorRole { get; set; }
        public string? EditReason { get; set; }
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
        public string Action { get; set; } = "Approve"; // Approve, Reject, RequestRevision
        public string ActorId { get; set; } = string.Empty;
        public string ActorName { get; set; } = string.Empty;
        public string ActorRole { get; set; } = string.Empty; // Manager, Finance, Admin
        public string? Comment { get; set; }
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
