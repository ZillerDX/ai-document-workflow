using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AiDocumentWorkflow.Api.Data;
using AiDocumentWorkflow.Api.Models;
using AiDocumentWorkflow.Api.Services;

namespace AiDocumentWorkflow.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuditLogsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AuditLogsController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<AuditLog>>> GetLogs([FromQuery] Guid? documentId, [FromQuery] string? search)
        {
            var query = _context.AuditLogs.AsQueryable();

            if (documentId.HasValue)
            {
                query = query.Where(a => a.DocumentId == documentId.Value);
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.ToLower();
                query = query.Where(a => (a.DocumentNumber != null && a.DocumentNumber.ToLower().Contains(s)) ||
                                         a.Action.ToLower().Contains(s) ||
                                         a.ActorName.ToLower().Contains(s) ||
                                         a.Details.ToLower().Contains(s));
            }

            var logs = await query.OrderByDescending(a => a.Timestamp).Take(100).ToListAsync();
            return Ok(logs);
        }

        [HttpGet("verify-integrity")]
        public async Task<ActionResult> VerifyIntegrity()
        {
            var logs = await _context.AuditLogs.OrderBy(a => a.Timestamp).ToListAsync();
            if (!logs.Any())
            {
                return Ok(new 
                { 
                    verified = true, 
                    count = 0, 
                    status = "EMPTY_LEDGER",
                    message = "Audit ledger is empty. 0 records to verify." 
                });
            }

            string expectedPrev = AuditService.GenesisHash;
            using var sha = SHA256.Create();

            for (int i = 0; i < logs.Count; i++)
            {
                var log = logs[i];

                // Check cryptographic linkage
                if (!string.IsNullOrEmpty(log.PreviousHash) && log.PreviousHash != expectedPrev)
                {
                    return Ok(new 
                    { 
                        verified = false, 
                        brokenAtIndex = i, 
                        recordId = log.Id, 
                        action = log.Action,
                        expectedPreviousHash = expectedPrev,
                        actualPreviousHash = log.PreviousHash,
                        status = "CHAIN_LINKAGE_BROKEN",
                        message = $"Cryptographic chain linkage mismatch detected at record index {i}." 
                    });
                }

                // Check content hash authenticity
                if (!string.IsNullOrEmpty(log.RecordHash))
                {
                    var computedHash = AuditService.ComputeRecordHash(
                        log.PreviousHash ?? AuditService.GenesisHash,
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

                    if (computedHash != log.RecordHash)
                    {
                        return Ok(new 
                        { 
                            verified = false, 
                            brokenAtIndex = i, 
                            recordId = log.Id, 
                            action = log.Action,
                            status = "RECORD_CONTENT_TAMPERED",
                            message = $"Cryptographic content tampering detected at record {log.Id}." 
                        });
                    }

                    expectedPrev = log.RecordHash;
                }
            }

            return Ok(new 
            { 
                verified = true, 
                count = logs.Count, 
                genesisHash = logs.First().PreviousHash, 
                latestHash = logs.Last().RecordHash, 
                algorithm = "SHA-256", 
                status = "CRYPTOGRAPHICALLY_VERIFIED",
                verifiedAt = DateTime.UtcNow
            });
        }
    }
}
