using System;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using AiDocumentWorkflow.Api.Data;
using AiDocumentWorkflow.Api.Models;

namespace AiDocumentWorkflow.Tests
{
    /// <summary>SQLite in-memory database: unlike the EF InMemory provider it enforces unique indexes and concurrency tokens.</summary>
    public sealed class SqliteDb : IDisposable
    {
        private readonly SqliteConnection _connection = new("DataSource=:memory:");

        public SqliteDb()
        {
            _connection.Open();
            using var ctx = NewContext();
            ctx.Database.EnsureCreated();
        }

        public AppDbContext NewContext() =>
            new(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_connection).Options);

        public void Dispose() => _connection.Dispose();
    }

    public static class TestData
    {
        public static Document NewDocument(string status = DocStatus.PendingLevel1, int level = 1, string uploader = "usr-staff-01")
        {
            var id = Guid.NewGuid();
            var doc = new Document
            {
                Id = id,
                DocumentNumber = "T-" + id.ToString("N")[..6],
                Status = status,
                CurrentApprovalLevel = level,
                UploadedByUserId = uploader,
                UploadedByUserName = "Uploader",
                SubTotal = 100m,
                TaxRate = 10m,
                TaxAmount = 10m,
                TotalAmount = 110m,
                Currency = "USD"
            };
            doc.ApprovalSteps.Add(new ApprovalStep { DocumentId = id, StepNumber = 1, RoleRequired = Roles.Manager, Status = level > 1 ? "Approved" : "Pending", ApproverUserId = level > 1 ? "usr-mgr-01" : null });
            doc.ApprovalSteps.Add(new ApprovalStep { DocumentId = id, StepNumber = 2, RoleRequired = Roles.Finance, Status = "Pending" });
            return doc;
        }

        public static T WithUser<T>(this T controller, string id, string name, string role) where T : ControllerBase
        {
            var identity = new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, id), new Claim(ClaimTypes.Name, name), new Claim(ClaimTypes.Role, role)
            }, "test", ClaimTypes.Name, ClaimTypes.Role);
            controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) } };
            return controller;
        }
    }
}
