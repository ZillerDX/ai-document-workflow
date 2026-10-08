namespace AiDocumentWorkflow.Api.Models
{
    public static class Roles
    {
        public const string Staff = "Staff";
        public const string Manager = "Manager";
        public const string Finance = "Finance";
        public const string Auditor = "Auditor";

        public const string Submitters = Staff + "," + Manager + "," + Finance;
        public const string LedgerReaders = Manager + "," + Finance + "," + Auditor;
    }

    public static class DocStatus
    {
        public const string PendingLevel1 = "PendingLevel1";
        public const string PendingLevel2 = "PendingLevel2";
        public const string Approved = "Approved";
        public const string Rejected = "Rejected";
        public const string RevisionRequested = "RevisionRequested";

        public static bool IsTerminal(string status) => status == Approved || status == Rejected;
    }
}
