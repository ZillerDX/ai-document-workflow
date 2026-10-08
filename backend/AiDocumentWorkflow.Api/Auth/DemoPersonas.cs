using System;
using System.Collections.Generic;
using System.Linq;
using AiDocumentWorkflow.Api.Models;

namespace AiDocumentWorkflow.Api.Auth
{
    public record DemoPersona(string Id, string Name, string Role, string Title);

    /// <summary>Seeded demo identities. This is NOT production authentication.</summary>
    public static class DemoPersonas
    {
        public static readonly IReadOnlyList<DemoPersona> All = new[]
        {
            new DemoPersona("usr-staff-01", "Elena Vance", Roles.Staff, "Systems Administrator"),
            new DemoPersona("usr-mgr-01", "Sarah Connor", Roles.Manager, "Operations Director"),
            new DemoPersona("usr-fin-01", "David Sterling", Roles.Finance, "Chief Financial Officer"),
            new DemoPersona("usr-audit-01", "Morgan Hayes", Roles.Auditor, "Senior Compliance Auditor"),
        };

        public static DemoPersona? Find(string? id) =>
            All.FirstOrDefault(p => string.Equals(p.Id, id, StringComparison.Ordinal));
    }
}
