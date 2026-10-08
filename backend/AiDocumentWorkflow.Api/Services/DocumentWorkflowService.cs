using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using AiDocumentWorkflow.Api.Auth;
using AiDocumentWorkflow.Api.Data;
using AiDocumentWorkflow.Api.Models;

namespace AiDocumentWorkflow.Api.Services
{
    public interface IDocumentWorkflowService
    {
        Task<Document> ProcessActionAsync(Guid documentId, WorkflowActionDto dto, ActorContext actor);
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

        public async Task<Document> ProcessActionAsync(Guid documentId, WorkflowActionDto dto, ActorContext actor)
        {
            var doc = await _context.Documents
                .Include(d => d.ApprovalSteps)
                .Include(d => d.LineItems)
                .FirstOrDefaultAsync(d => d.Id == documentId)
                ?? throw new KeyNotFoundException($"Document with ID {documentId} was not found.");

            if (actor.Role == Roles.Auditor)
            {
                throw new UnauthorizedAccessException("Auditor role has strictly read-only forensic access and is prohibited from executing workflow actions.");
            }

            if (DocStatus.IsTerminal(doc.Status))
            {
                throw new InvalidOperationException($"Document {doc.DocumentNumber} has already reached terminal status '{doc.Status}' and cannot undergo further workflow transitions.");
            }

            if (dto.Version.HasValue && dto.Version.Value != doc.Version)
            {
                throw new ConflictException($"Document {doc.DocumentNumber} was changed by someone else. Reload and try again.");
            }

            var previousStatus = doc.Status;
            var action = (dto.Action ?? string.Empty).Trim().ToLowerInvariant();
            string auditAction;
            string auditDetails;

            if (action == "resubmit")
            {
                Resubmit(doc, actor);
                auditAction = "Resubmitted";
                auditDetails = $"Field corrections submitted by {actor.Name}. Document routed back to Level 1 Manager review queue.";
            }
            else
            {
                var step = AuthorizeDecision(doc, actor);
                switch (action)
                {
                    case "approve":
                        Decide(step, "Approved", actor, dto.Comment ?? "Approved without additional notes.");
                        if (doc.CurrentApprovalLevel == 1)
                        {
                            doc.Status = DocStatus.PendingLevel2;
                            doc.CurrentApprovalLevel = 2;
                            auditAction = "ApprovedLevel1";
                            auditDetails = $"Level 1 Operational Approval granted by {actor.Name}. Transferred to Finance Controller queue. Notes: {dto.Comment ?? "None"}";
                        }
                        else
                        {
                            doc.Status = DocStatus.Approved;
                            doc.CurrentApprovalLevel = 3;
                            auditAction = "ApprovedLevel2";
                            auditDetails = $"Final Level 2 Financial Approval granted by {actor.Name}. Document authorized for disbursement. Notes: {dto.Comment ?? "None"}";
                        }
                        break;

                    case "reject":
                        Decide(step, "Rejected", actor, dto.Comment ?? "Document rejected.");
                        auditAction = "Rejected";
                        auditDetails = $"Document rejected at Step {doc.CurrentApprovalLevel} by {actor.Name}. Reason: {dto.Comment ?? "No reason provided"}";
                        doc.Status = DocStatus.Rejected;
                        break;

                    case "requestrevision":
                    case "revision":
                        Decide(step, "RevisionRequested", actor, dto.Comment ?? "Revision requested.");
                        auditAction = "RevisionRequested";
                        auditDetails = $"Revision requested by {actor.Name}. Instructions for submitter: {dto.Comment ?? "Please review and reconcile fields."}";
                        doc.Status = DocStatus.RevisionRequested;
                        break;

                    default:
                        throw new ArgumentException($"Unsupported workflow action: '{dto.Action}'. Supported actions: Approve, Reject, RequestRevision, Resubmit.");
                }
            }

            doc.UpdatedAt = DateTime.UtcNow;
            await _auditService.StageAsync(doc.Id, doc.DocumentNumber, auditAction, actor.Id, actor.Name, actor.Role, auditDetails, previousStatus, doc.Status);
            await SaveAtomicAsync(_context);
            return doc;
        }

        public static async Task SaveAtomicAsync(AppDbContext context)
        {
            try
            {
                await context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException ex)
            {
                throw new ConflictException("The document was changed concurrently. Reload and try again.", ex);
            }
            catch (DbUpdateException ex)
            {
                throw new ConflictException("A concurrent write collided on the audit chain. Please retry.", ex);
            }
        }

        private static void Resubmit(Document doc, ActorContext actor)
        {
            if (doc.Status != DocStatus.RevisionRequested)
            {
                throw new InvalidOperationException($"Document {doc.DocumentNumber} is currently '{doc.Status}'. Only documents in 'RevisionRequested' status can be resubmitted.");
            }

            var isSubmitter = actor.Id == doc.UploadedByUserId && Roles.Submitters.Split(',').Contains(actor.Role);
            if (actor.Role != Roles.Staff && !isSubmitter)
            {
                throw new UnauthorizedAccessException($"Role '{actor.Role}' is not permitted to resubmit documents for review.");
            }

            doc.Status = DocStatus.PendingLevel1;
            doc.CurrentApprovalLevel = 1;

            var step1 = doc.ApprovalSteps.FirstOrDefault(s => s.StepNumber == 1);
            if (step1 != null)
            {
                step1.Status = "Pending";
                step1.Comment = null;
                step1.DecidedAt = null;
                step1.ApproverUserId = null;
                step1.ApproverUserName = null;
            }
        }

        /// <summary>Role gate + Segregation of Duties. Returns the approval step the actor is deciding.</summary>
        private static ApprovalStep AuthorizeDecision(Document doc, ActorContext actor)
        {
            var level = doc.CurrentApprovalLevel;
            if (level != 1 && level != 2)
            {
                throw new InvalidOperationException($"Document {doc.DocumentNumber} is not awaiting an approval decision.");
            }

            var requiredRole = level == 1 ? Roles.Manager : Roles.Finance;
            if (actor.Role != requiredRole)
            {
                var what = level == 1 ? "Level 1 Operational reviews" : "Level 2 Financial disbursement authorizations";
                throw new UnauthorizedAccessException($"Role '{actor.Role}' is not authorized to decide {what}. Required role: {requiredRole}.");
            }

            if (actor.Id == doc.UploadedByUserId)
            {
                throw new UnauthorizedAccessException("Segregation of Duties: the submitter of a document cannot decide on it.");
            }

            var step = doc.ApprovalSteps.FirstOrDefault(s => s.StepNumber == level)
                       ?? throw new InvalidOperationException($"Approval step {level} is missing for document {doc.DocumentNumber}.");

            if (level == 2)
            {
                var step1 = doc.ApprovalSteps.FirstOrDefault(s => s.StepNumber == 1);
                if (step1?.ApproverUserId == actor.Id)
                {
                    throw new UnauthorizedAccessException("Segregation of Duties: the same person cannot decide both approval levels.");
                }
            }

            return step;
        }

        private static void Decide(ApprovalStep step, string status, ActorContext actor, string comment)
        {
            step.Status = status;
            step.ApproverUserId = actor.Id;
            step.ApproverUserName = actor.Name;
            step.Comment = comment;
            step.DecidedAt = DateTime.UtcNow;
        }
    }
}
