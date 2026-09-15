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
        Task LogAsync(Guid? documentId, string? docNumber, string action, string actorId, string actorName, string actorRole, string details, string? prevValue = null, string? newValue = null);
    }

    public class AuditService : IAuditService
    {
        public const string GenesisHash = "0000000000000000000000000000000000000000000000000000000000000000";
        private readonly AppDbContext _context;

        public AuditService(AppDbContext context)
        {
            _context = context;
        }

        public static string ComputeRecordHash(string prevHash, DateTime timestamp, Guid? docId, string? docNumber, string action, string actorId, string actorRole, string details, string? prevValue, string? newValue)
        {
            var utcTimestamp = timestamp.Kind == DateTimeKind.Utc
                ? timestamp
                : DateTime.SpecifyKind(timestamp, DateTimeKind.Utc);
            var ts = utcTimestamp.ToString("yyyy-MM-ddTHH:mm:ssZ");
            var raw = $"{prevHash}|{ts}|{docId}|{docNumber}|{action}|{actorId}|{actorRole}|{details}|{prevValue}|{newValue}";
            using var sha = SHA256.Create();
            return Convert.ToHexString(sha.ComputeHash(Encoding.UTF8.GetBytes(raw))).ToLowerInvariant();
        }

        public async Task LogAsync(Guid? documentId, string? docNumber, string action, string actorId, string actorName, string actorRole, string details, string? prevValue = null, string? newValue = null)
        {
            var latestLog = await _context.AuditLogs.OrderByDescending(a => a.Timestamp).FirstOrDefaultAsync();
            var prevHash = latestLog?.RecordHash ?? GenesisHash;
            var now = DateTime.UtcNow;
            var timestamp = new DateTime(now.Year, now.Month, now.Day, now.Hour, now.Minute, now.Second, DateTimeKind.Utc);

            var recordHash = ComputeRecordHash(prevHash, timestamp, documentId, docNumber, action, actorId, actorRole, details, prevValue, newValue);

            var log = new AuditLog
            {
                Id = Guid.NewGuid(),
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
            };

            _context.AuditLogs.Add(log);
            await _context.SaveChangesAsync();
        }
    }
}
