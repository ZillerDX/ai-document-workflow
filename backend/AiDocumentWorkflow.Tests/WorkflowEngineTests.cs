using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using AiDocumentWorkflow.Api.Data;
using AiDocumentWorkflow.Api.Models;
using AiDocumentWorkflow.Api.Services;
using Xunit;

namespace AiDocumentWorkflow.Tests
{
    public class WorkflowEngineTests
    {
        private AppDbContext CreateInMemoryDbContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            return new AppDbContext(options);
        }

        private Document CreateSampleDocument(string status = "PendingLevel1", int currentLevel = 1)
        {
            var docId = Guid.NewGuid();
            var doc = new Document
            {
                Id = docId,
                DocumentNumber = "INV-TEST-001",
                DocumentType = "Invoice",
                VendorName = "Acme Global Solutions",
                CustomerName = "Enterprise Global Corp",
                SubTotal = 1000.00m,
                TaxRate = 10.0m,
                TaxAmount = 100.00m,
                TotalAmount = 1100.00m,
                Status = status,
                CurrentApprovalLevel = currentLevel,
                TotalApprovalLevels = 2
            };

            doc.ApprovalSteps.Add(new ApprovalStep
            {
                DocumentId = docId,
                StepNumber = 1,
                RoleRequired = "Manager",
                Title = "Department Manager Review",
                Status = currentLevel > 1 ? "Approved" : "Pending"
            });

            doc.ApprovalSteps.Add(new ApprovalStep
            {
                DocumentId = docId,
                StepNumber = 2,
                RoleRequired = "Finance",
                Title = "Finance Controller Approval",
                Status = "Pending"
            });

            return doc;
        }

        [Fact]
        public async Task Manager_Approves_Level1_TransitionsTo_PendingLevel2()
        {
            // Arrange
            using var context = CreateInMemoryDbContext();
            var auditService = new AuditService(context);
            var workflowService = new DocumentWorkflowService(context, auditService);

            var doc = CreateSampleDocument("PendingLevel1", 1);
            context.Documents.Add(doc);
            await context.SaveChangesAsync();

            var action = new WorkflowActionDto
            {
                Action = "Approve",
                ActorId = "usr-mgr-01",
                ActorName = "Sarah Connor",
                ActorRole = "Manager",
                Comment = "Operational specs verified."
            };

            // Act
            var result = await workflowService.ProcessActionAsync(doc.Id, action);

            // Assert
            Assert.Equal("PendingLevel2", result.Status);
            Assert.Equal(2, result.CurrentApprovalLevel);
            Assert.Equal("Approved", result.ApprovalSteps.First(s => s.StepNumber == 1).Status);
            Assert.Equal("Sarah Connor", result.ApprovalSteps.First(s => s.StepNumber == 1).ApproverUserName);

            var auditLog = await context.AuditLogs.FirstOrDefaultAsync(a => a.Action == "ApprovedLevel1");
            Assert.NotNull(auditLog);
            Assert.Equal("Manager", auditLog.ActorRole);
        }

        [Fact]
        public async Task Finance_Approves_Level2_TransitionsTo_Approved()
        {
            // Arrange
            using var context = CreateInMemoryDbContext();
            var auditService = new AuditService(context);
            var workflowService = new DocumentWorkflowService(context, auditService);

            var doc = CreateSampleDocument("PendingLevel2", 2);
            context.Documents.Add(doc);
            await context.SaveChangesAsync();

            var action = new WorkflowActionDto
            {
                Action = "Approve",
                ActorId = "usr-fin-01",
                ActorName = "David Sterling",
                ActorRole = "Finance",
                Comment = "Budget disbursement approved."
            };

            // Act
            var result = await workflowService.ProcessActionAsync(doc.Id, action);

            // Assert
            Assert.Equal("Approved", result.Status);
            Assert.Equal(3, result.CurrentApprovalLevel);
            Assert.Equal("Approved", result.ApprovalSteps.First(s => s.StepNumber == 2).Status);

            var auditLog = await context.AuditLogs.FirstOrDefaultAsync(a => a.Action == "ApprovedLevel2");
            Assert.NotNull(auditLog);
        }

        [Fact]
        public async Task Manager_RequestsRevision_Then_Staff_Resubmits_ReturnsTo_PendingLevel1()
        {
            // Arrange
            using var context = CreateInMemoryDbContext();
            var auditService = new AuditService(context);
            var workflowService = new DocumentWorkflowService(context, auditService);

            var doc = CreateSampleDocument("PendingLevel1", 1);
            context.Documents.Add(doc);
            await context.SaveChangesAsync();

            // 1. Manager requests revision
            var revisionAction = new WorkflowActionDto
            {
                Action = "RequestRevision",
                ActorId = "usr-mgr-01",
                ActorName = "Sarah Connor",
                ActorRole = "Manager",
                Comment = "Please correct invoice subtotal."
            };
            var revisedDoc = await workflowService.ProcessActionAsync(doc.Id, revisionAction);

            Assert.Equal("RevisionRequested", revisedDoc.Status);
            Assert.Equal("RevisionRequested", revisedDoc.ApprovalSteps.First(s => s.StepNumber == 1).Status);

            // 2. Staff resubmits corrected document
            var resubmitAction = new WorkflowActionDto
            {
                Action = "Resubmit",
                ActorId = "usr-staff-01",
                ActorName = "Elena Vance",
                ActorRole = "Staff",
                Comment = "Corrected line item figures."
            };
            var resubmittedDoc = await workflowService.ProcessActionAsync(doc.Id, resubmitAction);

            // Assert: Returned to Level 1 Manager queue
            Assert.Equal("PendingLevel1", resubmittedDoc.Status);
            Assert.Equal(1, resubmittedDoc.CurrentApprovalLevel);
            Assert.Equal("Pending", resubmittedDoc.ApprovalSteps.First(s => s.StepNumber == 1).Status);

            var resubmitLog = await context.AuditLogs.FirstOrDefaultAsync(a => a.Action == "Resubmitted");
            Assert.NotNull(resubmitLog);
        }

