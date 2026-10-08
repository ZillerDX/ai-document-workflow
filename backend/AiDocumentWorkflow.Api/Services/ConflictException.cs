using System;

namespace AiDocumentWorkflow.Api.Services
{
    /// <summary>Raised when a write loses an optimistic-concurrency race; maps to HTTP 409.</summary>
    public class ConflictException : Exception
    {
        public ConflictException(string message, Exception? inner = null) : base(message, inner) { }
    }
}
