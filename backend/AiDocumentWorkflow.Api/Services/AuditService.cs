using System;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using AiDocumentWorkflow.Api.Data;
using AiDocumentWorkflow.Api.Models;

namespace AiDocumentWorkflow.Api.Services
{
    public interface IAuditService
    {
        /// <summary>
        /// Appends a hash-chained record to the change tracker. It does NOT save: the caller saves once,
        /// so the business change and its audit record commit atomically.
        /// </summary>
        Task StageAsync(Guid? documentId, string? docNumber, string action, string actorId, string actorName, string actorRole, string details, string? prevValue = null, string? newValue = null);
    }

    public class AuditService : IAuditService
    {
        public const string GenesisHash = "0000000000000000000000000000000000000000000000000000000000000000";
        private readonly AppDbContext _context;

        public AuditService(AppDbContext context)
        {
            _context = context;
        }

        public static string ComputeRecordHash(string prevHash, DateTime timestamp, Guid? docId, string? docNumber, string action, string actorId, string actorName, string actorRole, string details, string? prevValue, string? newValue)
        {
            var utcTimestamp = timestamp.Kind == DateTimeKind.Utc
                ? timestamp
                : DateTime.SpecifyKind(timestamp, DateTimeKind.Utc);
            var ts = utcTimestamp.ToString("yyyy-MM-ddTHH:mm:ssZ");
            var raw = $"{prevHash}|{ts}|{docId}|{docNumber}|{action}|{actorId}|{actorName}|{actorRole}|{details}|{prevValue}|{newValue}";
            return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(raw))).ToLowerInvariant();
        }

        public async Task StageAsync(Guid? documentId, string? docNumber, string action, string actorId, string actorName, string actorRole, string details, string? prevValue = null, string? newValue = null)
        {
            // Chain head = highest Sequence among already-staged (unsaved) logs, else the persisted head.
            var latestLog = _context.AuditLogs.Local.OrderByDescending(a => a.Sequence).FirstOrDefault()
                            ?? await _context.AuditLogs.OrderByDescending(a => a.Sequence).FirstOrDefaultAsync();
            var prevHash = latestLog?.RecordHash ?? GenesisHash;
            var nextSeq = (latestLog?.Sequence ?? 0) + 1;
            var now = DateTime.UtcNow;
            var timestamp = new DateTime(now.Year, now.Month, now.Day, now.Hour, now.Minute, now.Second, DateTimeKind.Utc);

            var recordHash = ComputeRecordHash(prevHash, timestamp, documentId, docNumber, action, actorId, actorName, actorRole, details, prevValue, newValue);

            _context.AuditLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(),
                Sequence = nextSeq,
                DocumentId = documentId,
                DocumentNumber = docNumber,
                Action = action,
                ActorId = actorId,
                ActorName = actorName,
                ActorRole = actorRole,
                Details = details,
                PreviousValue = prevValue,
                NewValue = newValue,
                Timestamp = timestamp,
                PreviousHash = prevHash,
                RecordHash = recordHash
            });
        }
    }
}
