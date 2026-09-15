using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AiDocumentWorkflow.Api.Data;
using AiDocumentWorkflow.Api.Models;
using AiDocumentWorkflow.Api.Services;

namespace AiDocumentWorkflow.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DocumentsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IGeminiDocumentService _geminiService;
        private readonly IAuditService _auditService;

        public DocumentsController(AppDbContext context, IGeminiDocumentService geminiService, IAuditService auditService)
        {
            _context = context;
            _geminiService = geminiService;
            _auditService = auditService;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Document>>> GetDocuments([FromQuery] string? status, [FromQuery] string? type, [FromQuery] string? search)
        {
            var query = _context.Documents
                .Include(d => d.ApprovalSteps)
                .Include(d => d.LineItems)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(status) && status != "all")
            {
                query = query.Where(d => d.Status.ToLower() == status.ToLower());
            }

            if (!string.IsNullOrWhiteSpace(type) && type != "all")
            {
                query = query.Where(d => d.DocumentType.ToLower() == type.ToLower());
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.ToLower();
                query = query.Where(d => d.DocumentNumber.ToLower().Contains(s) ||
                                         d.VendorName.ToLower().Contains(s) ||
                                         d.CustomerName.ToLower().Contains(s));
            }

            var list = await query.OrderByDescending(d => d.CreatedAt).ToListAsync();
            return Ok(list);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Document>> GetDocument(Guid id)
        {
            var doc = await _context.Documents
                .Include(d => d.ApprovalSteps)
                .Include(d => d.LineItems)
                .Include(d => d.AuditLogs.OrderByDescending(a => a.Timestamp))
                .FirstOrDefaultAsync(d => d.Id == id);

            if (doc == null)
            {
                return NotFound(new { message = $"Document with ID {id} not found." });
            }

            return Ok(doc);
        }

        [HttpPost("upload")]
        public async Task<ActionResult<Document>> UploadDocument([FromForm] IFormFile file, [FromForm] string? uploadedByUserId, [FromForm] string? uploadedByUserName, [FromForm] string? uploadedByRole)
        {
            if (string.Equals(uploadedByRole, "Auditor", StringComparison.OrdinalIgnoreCase))
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "Auditor role has strictly read-only forensic access and cannot upload documents." });
            }

            if (file == null || file.Length == 0)
            {
                return BadRequest(new { message = "A valid file is required." });
            }

            var userId = uploadedByUserId ?? "usr-staff-01";
            var userName = uploadedByUserName ?? "Staff Member";

            var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "uploads");
            if (!Directory.Exists(uploadsFolder))
            {
                Directory.CreateDirectory(uploadsFolder);
            }

            var uniqueFileName = $"{Guid.NewGuid()}_{Path.GetFileName(file.FileName)}";
            var filePath = Path.Combine(uploadsFolder, uniqueFileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            // Perform Gemini extraction
            GeminiExtractionResult aiResult;
            using (var readStream = new FileStream(filePath, FileMode.Open, FileAccess.Read))
            {
                aiResult = await _geminiService.ExtractAndAnalyzeAsync(readStream, file.FileName, file.ContentType);
            }

            var docId = Guid.NewGuid();
            var docNumber = string.IsNullOrWhiteSpace(aiResult.DocumentNumber) ? $"DOC-{new Random().Next(1000, 9999)}" : aiResult.DocumentNumber;

            var document = new Document
            {
                Id = docId,
                DocumentNumber = docNumber,
                DocumentType = aiResult.DocumentType ?? "Invoice",
                OriginalFileName = file.FileName,
                StoredFilePath = uniqueFileName,
                ContentType = file.ContentType,
                FileSizeBytes = file.Length,
                VendorName = string.IsNullOrWhiteSpace(aiResult.VendorName) ? "Unspecified Vendor" : aiResult.VendorName,
                CustomerName = string.IsNullOrWhiteSpace(aiResult.CustomerName) ? "Enterprise Global Corp" : aiResult.CustomerName,
                TaxId = aiResult.TaxId,
                IssueDate = aiResult.IssueDate ?? DateTime.UtcNow,
                DueDate = aiResult.DueDate ?? DateTime.UtcNow.AddDays(30),
                SubTotal = aiResult.SubTotal,
                TaxRate = aiResult.TaxRate,
                TaxAmount = aiResult.TaxAmount,
                TotalAmount = aiResult.TotalAmount,
                Currency = string.IsNullOrWhiteSpace(aiResult.Currency) ? "USD" : aiResult.Currency,
                Status = "PendingLevel1",
                CurrentApprovalLevel = 1,
                TotalApprovalLevels = 2,
                AiSummary = aiResult.ExecutiveSummary,
                AiAnomalyDetected = aiResult.AnomalyDetected,
                AiAnomalyNotes = aiResult.AnomalyNotes,
                AiConfidenceScore = aiResult.ConfidenceScore > 0 ? aiResult.ConfidenceScore : 0.95,
                UploadedByUserId = userId,
                UploadedByUserName = userName,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            // Add line items
            if (aiResult.LineItems != null && aiResult.LineItems.Any())
            {
                foreach (var item in aiResult.LineItems)
                {
                    document.LineItems.Add(new DocumentLineItem
                    {
                        DocumentId = docId,
                        Description = item.Description,
                        Quantity = item.Quantity > 0 ? item.Quantity : 1,
                        UnitPrice = item.UnitPrice,
                        Amount = item.Amount
                    });
                }
            }
            else
            {
                document.LineItems.Add(new DocumentLineItem
                {
                    DocumentId = docId,
                    Description = "Extracted Line Items Summary",
                    Quantity = 1,
                    UnitPrice = aiResult.SubTotal,
                    Amount = aiResult.SubTotal
                });
            }

            // Setup 2-tier approval workflow
            document.ApprovalSteps.Add(new ApprovalStep
            {
                DocumentId = docId,
                StepNumber = 1,
                RoleRequired = "Manager",
                Title = "Department Manager Review",
                Status = "Pending"
            });

            document.ApprovalSteps.Add(new ApprovalStep
            {
                DocumentId = docId,
                StepNumber = 2,
                RoleRequired = "Finance",
                Title = "Finance Controller Approval",
                Status = "Pending"
            });

            _context.Documents.Add(document);
            await _context.SaveChangesAsync();

            // Log upload and AI analysis
            await _auditService.LogAsync(
                docId,
                docNumber,
                "Uploaded",
                userId,
                userName,
                "Staff",
                $"Document '{file.FileName}' uploaded and initialized in multi-level workflow queue."
            );

            var anomalyDetail = aiResult.AnomalyDetected 
                ? $"ANOMALY DETECTED: {aiResult.AnomalyNotes}" 
                : $"All fields validated cleanly. Confidence: {document.AiConfidenceScore:P0}.";

            await _auditService.LogAsync(
                docId,
                docNumber,
                "AiAnalyzed",
                "sys-gemini-ai",
                "Gemini AI Engine",
                "AI Service",
                $"Automated extraction completed. {anomalyDetail}"
            );

            return CreatedAtAction(nameof(GetDocument), new { id = document.Id }, document);
        }

        [HttpPost("preset/{presetType}")]
        public async Task<ActionResult<Document>> CreatePresetDocument(string presetType, [FromQuery] string? userId, [FromQuery] string? userName)
        {
            var uId = userId ?? "usr-staff-01";
            var uName = userName ?? "Elena Vance (Staff)";

            var aiResult = await _geminiService.GenerateMockPresetAsync(presetType);

            var docId = Guid.NewGuid();
            var docNumber = aiResult.DocumentNumber;

            var document = new Document
            {
                Id = docId,
                DocumentNumber = docNumber,
                DocumentType = aiResult.DocumentType,
                OriginalFileName = $"{docNumber.Replace('-', '_')}_preset.pdf",
                StoredFilePath = null,
                ContentType = "application/pdf",
                FileSizeBytes = 124800,
                VendorName = aiResult.VendorName,
                CustomerName = aiResult.CustomerName,
                TaxId = aiResult.TaxId,
                IssueDate = aiResult.IssueDate,
                DueDate = aiResult.DueDate,
                SubTotal = aiResult.SubTotal,
                TaxRate = aiResult.TaxRate,
                TaxAmount = aiResult.TaxAmount,
                TotalAmount = aiResult.TotalAmount,
                Currency = aiResult.Currency,
                Status = "PendingLevel1",
                CurrentApprovalLevel = 1,
                TotalApprovalLevels = 2,
                AiSummary = aiResult.ExecutiveSummary,
                AiAnomalyDetected = aiResult.AnomalyDetected,
                AiAnomalyNotes = aiResult.AnomalyNotes,
                AiConfidenceScore = aiResult.ConfidenceScore,
                UploadedByUserId = uId,
                UploadedByUserName = uName,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            foreach (var item in aiResult.LineItems)
            {
                document.LineItems.Add(new DocumentLineItem
                {
                    DocumentId = docId,
                    Description = item.Description,
                    Quantity = item.Quantity,
                    UnitPrice = item.UnitPrice,
                    Amount = item.Amount
                });
            }

            document.ApprovalSteps.Add(new ApprovalStep
            {
                DocumentId = docId,
                StepNumber = 1,
                RoleRequired = "Manager",
                Title = "Department Manager Review",
                Status = "Pending"
            });

            document.ApprovalSteps.Add(new ApprovalStep
            {
                DocumentId = docId,
                StepNumber = 2,
                RoleRequired = "Finance",
                Title = "Finance Controller Approval",
                Status = "Pending"
            });

            _context.Documents.Add(document);
            await _context.SaveChangesAsync();

            await _auditService.LogAsync(
                docId,
                docNumber,
                "Uploaded",
                uId,
                uName,
                "Staff",
                $"Sample enterprise document preset '{presetType}' initialized."
            );

            var anomalyDetail = aiResult.AnomalyDetected 
                ? $"ANOMALY FLAGGED: {aiResult.AnomalyNotes}" 
                : $"Automated extraction completed without discrepancies. Confidence: {document.AiConfidenceScore:P0}.";

            await _auditService.LogAsync(
                docId,
                docNumber,
                "AiAnalyzed",
                "sys-gemini-ai",
                "Gemini AI Engine",
                "AI Service",
                anomalyDetail
            );

            return CreatedAtAction(nameof(GetDocument), new { id = document.Id }, document);
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<Document>> UpdateDocument(Guid id, [FromBody] UpdateDocumentDto dto)
        {
            var doc = await _context.Documents
                .Include(d => d.LineItems)
                .Include(d => d.ApprovalSteps)
                .FirstOrDefaultAsync(d => d.Id == id);

            if (doc == null)
            {
                return NotFound(new { message = $"Document with ID {id} not found." });
            }

            var actorId = dto.ActorId ?? "usr-staff-01";
            var actorName = dto.ActorName ?? "Elena Vance";
            var actorRole = dto.ActorRole ?? "Staff";

            if (string.Equals(actorRole, "Auditor", StringComparison.OrdinalIgnoreCase))
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "Auditor role has strictly read-only forensic access and is prohibited from editing document fields." });
            }

            var changesList = new List<string>();

            if (!string.IsNullOrWhiteSpace(dto.DocumentNumber) && dto.DocumentNumber != doc.DocumentNumber)
            {
                changesList.Add($"Document Number: '{doc.DocumentNumber}' -> '{dto.DocumentNumber}'");
                doc.DocumentNumber = dto.DocumentNumber;
            }

            if (!string.IsNullOrWhiteSpace(dto.VendorName) && dto.VendorName != doc.VendorName)
            {
                changesList.Add($"Vendor: '{doc.VendorName}' -> '{dto.VendorName}'");
                doc.VendorName = dto.VendorName;
            }

            if (dto.TotalAmount != doc.TotalAmount)
            {
                changesList.Add($"Total Amount: {doc.Currency} {doc.TotalAmount:N2} -> {doc.Currency} {dto.TotalAmount:N2}");
                doc.TotalAmount = dto.TotalAmount;
            }

            if (dto.SubTotal != doc.SubTotal)
            {
                doc.SubTotal = dto.SubTotal;
            }

            if (dto.TaxAmount != doc.TaxAmount)
            {
                changesList.Add($"Tax Amount: {doc.Currency} {doc.TaxAmount:N2} -> {doc.Currency} {dto.TaxAmount:N2}");
                doc.TaxAmount = dto.TaxAmount;
            }

            if (dto.TaxRate != doc.TaxRate)
            {
                doc.TaxRate = dto.TaxRate;
            }

            if (dto.IssueDate.HasValue) doc.IssueDate = dto.IssueDate.Value;
            if (dto.DueDate.HasValue) doc.DueDate = dto.DueDate.Value;
            if (!string.IsNullOrWhiteSpace(dto.TaxId)) doc.TaxId = dto.TaxId;

            // Recheck anomaly if tax was corrected
            var calculatedTax = Math.Round(doc.SubTotal * (doc.TaxRate / 100.0m), 2);
            if (Math.Abs(doc.TaxAmount - calculatedTax) <= 0.05m && doc.AiAnomalyDetected)
            {
                doc.AiAnomalyDetected = false;
                doc.AiAnomalyNotes = "Previously flagged tax anomaly was manually reviewed and verified by user.";
                changesList.Add("Anomaly resolved via user manual reconciliation.");
            }

            doc.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            var diffSummary = changesList.Any() 
                ? string.Join("; ", changesList) 
                : "Fields updated without major variance.";

            await _auditService.LogAsync(
                doc.Id,
                doc.DocumentNumber,
                "FieldEdited",
                actorId,
                actorName,
                actorRole,
                $"Manual field correction: {diffSummary}. Reason: {dto.EditReason ?? "Data accuracy alignment"}"
            );

            return Ok(doc);
        }

        [HttpPost("{id}/reanalyze")]
        public async Task<ActionResult<Document>> ReAnalyzeDocument(Guid id)
        {
            var doc = await _context.Documents.FirstOrDefaultAsync(d => d.Id == id);
            if (doc == null) return NotFound();

            // Re-check math
            var expectedTax = Math.Round(doc.SubTotal * (doc.TaxRate / 100.0m), 2);
            var isDiscrepancy = Math.Abs(doc.TaxAmount - expectedTax) > 0.05m;

            doc.AiAnomalyDetected = isDiscrepancy;
            doc.AiAnomalyNotes = isDiscrepancy 
                ? $"Tax calculation discrepancy: Stated {doc.TaxAmount:N2}, expected {expectedTax:N2} based on {doc.TaxRate}% rate."
                : null;
            doc.AiConfidenceScore = isDiscrepancy ? 0.85 : 0.98;
            doc.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            await _auditService.LogAsync(
                doc.Id,
                doc.DocumentNumber,
                "ReAnalyzed",
                "sys-gemini-ai",
                "Gemini AI Engine",
                "AI Service",
                $"Re-analysis completed. Anomaly status: {(isDiscrepancy ? "FLAGGED" : "CLEAN")}."
            );

            return Ok(doc);
        }
    }
}
