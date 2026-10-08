using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AiDocumentWorkflow.Api.Auth;
using AiDocumentWorkflow.Api.Data;
using AiDocumentWorkflow.Api.Models;
using AiDocumentWorkflow.Api.Services;

namespace AiDocumentWorkflow.Api.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/[controller]")]
    public class DocumentsController : ControllerBase
    {
        public const long MaxUploadBytes = 10 * 1024 * 1024;
        private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase) { ".pdf", ".png", ".jpg", ".jpeg" };
        private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase) { "application/pdf", "image/png", "image/jpeg" };

        private readonly AppDbContext _context;
        private readonly IGeminiDocumentService _geminiService;
        private readonly IAuditService _auditService;

        public DocumentsController(AppDbContext context, IGeminiDocumentService geminiService, IAuditService auditService)
        {
            _context = context;
            _geminiService = geminiService;
            _auditService = auditService;
        }

        private IQueryable<Document> DocumentsWithChildren() =>
            _context.Documents.Include(d => d.ApprovalSteps).Include(d => d.LineItems);

        [HttpGet]
        public async Task<ActionResult<IEnumerable<DocumentDto>>> GetDocuments([FromQuery] string? status, [FromQuery] string? type, [FromQuery] string? search)
        {
            var query = DocumentsWithChildren().AsNoTracking();

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
            return Ok(list.Select(DocumentDto.From));
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<DocumentDto>> GetDocument(Guid id)
        {
            var doc = await DocumentsWithChildren().AsNoTracking().FirstOrDefaultAsync(d => d.Id == id);
            if (doc == null)
            {
                return NotFound(new { message = $"Document with ID {id} not found." });
            }

            return Ok(DocumentDto.From(doc));
        }

        [HttpPost("upload")]
        [Authorize(Roles = Roles.Submitters)]
        [RequestSizeLimit(MaxUploadBytes + 1024 * 1024)]
        public async Task<ActionResult<DocumentDto>> UploadDocument(IFormFile file)
        {
            var actor = ActorContext.FromPrincipal(User);

            if (file == null || file.Length == 0)
            {
                return BadRequest(new { message = "A valid file is required." });
            }

            if (file.Length > MaxUploadBytes)
            {
                return StatusCode(StatusCodes.Status413PayloadTooLarge, new { message = $"File exceeds the {MaxUploadBytes / (1024 * 1024)} MB limit." });
            }

            var extension = Path.GetExtension(file.FileName);
            if (!AllowedExtensions.Contains(extension) || !AllowedContentTypes.Contains(file.ContentType ?? string.Empty))
            {
                return StatusCode(StatusCodes.Status415UnsupportedMediaType, new { message = "Only PDF, PNG and JPEG files are accepted." });
            }

            await using var buffer = new MemoryStream();
            await file.CopyToAsync(buffer);
            buffer.Position = 0;

            var aiResult = await _geminiService.ExtractAndAnalyzeAsync(buffer, file.FileName, file.ContentType!);

            var docNumber = string.IsNullOrWhiteSpace(aiResult.DocumentNumber)
                ? $"DOC-{Guid.NewGuid().ToString("N")[..8].ToUpperInvariant()}"
                : aiResult.DocumentNumber.Trim();

            if (await _context.Documents.AnyAsync(d => d.DocumentNumber == docNumber))
            {
                throw new ConflictException($"A document numbered '{docNumber}' already exists.");
            }

            var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "uploads");
            Directory.CreateDirectory(uploadsFolder);
            var storedName = $"{Guid.NewGuid()}{extension.ToLowerInvariant()}";
            await System.IO.File.WriteAllBytesAsync(Path.Combine(uploadsFolder, storedName), buffer.ToArray());

            var document = BuildDocument(aiResult, docNumber, actor);
            document.OriginalFileName = Path.GetFileName(file.FileName);
            document.StoredFilePath = storedName;
            document.ContentType = file.ContentType;
            document.FileSizeBytes = file.Length;

            _context.Documents.Add(document);
            await _auditService.StageAsync(document.Id, docNumber, "Uploaded", actor.Id, actor.Name, actor.Role,
                $"Document '{document.OriginalFileName}' uploaded and initialized in multi-level workflow queue.");
            await StageAiLog(document, aiResult, "ANOMALY DETECTED", "All fields validated cleanly");
            await DocumentWorkflowService.SaveAtomicAsync(_context);

            return CreatedAtAction(nameof(GetDocument), new { id = document.Id }, DocumentDto.From(document));
        }

        [HttpPost("preset/{presetType}")]
        [Authorize(Roles = Roles.Submitters)]
        public async Task<ActionResult<DocumentDto>> CreatePresetDocument(string presetType)
        {
            var actor = ActorContext.FromPrincipal(User);
            var aiResult = await _geminiService.GenerateMockPresetAsync(presetType);

            var document = BuildDocument(aiResult, aiResult.DocumentNumber, actor);
            document.OriginalFileName = $"{aiResult.DocumentNumber.Replace('-', '_')}_preset.pdf";
            document.ContentType = "application/pdf";
            document.FileSizeBytes = 124800;

            _context.Documents.Add(document);
            await _auditService.StageAsync(document.Id, document.DocumentNumber, "Uploaded", actor.Id, actor.Name, actor.Role,
                $"Sample enterprise document preset '{presetType}' initialized.");
            await StageAiLog(document, aiResult, "ANOMALY FLAGGED", "Automated extraction completed without discrepancies");
            await DocumentWorkflowService.SaveAtomicAsync(_context);

            return CreatedAtAction(nameof(GetDocument), new { id = document.Id }, DocumentDto.From(document));
        }

        [HttpPut("{id}")]
        [Authorize(Roles = Roles.Staff)]
        public async Task<ActionResult<DocumentDto>> UpdateDocument(Guid id, [FromBody] UpdateDocumentDto dto)
        {
            var actor = ActorContext.FromPrincipal(User);
            var doc = await DocumentsWithChildren().FirstOrDefaultAsync(d => d.Id == id);
            if (doc == null)
            {
                return NotFound(new { message = $"Document with ID {id} not found." });
            }

            if (doc.Status != DocStatus.PendingLevel1 && doc.Status != DocStatus.RevisionRequested)
            {
                throw new InvalidOperationException($"Document {doc.DocumentNumber} is '{doc.Status}' and its fields are locked. Fields can only be edited before Level 1 is decided or while a revision is requested.");
            }

            if (dto.Version.HasValue && dto.Version.Value != doc.Version)
            {
                throw new ConflictException($"Document {doc.DocumentNumber} was changed by someone else. Reload and try again.");
            }

            if (new[] { dto.SubTotal, dto.TaxRate, dto.TaxAmount, dto.TotalAmount }.Any(v => v < 0))
            {
                throw new ArgumentException("Amounts and tax rate must not be negative.");
            }

            var changes = new List<string>();

            if (!string.IsNullOrWhiteSpace(dto.DocumentNumber) && dto.DocumentNumber != doc.DocumentNumber)
            {
                if (await _context.Documents.AnyAsync(d => d.DocumentNumber == dto.DocumentNumber && d.Id != doc.Id))
                {
                    throw new ConflictException($"A document numbered '{dto.DocumentNumber}' already exists.");
                }
                changes.Add($"Document Number: '{doc.DocumentNumber}' -> '{dto.DocumentNumber}'");
                doc.DocumentNumber = dto.DocumentNumber;
            }

            if (!string.IsNullOrWhiteSpace(dto.VendorName) && dto.VendorName != doc.VendorName)
            {
                changes.Add($"Vendor: '{doc.VendorName}' -> '{dto.VendorName}'");
                doc.VendorName = dto.VendorName;
            }

            if (dto.TotalAmount.HasValue && dto.TotalAmount != doc.TotalAmount)
            {
                changes.Add($"Total Amount: {doc.Currency} {doc.TotalAmount:N2} -> {doc.Currency} {dto.TotalAmount:N2}");
                doc.TotalAmount = dto.TotalAmount.Value;
            }

            if (dto.SubTotal.HasValue && dto.SubTotal != doc.SubTotal)
            {
                changes.Add($"Sub Total: {doc.Currency} {doc.SubTotal:N2} -> {doc.Currency} {dto.SubTotal:N2}");
                doc.SubTotal = dto.SubTotal.Value;
            }

            if (dto.TaxAmount.HasValue && dto.TaxAmount != doc.TaxAmount)
            {
                changes.Add($"Tax Amount: {doc.Currency} {doc.TaxAmount:N2} -> {doc.Currency} {dto.TaxAmount:N2}");
                doc.TaxAmount = dto.TaxAmount.Value;
            }

            if (dto.TaxRate.HasValue && dto.TaxRate != doc.TaxRate)
            {
                changes.Add($"Tax Rate: {doc.TaxRate}% -> {dto.TaxRate}%");
                doc.TaxRate = dto.TaxRate.Value;
            }

            if (dto.IssueDate.HasValue) doc.IssueDate = dto.IssueDate.Value;
            if (dto.DueDate.HasValue) doc.DueDate = dto.DueDate.Value;
            if (!string.IsNullOrWhiteSpace(dto.TaxId)) doc.TaxId = dto.TaxId;

            var calculatedTax = Math.Round(doc.SubTotal * (doc.TaxRate / 100.0m), 2);
            if (Math.Abs(doc.TaxAmount - calculatedTax) <= 0.05m && doc.AiAnomalyDetected)
            {
                doc.AiAnomalyDetected = false;
                doc.AiAnomalyNotes = "Previously flagged tax anomaly was manually reviewed and verified by user.";
                changes.Add("Anomaly resolved via user manual reconciliation.");
            }

            doc.UpdatedAt = DateTime.UtcNow;

            var diffSummary = changes.Any() ? string.Join("; ", changes) : "Fields updated without major variance.";
            await _auditService.StageAsync(doc.Id, doc.DocumentNumber, "FieldEdited", actor.Id, actor.Name, actor.Role,
                $"Manual field correction: {diffSummary}. Reason: {dto.EditReason ?? "Data accuracy alignment"}");
            await DocumentWorkflowService.SaveAtomicAsync(_context);

            return Ok(DocumentDto.From(doc));
        }

        [HttpPost("{id}/reanalyze")]
        [Authorize(Roles = Roles.Submitters)]
        public async Task<ActionResult<DocumentDto>> ReAnalyzeDocument(Guid id)
        {
            var doc = await DocumentsWithChildren().FirstOrDefaultAsync(d => d.Id == id);
            if (doc == null) return NotFound(new { message = $"Document with ID {id} not found." });

            if (DocStatus.IsTerminal(doc.Status))
            {
                throw new InvalidOperationException($"Document {doc.DocumentNumber} is '{doc.Status}' and can no longer be re-analyzed.");
            }

            var expectedTax = Math.Round(doc.SubTotal * (doc.TaxRate / 100.0m), 2);
            var isDiscrepancy = Math.Abs(doc.TaxAmount - expectedTax) > 0.05m;

            doc.AiAnomalyDetected = isDiscrepancy;
            doc.AiAnomalyNotes = isDiscrepancy
                ? $"Tax calculation discrepancy: Stated {doc.TaxAmount:N2}, expected {expectedTax:N2} based on {doc.TaxRate}% rate."
                : null;
            doc.AiConfidenceScore = isDiscrepancy ? 0.85 : 0.98;
            doc.UpdatedAt = DateTime.UtcNow;

            await _auditService.StageAsync(doc.Id, doc.DocumentNumber, "ReAnalyzed", "sys-gemini-ai", "Gemini AI Engine", "AI Service",
                $"Re-analysis completed. Anomaly status: {(isDiscrepancy ? "FLAGGED" : "CLEAN")}. Requested by {User.Identity?.Name}.");
            await DocumentWorkflowService.SaveAtomicAsync(_context);

            return Ok(DocumentDto.From(doc));
        }

        private static Document BuildDocument(GeminiExtractionResult ai, string docNumber, ActorContext actor)
        {
            var docId = Guid.NewGuid();
            var now = DateTime.UtcNow;
            var document = new Document
            {
                Id = docId,
                DocumentNumber = docNumber,
                DocumentType = string.IsNullOrWhiteSpace(ai.DocumentType) ? "Invoice" : ai.DocumentType,
                VendorName = string.IsNullOrWhiteSpace(ai.VendorName) ? "Unspecified Vendor" : ai.VendorName,
                CustomerName = string.IsNullOrWhiteSpace(ai.CustomerName) ? "Enterprise Global Corp" : ai.CustomerName,
                TaxId = ai.TaxId,
                IssueDate = ai.IssueDate ?? now,
                DueDate = ai.DueDate ?? now.AddDays(30),
                SubTotal = ai.SubTotal,
                TaxRate = ai.TaxRate,
                TaxAmount = ai.TaxAmount,
                TotalAmount = ai.TotalAmount,
                Currency = string.IsNullOrWhiteSpace(ai.Currency) ? "USD" : ai.Currency,
                Status = DocStatus.PendingLevel1,
                CurrentApprovalLevel = 1,
                TotalApprovalLevels = 2,
                AiSummary = ai.ExecutiveSummary,
                AiAnomalyDetected = ai.AnomalyDetected,
                AiAnomalyNotes = ai.AnomalyNotes,
                AiConfidenceScore = ai.ConfidenceScore > 0 ? ai.ConfidenceScore : 0.95,
                UploadedByUserId = actor.Id,
                UploadedByUserName = actor.Name,
                CreatedAt = now,
                UpdatedAt = now
            };

            if (ai.LineItems != null && ai.LineItems.Any())
            {
                foreach (var item in ai.LineItems)
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
                    UnitPrice = ai.SubTotal,
                    Amount = ai.SubTotal
                });
            }

            document.ApprovalSteps.Add(new ApprovalStep { DocumentId = docId, StepNumber = 1, RoleRequired = Roles.Manager, Title = "Department Manager Review", Status = "Pending" });
            document.ApprovalSteps.Add(new ApprovalStep { DocumentId = docId, StepNumber = 2, RoleRequired = Roles.Finance, Title = "Finance Controller Approval", Status = "Pending" });
            return document;
        }

        private Task StageAiLog(Document document, GeminiExtractionResult ai, string anomalyPrefix, string cleanText)
        {
            var detail = ai.AnomalyDetected
                ? $"{anomalyPrefix}: {ai.AnomalyNotes}"
                : $"{cleanText}. Confidence: {document.AiConfidenceScore:P0}.";
            return _auditService.StageAsync(document.Id, document.DocumentNumber, "AiAnalyzed", "sys-gemini-ai", "Gemini AI Engine", "AI Service",
                $"Automated extraction completed. {detail}");
        }
    }
}
