using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using AiDocumentWorkflow.Api.Data;
using AiDocumentWorkflow.Api.Models;

namespace AiDocumentWorkflow.Api.Services
{
    public interface IDocumentWorkflowService
    {
        Task<Document> ProcessActionAsync(Guid documentId, WorkflowActionDto dto);
    }

    public class DocumentWorkflowService : IDocumentWorkflowService
    {
        private readonly AppDbContext _context;
        private readonly IAuditService _auditService;

        public DocumentWorkflowService(AppDbContext context, IAuditService auditService)
        {
            _context = context;
            _auditService = auditService;
        }

        public async Task<Document> ProcessActionAsync(Guid documentId, WorkflowActionDto dto)
        {
            var doc = await _context.Documents
                .Include(d => d.ApprovalSteps)
                .Include(d => d.LineItems)
                .FirstOrDefaultAsync(d => d.Id == documentId);

            if (doc == null)
            {
                throw new ArgumentException($"Document with ID {documentId} was not found.");
            }

            // 1. Auditor Guard: Auditor has strictly read-only privileges
            if (string.Equals(dto.ActorRole, "Auditor", StringComparison.OrdinalIgnoreCase))
            {
                throw new UnauthorizedAccessException("Auditor role has strictly read-only forensic access and is prohibited from executing workflow actions.");
            }

            // 2. Terminal State Guard
            if ((doc.Status == "Approved" || doc.Status == "Rejected") && !string.Equals(dto.Action, "reanalyze", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException($"Document {doc.DocumentNumber} has already reached terminal status '{doc.Status}' and cannot undergo further workflow transitions.");
            }

            var previousStatus = doc.Status;
            var actionLower = dto.Action.Trim().ToLowerInvariant();

            // 3. Resubmit Action
            if (actionLower == "resubmit")
            {
                if (doc.Status != "RevisionRequested")
                {
                    throw new InvalidOperationException($"Document {doc.DocumentNumber} is currently '{doc.Status}'. Only documents in 'RevisionRequested' status can be resubmitted.");
                }

                if (!string.Equals(dto.ActorRole, "Staff", StringComparison.OrdinalIgnoreCase) &&
                    !string.Equals(dto.ActorRole, "Manager", StringComparison.OrdinalIgnoreCase) &&
                    !string.Equals(dto.ActorRole, "Admin", StringComparison.OrdinalIgnoreCase))
                {
                    throw new UnauthorizedAccessException($"Role '{dto.ActorRole}' is not permitted to resubmit documents for review.");
                }

                doc.Status = "PendingLevel1";
                doc.CurrentApprovalLevel = 1;
                doc.UpdatedAt = DateTime.UtcNow;

                var step1 = doc.ApprovalSteps.FirstOrDefault(s => s.StepNumber == 1);
                if (step1 != null)
                {
                    step1.Status = "Pending";
                    step1.Comment = null;
                    step1.DecidedAt = null;
                    step1.ApproverUserId = null;
                    step1.ApproverUserName = null;
                }

                await _auditService.LogAsync(
                    doc.Id,
                    doc.DocumentNumber,
                    "Resubmitted",
                    dto.ActorId,
                    dto.ActorName,
                    dto.ActorRole,
                    $"Field corrections submitted by {dto.ActorName}. Document routed back to Level 1 Manager review queue.",
                    previousStatus,
                    doc.Status
                );

                await _context.SaveChangesAsync();
                return doc;
            }

            // 4. Role Authorization for Tiered Approvals
            if (doc.CurrentApprovalLevel == 1)
            {
                if (!string.Equals(dto.ActorRole, "Manager", StringComparison.OrdinalIgnoreCase) &&
                    !string.Equals(dto.ActorRole, "Admin", StringComparison.OrdinalIgnoreCase))
                {
                    throw new UnauthorizedAccessException($"Role '{dto.ActorRole}' is not authorized to decide Level 1 Operational reviews. Required role: Manager.");
                }
            }
            else if (doc.CurrentApprovalLevel == 2)
            {
                if (!string.Equals(dto.ActorRole, "Finance", StringComparison.OrdinalIgnoreCase) &&
                    !string.Equals(dto.ActorRole, "Admin", StringComparison.OrdinalIgnoreCase))
                {
                    throw new UnauthorizedAccessException($"Role '{dto.ActorRole}' is not authorized to grant Level 2 Financial disbursement authorizations. Required role: Finance.");
                }
            }

            var currentStep = doc.ApprovalSteps
                .OrderBy(s => s.StepNumber)
                .FirstOrDefault(s => s.StepNumber == doc.CurrentApprovalLevel);

            switch (actionLower)
            {
                case "approve":
                    if (currentStep != null)
                    {
                        currentStep.Status = "Approved";
                        currentStep.ApproverUserId = dto.ActorId;
                        currentStep.ApproverUserName = dto.ActorName;
                        currentStep.Comment = dto.Comment ?? "Approved without additional notes.";
                        currentStep.DecidedAt = DateTime.UtcNow;
                    }

                    if (doc.CurrentApprovalLevel == 1)
                    {
                        doc.Status = "PendingLevel2";
                        doc.CurrentApprovalLevel = 2;
                        doc.UpdatedAt = DateTime.UtcNow;

                        await _auditService.LogAsync(
                            doc.Id,
                            doc.DocumentNumber,
                            "ApprovedLevel1",
                            dto.ActorId,
                            dto.ActorName,
                            dto.ActorRole,
                            $"Level 1 Operational Approval granted by {dto.ActorName}. Transferred to Finance Controller queue. Notes: {dto.Comment ?? "None"}",
                            previousStatus,
                            doc.Status
                        );
                    }
                    else if (doc.CurrentApprovalLevel == 2)
                    {
                        doc.Status = "Approved";
                        doc.CurrentApprovalLevel = 3; // Fully finalized
                        doc.UpdatedAt = DateTime.UtcNow;

                        await _auditService.LogAsync(
                            doc.Id,
                            doc.DocumentNumber,
                            "ApprovedLevel2",
                            dto.ActorId,
                            dto.ActorName,
                            dto.ActorRole,
                            $"Final Level 2 Financial Approval granted by {dto.ActorName}. Document authorized for disbursement. Notes: {dto.Comment ?? "None"}",
                            previousStatus,
                            doc.Status
                        );
                    }
                    break;

                case "reject":
                    if (currentStep != null)
                    {
                        currentStep.Status = "Rejected";
                        currentStep.ApproverUserId = dto.ActorId;
                        currentStep.ApproverUserName = dto.ActorName;
                        currentStep.Comment = dto.Comment ?? "Document rejected.";
                        currentStep.DecidedAt = DateTime.UtcNow;
                    }

                    doc.Status = "Rejected";
                    doc.UpdatedAt = DateTime.UtcNow;

                    await _auditService.LogAsync(
                        doc.Id,
                        doc.DocumentNumber,
                        "Rejected",
                        dto.ActorId,
                        dto.ActorName,
                        dto.ActorRole,
                        $"Document rejected at Step {doc.CurrentApprovalLevel} by {dto.ActorName}. Reason: {dto.Comment ?? "No reason provided"}",
                        previousStatus,
                        doc.Status
                    );
                    break;

                case "requestrevision":
                case "revision":
                    if (currentStep != null)
                    {
                        currentStep.Status = "RevisionRequested";
                        currentStep.ApproverUserId = dto.ActorId;
                        currentStep.ApproverUserName = dto.ActorName;
                        currentStep.Comment = dto.Comment ?? "Revision requested.";
                        currentStep.DecidedAt = DateTime.UtcNow;
                    }

                    doc.Status = "RevisionRequested";
                    doc.UpdatedAt = DateTime.UtcNow;

                    await _auditService.LogAsync(
                        doc.Id,
                        doc.DocumentNumber,
                        "RevisionRequested",
                        dto.ActorId,
                        dto.ActorName,
                        dto.ActorRole,
                        $"Revision requested by {dto.ActorName}. Instructions for submitter: {dto.Comment ?? "Please review and reconcile fields."}",
                        previousStatus,
                        doc.Status
                    );
                    break;

                default:
                    throw new ArgumentException($"Unsupported workflow action: '{dto.Action}'. Supported actions: Approve, Reject, RequestRevision, Resubmit.");
            }

            await _context.SaveChangesAsync();
            return doc;
        }
    }
}
