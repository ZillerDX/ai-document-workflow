using System.Security.Claims;

namespace AiDocumentWorkflow.Api.Auth
{
    /// <summary>Authenticated caller identity, always derived from JWT claims, never from a request body.</summary>
    public record ActorContext(string Id, string Name, string Role)
    {
        public static ActorContext FromPrincipal(ClaimsPrincipal user)
        {
            var id = user.FindFirstValue(ClaimTypes.NameIdentifier);
            var name = user.FindFirstValue(ClaimTypes.Name);
            var role = user.FindFirstValue(ClaimTypes.Role);
            if (string.IsNullOrWhiteSpace(id) || string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(role))
            {
                throw new UnauthorizedAccessException("Authenticated identity is missing required claims.");
            }
            return new ActorContext(id, name, role);
        }
    }
}
