using System;
using System.IO;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using AiDocumentWorkflow.Api.Auth;
using AiDocumentWorkflow.Api.Controllers;
using AiDocumentWorkflow.Api.Data;
using AiDocumentWorkflow.Api.Models;
using AiDocumentWorkflow.Api.Services;
using Xunit;

namespace AiDocumentWorkflow.Tests
{
    public class SecurityAndIntegrityTests
    {
        private static DocumentWorkflowService Workflow(AppDbContext c) => new(c, new AuditService(c));
        private static WorkflowActionDto Approve() => new() { Action = "Approve" };
        private static bool Verified(IActionResult r) =>
            (bool)((OkObjectResult)r).Value!.GetType().GetProperty("verified")!.GetValue(((OkObjectResult)r).Value)!;

        // ---- Findings 1/2: identity and Segregation of Duties ----------------------------------

        [Fact]
        public async Task Admin_Role_Has_No_Bypass()
        {
            using var db = new SqliteDb();
            using var c = db.NewContext();
            var d = TestData.NewDocument(); c.Documents.Add(d); await c.SaveChangesAsync();
            await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
                Workflow(c).ProcessActionAsync(d.Id, Approve(), new ActorContext("x", "X", "Admin")));
        }

        [Fact]
        public async Task Submitter_Cannot_Decide_Own_Document()
        {
            using var db = new SqliteDb();
            using var c = db.NewContext();
            var d = TestData.NewDocument(uploader: "usr-mgr-01"); c.Documents.Add(d); await c.SaveChangesAsync();
            var ex = await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
                Workflow(c).ProcessActionAsync(d.Id, Approve(), new ActorContext("usr-mgr-01", "Sarah", Roles.Manager)));
            Assert.Contains("Segregation of Duties", ex.Message);
        }

        [Fact]
        public async Task Same_Person_Cannot_Decide_Both_Levels()
        {
            using var db = new SqliteDb();
            using var c = db.NewContext();
            var d = TestData.NewDocument(); c.Documents.Add(d); await c.SaveChangesAsync();
            await Workflow(c).ProcessActionAsync(d.Id, Approve(), new ActorContext("shared-id", "Pat", Roles.Manager));
            var ex = await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
                Workflow(c).ProcessActionAsync(d.Id, Approve(), new ActorContext("shared-id", "Pat", Roles.Finance)));
            Assert.Contains("both approval levels", ex.Message);
        }

        [Fact]
        public void ActorContext_Requires_All_Claims()
        {
            var partial = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim(ClaimTypes.Role, Roles.Manager) }, "test"));
            Assert.Throws<UnauthorizedAccessException>(() => ActorContext.FromPrincipal(partial));
        }

        [Fact]
        public void Demo_Token_Carries_Server_Side_Persona_Claims()
        {
            var key = new SymmetricSecurityKey(Enumerable.Range(1, 32).Select(i => (byte)i).ToArray());
            var token = new TokenService(new JwtOptions { SigningKey = key }).Issue(DemoPersonas.Find("usr-fin-01")!).Token;
            var jwt = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler().ReadJwtToken(token);
            Assert.Contains(jwt.Claims, c => c.Value == Roles.Finance);
            Assert.Null(DemoPersonas.Find("admin"));
        }

        // ---- Finding 3: locked fields ----------------------------------------------------------

        [Theory]
        [InlineData(DocStatus.Approved)]
        [InlineData(DocStatus.Rejected)]
        [InlineData(DocStatus.PendingLevel2)]
        public async Task Fields_Are_Locked_Once_Level1_Is_Decided(string status)
        {
            using var db = new SqliteDb();
            using var c = db.NewContext();
            var d = TestData.NewDocument(status, status == DocStatus.PendingLevel2 ? 2 : 3); c.Documents.Add(d); await c.SaveChangesAsync();
            var ctl = new DocumentsController(c, null!, new AuditService(c)).WithUser("usr-staff-01", "Elena", Roles.Staff);
            await Assert.ThrowsAsync<InvalidOperationException>(() => ctl.UpdateDocument(d.Id, new UpdateDocumentDto { TotalAmount = 1 }));
            Assert.Equal(110m, (await c.Documents.AsNoTracking().FirstAsync(x => x.Id == d.Id)).TotalAmount);
        }

        [Fact]
        public async Task Partial_Update_Does_Not_Zero_Omitted_Amounts()
        {
            using var db = new SqliteDb();
            using var c = db.NewContext();
            var d = TestData.NewDocument(); c.Documents.Add(d); await c.SaveChangesAsync();
            var ctl = new DocumentsController(c, null!, new AuditService(c)).WithUser("usr-staff-01", "Elena", Roles.Staff);
            await ctl.UpdateDocument(d.Id, new UpdateDocumentDto { VendorName = "New Vendor" });
            var saved = await c.Documents.AsNoTracking().FirstAsync(x => x.Id == d.Id);
            Assert.Equal("New Vendor", saved.VendorName);
            Assert.Equal(110m, saved.TotalAmount);
            Assert.Equal(100m, saved.SubTotal);
        }

        [Fact]
        public async Task Stale_Version_Is_Rejected_On_Update()
        {
            using var db = new SqliteDb();
            using var c = db.NewContext();
            var d = TestData.NewDocument(); c.Documents.Add(d); await c.SaveChangesAsync();
            var ctl = new DocumentsController(c, null!, new AuditService(c)).WithUser("usr-staff-01", "Elena", Roles.Staff);
            await Assert.ThrowsAsync<ConflictException>(() => ctl.UpdateDocument(d.Id, new UpdateDocumentDto { VendorName = "x", Version = 99 }));
        }

        // ---- Findings 4/5: audit chain and concurrency ------------------------------------------

        [Fact]
        public async Task Seeded_Chain_Has_Unique_Sequences_And_Stays_Valid_After_New_Log()
        {
            using var db = new SqliteDb();
            using var c = db.NewContext();
            c.SeedInitialData();
            Assert.Equal(c.AuditLogs.Count(), c.AuditLogs.Select(a => a.Sequence).Distinct().Count());

            await new AuditService(c).StageAsync(null, null, "Test", "u", "U", Roles.Staff, "after seed");
            await c.SaveChangesAsync();

            var ctl = new AuditLogsController(c).WithUser("usr-audit-01", "Morgan", Roles.Auditor);
            Assert.True(Verified(await ctl.VerifyIntegrity()));
        }

        [Fact]
        public async Task Tampering_With_ActorName_Is_Detected()
        {
            using var db = new SqliteDb();
            using var c = db.NewContext();
            await new AuditService(c).StageAsync(null, null, "A", "u", "Alice", Roles.Staff, "d");
            await c.SaveChangesAsync();
            await c.Database.ExecuteSqlRawAsync("UPDATE AuditLogs SET ActorName = 'Mallory'");

            using var fresh = db.NewContext(); // new context: the first one still tracks the untampered entity
            var ctl = new AuditLogsController(fresh).WithUser("usr-audit-01", "Morgan", Roles.Auditor);
            Assert.False(Verified(await ctl.VerifyIntegrity()));
        }

        [Fact]
        public async Task Second_Approval_On_Already_Decided_Level_Cannot_Win_And_Writes_No_Audit()
        {
            using var db = new SqliteDb();
            using var seed = db.NewContext();
            var d = TestData.NewDocument(); seed.Documents.Add(d); await seed.SaveChangesAsync();

            using var first = db.NewContext();
            using var second = db.NewContext();
            var manager = new ActorContext("usr-mgr-01", "Sarah", Roles.Manager);

            // `second` loads the document before `first` commits, via a stale-version request.
            await Workflow(first).ProcessActionAsync(d.Id, Approve(), manager);
            await Assert.ThrowsAsync<ConflictException>(() =>
                Workflow(second).ProcessActionAsync(d.Id, new WorkflowActionDto { Action = "Approve", Version = 0 }, manager));

            using var verify = db.NewContext();
            Assert.Equal(1, await verify.AuditLogs.CountAsync(l => l.Action == "ApprovedLevel1"));
            Assert.Equal(DocStatus.PendingLevel2, (await verify.Documents.FirstAsync(x => x.Id == d.Id)).Status);
        }

        [Fact]
        public async Task Concurrent_Writers_Of_The_Same_Document_Cannot_Both_Commit()
        {
            using var db = new SqliteDb();
            using var seed = db.NewContext();
            var d = TestData.NewDocument(); seed.Documents.Add(d); await seed.SaveChangesAsync();

            using var first = db.NewContext();
            using var second = db.NewContext();
            var stale = await second.Documents.FirstAsync(x => x.Id == d.Id); // loaded before the first writer commits

            await Workflow(first).ProcessActionAsync(d.Id, Approve(), new ActorContext("usr-mgr-01", "Sarah", Roles.Manager));

            stale.Status = DocStatus.Rejected;
            await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => second.SaveChangesAsync());
        }

        // ---- Finding 7: upload validation --------------------------------------------------------

        [Fact]
        public async Task Upload_Rejects_Unsupported_Types_And_Oversize_Files()
        {
            using var db = new SqliteDb();
            using var c = db.NewContext();
            var ctl = new DocumentsController(c, null!, new AuditService(c)).WithUser("usr-staff-01", "Elena", Roles.Staff);

            var exe = new FormFile(new MemoryStream(new byte[] { 1, 2, 3 }), 0, 3, "file", "evil.exe") { Headers = new HeaderDictionary(), ContentType = "application/x-msdownload" };
            Assert.Equal(StatusCodes.Status415UnsupportedMediaType, ((ObjectResult)(await ctl.UploadDocument(exe)).Result!).StatusCode);

            var big = new FormFile(new MemoryStream(new byte[1]), 0, DocumentsController.MaxUploadBytes + 1, "file", "big.pdf") { Headers = new HeaderDictionary(), ContentType = "application/pdf" };
            Assert.Equal(StatusCodes.Status413PayloadTooLarge, ((ObjectResult)(await ctl.UploadDocument(big)).Result!).StatusCode);
        }

        // ---- Visibility ---------------------------------------------------------------------------

        [Fact]
        public async Task Staff_Cannot_Read_Full_Ledger_But_Can_Read_One_Document_History()
        {
            using var db = new SqliteDb();
            using var c = db.NewContext();
            var ctl = new AuditLogsController(c).WithUser("usr-staff-01", "Elena", Roles.Staff);
            Assert.Equal(StatusCodes.Status403Forbidden, ((ObjectResult)(await ctl.GetLogs(null, null)).Result!).StatusCode);
            Assert.IsType<OkObjectResult>((await ctl.GetLogs(Guid.NewGuid(), null)).Result);
        }

        [Fact]
        public async Task Staff_Dashboard_Hides_Financial_Totals()
        {
            using var db = new SqliteDb();
            using var c = db.NewContext();
            c.SeedInitialData();
            var ctl = new StatsController(c).WithUser("usr-staff-01", "Elena", Roles.Staff);
            var stats = (DashboardStatsDto)((OkObjectResult)(await ctl.GetStats()).Result!).Value!;
            Assert.Equal(0m, stats.TotalApprovedSpend);
            Assert.Equal(0m, stats.TotalPendingSpend);
        }
    }
}
