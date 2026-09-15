using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AiDocumentWorkflow.Api.Data;
using AiDocumentWorkflow.Api.Models;

namespace AiDocumentWorkflow.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class StatsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public StatsController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<DashboardStatsDto>> GetStats()
        {
            var docs = await _context.Documents.ToListAsync();

            var totalDocs = docs.Count;
            var pendingDocs = docs.Count(d => d.Status == "PendingLevel1" || d.Status == "PendingLevel2");
            var approvedDocs = docs.Count(d => d.Status == "Approved");
            var rejectedDocs = docs.Count(d => d.Status == "Rejected");
            var anomalyCount = docs.Count(d => d.AiAnomalyDetected);

            var decidedTotal = approvedDocs + rejectedDocs;
            var approvalRate = decidedTotal > 0 ? Math.Round(((double)approvedDocs / decidedTotal) * 100.0, 1) : 100.0;

            var approvedSpend = docs.Where(d => d.Status == "Approved").Sum(d => d.TotalAmount);
            var pendingSpend = docs.Where(d => d.Status == "PendingLevel1" || d.Status == "PendingLevel2").Sum(d => d.TotalAmount);

            var recentLogs = await _context.AuditLogs
                .OrderByDescending(a => a.Timestamp)
                .Take(7)
                .Select(a => new RecentActivityDto
                {
                    Id = a.Id,
                    Action = a.Action,
                    ActorName = a.ActorName,
                    ActorRole = a.ActorRole,
                    Details = a.Details,
                    Timestamp = a.Timestamp,
                    DocumentNumber = a.DocumentNumber
                })
                .ToListAsync();

            return Ok(new DashboardStatsDto
            {
                TotalDocuments = totalDocs,
                PendingApprovals = pendingDocs,
                ApprovedDocuments = approvedDocs,
                RejectedDocuments = rejectedDocs,
                AnomalyCount = anomalyCount,
                ApprovalRatePercentage = approvalRate,
                TotalApprovedSpend = approvedSpend,
                TotalPendingSpend = pendingSpend,
                RecentActivities = recentLogs
            });
        }
    }
}