        [Fact]
        public async Task Staff_Attempting_Level1_Approval_Is_Blocked()
        {
            // Arrange
            using var context = CreateInMemoryDbContext();
            var auditService = new AuditService(context);
            var workflowService = new DocumentWorkflowService(context, auditService);

            var doc = CreateSampleDocument("PendingLevel1", 1);
            context.Documents.Add(doc);
            await context.SaveChangesAsync();

            var action = new WorkflowActionDto
            {
                Action = "Approve",
                ActorId = "usr-staff-01",
                ActorName = "Elena Vance",
                ActorRole = "Staff"
            };

            // Act & Assert
            var ex = await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
                workflowService.ProcessActionAsync(doc.Id, action));

            Assert.Contains("Manager", ex.Message);
        }

        [Fact]
        public async Task Manager_Attempting_Level2_Finance_Approval_Is_Blocked()
        {
            // Arrange
            using var context = CreateInMemoryDbContext();
            var auditService = new AuditService(context);
            var workflowService = new DocumentWorkflowService(context, auditService);

            var doc = CreateSampleDocument("PendingLevel2", 2);
            context.Documents.Add(doc);
            await context.SaveChangesAsync();

            var action = new WorkflowActionDto
            {
                Action = "Approve",
                ActorId = "usr-mgr-01",
                ActorName = "Sarah Connor",
                ActorRole = "Manager"
            };

            // Act & Assert
            var ex = await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
                workflowService.ProcessActionAsync(doc.Id, action));

            Assert.Contains("Finance", ex.Message);
        }

        [Fact]
        public async Task Auditor_Attempting_Any_Workflow_Mutation_Is_Blocked()
        {
            // Arrange
            using var context = CreateInMemoryDbContext();
            var auditService = new AuditService(context);
            var workflowService = new DocumentWorkflowService(context, auditService);

            var doc = CreateSampleDocument("PendingLevel1", 1);
            context.Documents.Add(doc);
            await context.SaveChangesAsync();

            var action = new WorkflowActionDto
            {
                Action = "Approve",
                ActorId = "usr-audit-01",
                ActorName = "Morgan Hayes",
                ActorRole = "Auditor"
            };

            // Act & Assert
            var ex = await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
                workflowService.ProcessActionAsync(doc.Id, action));

            Assert.Contains("Auditor", ex.Message);
        }

        [Fact]
        public async Task AuditService_Generates_Cryptographic_SHA256_Chain()
        {
            // Arrange
            using var context = CreateInMemoryDbContext();
            var auditService = new AuditService(context);
            var docId = Guid.NewGuid();

            // Act: Create 3 sequential audit logs
            await auditService.LogAsync(docId, "DOC-101", "Uploaded", "usr-1", "Elena", "Staff", "Initial upload");
            await auditService.LogAsync(docId, "DOC-101", "AiAnalyzed", "sys-ai", "Gemini", "AI", "OCR completed");
            await auditService.LogAsync(docId, "DOC-101", "ApprovedLevel1", "usr-2", "Sarah", "Manager", "Approved");

            var logs = await context.AuditLogs.OrderBy(a => a.Sequence).ToListAsync();

            // Assert
            Assert.Equal(3, logs.Count);

            // Log 0 starts with Genesis Hash
            Assert.Equal(AuditService.GenesisHash, logs[0].PreviousHash);
            Assert.NotNull(logs[0].RecordHash);

            // Log 1 points to Log 0's RecordHash
            Assert.Equal(logs[0].RecordHash, logs[1].PreviousHash);
            Assert.NotNull(logs[1].RecordHash);

            // Log 2 points to Log 1's RecordHash
            Assert.Equal(logs[1].RecordHash, logs[2].PreviousHash);
            Assert.NotNull(logs[2].RecordHash);

            // Verify content hash computation
            var expectedHash = AuditService.ComputeRecordHash(
                logs[1].PreviousHash ?? AuditService.GenesisHash, 
                logs[1].Timestamp, 
                logs[1].DocumentId, 
                logs[1].DocumentNumber, 
                logs[1].Action, 
                logs[1].ActorId, 
                logs[1].ActorRole, 
                logs[1].Details, 
                logs[1].PreviousValue, 
                logs[1].NewValue
            );
            Assert.Equal(expectedHash, logs[1].RecordHash);
        }
    }
}
