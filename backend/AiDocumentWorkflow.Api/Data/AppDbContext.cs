using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;
using AiDocumentWorkflow.Api.Models;
using AiDocumentWorkflow.Api.Services;

namespace AiDocumentWorkflow.Api.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<Document> Documents => Set<Document>();
        public DbSet<DocumentLineItem> DocumentLineItems => Set<DocumentLineItem>();
        public DbSet<ApprovalStep> ApprovalSteps => Set<ApprovalStep>();
        public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<Document>()
                .HasMany(d => d.LineItems)
                .WithOne()
                .HasForeignKey(li => li.DocumentId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Document>()
                .HasMany(d => d.ApprovalSteps)
                .WithOne()
                .HasForeignKey(s => s.DocumentId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Document>()
                .HasMany(d => d.AuditLogs)
                .WithOne()
                .HasForeignKey(a => a.DocumentId)
                .OnDelete(DeleteBehavior.Cascade);
        }

        public void SeedInitialData()
        {
            if (Documents.Any()) return;

            var doc1Id = Guid.Parse("11111111-1111-1111-1111-111111111111");
            var doc2Id = Guid.Parse("22222222-2222-2222-2222-222222222222");
            var doc3Id = Guid.Parse("33333333-3333-3333-3333-333333333333");
            var doc4Id = Guid.Parse("44444444-4444-4444-4444-444444444444");

            // Doc 1: Pending Manager Review
            var doc1 = new Document
            {
                Id = doc1Id,
                DocumentNumber = "INV-2025-0891",
                DocumentType = "Invoice",
                OriginalFileName = "Apex_Cloud_Invoice_Oct.pdf",
                VendorName = "Apex Cloud Infrastructure Inc.",
                CustomerName = "Enterprise Global Corp",
                TaxId = "US-98472910-X",
                IssueDate = DateTime.UtcNow.AddDays(-3),
                DueDate = DateTime.UtcNow.AddDays(27),
                SubTotal = 4200.00m,
                TaxRate = 7.0m,
                TaxAmount = 294.00m,
                TotalAmount = 4494.00m,
                Currency = "USD",
                Status = "PendingLevel1",
                CurrentApprovalLevel = 1,
                TotalApprovalLevels = 2,
                AiSummary = "Monthly dedicated Kubernetes enterprise cluster hosting and automated failover storage for Q4 infrastructure.",
                AiAnomalyDetected = false,
                AiConfidenceScore = 0.98,
                UploadedByUserId = "usr-staff-01",
                UploadedByUserName = "Elena Vance (IT Ops)",
                CreatedAt = DateTime.UtcNow.AddDays(-3),
                UpdatedAt = DateTime.UtcNow.AddDays(-3)
            };

            // Doc 2: Pending Finance Approval (Level 1 was approved)
            var doc2 = new Document
            {
                Id = doc2Id,
                DocumentNumber = "QUO-2025-0312",
                DocumentType = "Quotation",
                OriginalFileName = "CyberCore_Robotics_Upgrade_Q4.pdf",
                VendorName = "CyberCore Industrial Robotics Ltd.",
                CustomerName = "Enterprise Global Corp",
                TaxId = "DE-812398412",
                IssueDate = DateTime.UtcNow.AddDays(-5),
                DueDate = DateTime.UtcNow.AddDays(25),
                SubTotal = 18500.00m,
                TaxRate = 19.0m,
                TaxAmount = 3515.00m,
                TotalAmount = 22015.00m,
                Currency = "EUR",
                Status = "PendingLevel2",
                CurrentApprovalLevel = 2,
                TotalApprovalLevels = 2,
                AiSummary = "Automated packaging sensor calibration and firmware safety upgrades for Assembly Line 3.",
                AiAnomalyDetected = false,
                AiConfidenceScore = 0.96,
                UploadedByUserId = "usr-staff-02",
                UploadedByUserName = "Marcus Brody (Engineering)",
                CreatedAt = DateTime.UtcNow.AddDays(-5),
                UpdatedAt = DateTime.UtcNow.AddDays(-2)
            };

            // Doc 3: Fully Approved
            var doc3 = new Document
            {
                Id = doc3Id,
                DocumentNumber = "INV-2025-0744",
                DocumentType = "Invoice",
                OriginalFileName = "Quantum_Logistics_Freight_0744.pdf",
                VendorName = "Quantum International Logistics",
                CustomerName = "Enterprise Global Corp",
                TaxId = "TH-01055589123",
                IssueDate = DateTime.UtcNow.AddDays(-10),
                DueDate = DateTime.UtcNow.AddDays(20),
                SubTotal = 8600.00m,
                TaxRate = 7.0m,
                TaxAmount = 602.00m,
                TotalAmount = 9202.00m,
                Currency = "USD",
                Status = "Approved",
                CurrentApprovalLevel = 3,
                TotalApprovalLevels = 2,
                AiSummary = "Expedited air cargo customs clearance and regional refrigerated container transport.",
                AiAnomalyDetected = false,
                AiConfidenceScore = 0.99,
                UploadedByUserId = "usr-staff-01",
                UploadedByUserName = "Elena Vance (IT Ops)",
                CreatedAt = DateTime.UtcNow.AddDays(-10),
                UpdatedAt = DateTime.UtcNow.AddDays(-6)
            };

            // Doc 4: Anomaly Detected (Tax calculation mismatch)
            var doc4 = new Document
            {
                Id = doc4Id,
                DocumentNumber = "INV-2025-1049",
                DocumentType = "Invoice",
                OriginalFileName = "Vanguard_Hardware_Discrepancy.pdf",
                VendorName = "Vanguard Computer Components",
                CustomerName = "Enterprise Global Corp",
                TaxId = "US-44910293-A",
                IssueDate = DateTime.UtcNow.AddDays(-1),
                DueDate = DateTime.UtcNow.AddDays(14),
                SubTotal = 10000.00m,
                TaxRate = 7.0m,
                TaxAmount = 1500.00m, // Discrepancy! Should be 700
                TotalAmount = 11500.00m,
                Currency = "USD",
                Status = "PendingLevel1",
                CurrentApprovalLevel = 1,
                TotalApprovalLevels = 2,
                AiSummary = "Procurement of 20x enterprise NVMe storage racks. Gemini AI detected financial anomaly: declared tax of $1,500.00 deviates from computed 7% rate ($700.00).",
                AiAnomalyDetected = true,
                AiAnomalyNotes = "CRITICAL: Tax calculation mismatch detected. Subtotal is $10,000.00 with 7% stated tax rate. Expected tax is $700.00, but document declared $1,500.00 (+$800 discrepancy). Requires manual audit.",
                AiConfidenceScore = 0.82,
                UploadedByUserId = "usr-staff-03",
                UploadedByUserName = "Kenji Sato (Procurement)",
                CreatedAt = DateTime.UtcNow.AddDays(-1),
                UpdatedAt = DateTime.UtcNow.AddDays(-1)
            };

            Documents.AddRange(doc1, doc2, doc3, doc4);

            // Line items
            DocumentLineItems.AddRange(
                new DocumentLineItem { DocumentId = doc1Id, Description = "Cloud Compute Nodes (48 vCPU, 192GB RAM)", Quantity = 3, UnitPrice = 900.00m, Amount = 2700.00m },
                new DocumentLineItem { DocumentId = doc1Id, Description = "Encrypted Block Storage SSD (10 TB)", Quantity = 3, UnitPrice = 500.00m, Amount = 1500.00m },

                new DocumentLineItem { DocumentId = doc2Id, Description = "Robotics Sensor Unit Optical Suite", Quantity = 2, UnitPrice = 6500.00m, Amount = 13000.00m },
                new DocumentLineItem { DocumentId = doc2Id, Description = "Onsite Calibration & Engineering Hours", Quantity = 1, UnitPrice = 5500.00m, Amount = 5500.00m },

                new DocumentLineItem { DocumentId = doc3Id, Description = "Transpacific Freight Shipment (Container #Q99)", Quantity = 1, UnitPrice = 8600.00m, Amount = 8600.00m },

                new DocumentLineItem { DocumentId = doc4Id, Description = "Enterprise Gen4 8TB NVMe U.2 Drive", Quantity = 20, UnitPrice = 500.00m, Amount = 10000.00m }
            );

            // Approval Steps
            ApprovalSteps.AddRange(
                // Doc 1 steps
                new ApprovalStep { DocumentId = doc1Id, StepNumber = 1, RoleRequired = "Manager", Title = "Department Manager Review", Status = "Pending" },
                new ApprovalStep { DocumentId = doc1Id, StepNumber = 2, RoleRequired = "Finance", Title = "Finance Controller Approval", Status = "Pending" },

                // Doc 2 steps
                new ApprovalStep { DocumentId = doc2Id, StepNumber = 1, RoleRequired = "Manager", Title = "Department Manager Review", Status = "Approved", ApproverUserId = "usr-mgr-01", ApproverUserName = "Sarah Connor (Operations Director)", Comment = "Hardware specs verified against production roadmap.", DecidedAt = DateTime.UtcNow.AddDays(-2) },
                new ApprovalStep { DocumentId = doc2Id, StepNumber = 2, RoleRequired = "Finance", Title = "Finance Controller Approval", Status = "Pending" },

                // Doc 3 steps
                new ApprovalStep { DocumentId = doc3Id, StepNumber = 1, RoleRequired = "Manager", Title = "Department Manager Review", Status = "Approved", ApproverUserId = "usr-mgr-01", ApproverUserName = "Sarah Connor (Operations Director)", Comment = "Cargo delivered and inspected at dock.", DecidedAt = DateTime.UtcNow.AddDays(-8) },
                new ApprovalStep { DocumentId = doc3Id, StepNumber = 2, RoleRequired = "Finance", Title = "Finance Controller Approval", Status = "Approved", ApproverUserId = "usr-fin-01", ApproverUserName = "David Sterling (Chief Financial Officer)", Comment = "Disbursement authorized via wire transfer.", DecidedAt = DateTime.UtcNow.AddDays(-6) },

                // Doc 4 steps
                new ApprovalStep { DocumentId = doc4Id, StepNumber = 1, RoleRequired = "Manager", Title = "Department Manager Review", Status = "Pending" },
                new ApprovalStep { DocumentId = doc4Id, StepNumber = 2, RoleRequired = "Finance", Title = "Finance Controller Approval", Status = "Pending" }
            );

            // Seed Cryptographically Chained Audit Logs
            string prevHash = "0000000000000000000000000000000000000000000000000000000000000000";
            using var sha = System.Security.Cryptography.SHA256.Create();
            var nowUtc = DateTime.UtcNow;
            var baseTime = new DateTime(nowUtc.Year, nowUtc.Month, nowUtc.Day, nowUtc.Hour, nowUtc.Minute, nowUtc.Second, DateTimeKind.Utc);

            var seedLogs = new List<AuditLog>
            {
                new AuditLog { DocumentId = doc1Id, DocumentNumber = "INV-2025-0891", Action = "Uploaded", ActorId = "usr-staff-01", ActorName = "Elena Vance", ActorRole = "Staff", Details = "Document uploaded and submitted to workflow queue.", Timestamp = baseTime.AddDays(-3) },
                new AuditLog { DocumentId = doc1Id, DocumentNumber = "INV-2025-0891", Action = "AiAnalyzed", ActorId = "sys-gemini-ai", ActorName = "Gemini AI Engine", ActorRole = "AI Engine", Details = "Automated OCR extraction completed. Confidence score: 98%. No anomalies detected.", Timestamp = baseTime.AddDays(-3).AddMinutes(1) },
                new AuditLog { DocumentId = doc2Id, DocumentNumber = "QUO-2025-0312", Action = "ApprovedLevel1", ActorId = "usr-mgr-01", ActorName = "Sarah Connor", ActorRole = "Manager", Details = "Level 1 operational approval granted. Dispatched to Finance Controller queue.", Timestamp = baseTime.AddDays(-2) },
                new AuditLog { DocumentId = doc3Id, DocumentNumber = "INV-2025-0744", Action = "ApprovedLevel2", ActorId = "usr-fin-01", ActorName = "David Sterling", ActorRole = "Finance", Details = "Final Level 2 financial approval granted. Status moved to Approved.", Timestamp = baseTime.AddDays(-6) },
                new AuditLog { DocumentId = doc4Id, DocumentNumber = "INV-2025-1049", Action = "AiAnalyzed", ActorId = "sys-gemini-ai", ActorName = "Gemini AI Engine", ActorRole = "AI Engine", Details = "ANOMALY FLAGGED: Declared tax $1,500.00 violates calculated 7% expected $700.00.", Timestamp = baseTime.AddDays(-1).AddMinutes(1) }
            };

            // Sort strictly chronologically before chaining
            seedLogs = seedLogs.OrderBy(l => l.Timestamp).ToList();

            foreach (var log in seedLogs)
            {
                log.PreviousHash = prevHash;
                log.RecordHash = AuditService.ComputeRecordHash(
                    log.PreviousHash,
                    log.Timestamp,
                    log.DocumentId,
                    log.DocumentNumber,
                    log.Action,
                    log.ActorId,
                    log.ActorRole,
                    log.Details,
                    log.PreviousValue,
                    log.NewValue
                );
                prevHash = log.RecordHash;
                AuditLogs.Add(log);
            }

            SaveChanges();
        }
    }
}
