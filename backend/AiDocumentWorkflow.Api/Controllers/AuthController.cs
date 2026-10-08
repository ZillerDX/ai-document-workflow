using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using AiDocumentWorkflow.Api.Auth;

namespace AiDocumentWorkflow.Api.Controllers
{
    public record DemoLoginRequest(string? PersonaId);

    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private readonly TokenService _tokens;
        private readonly IConfiguration _config;

        public AuthController(TokenService tokens, IConfiguration config)
        {
            _tokens = tokens;
            _config = config;
        }

        [AllowAnonymous]
        [HttpGet("personas")]
        public IActionResult Personas()
        {
            if (!_config.GetValue("Auth:EnableDemoLogin", false)) return NotFound();
            return Ok(DemoPersonas.All);
        }

        /// <summary>Demo-only login: issues a JWT for a seeded persona. Not production authentication.</summary>
        [AllowAnonymous]
        [HttpPost("demo-login")]
        public IActionResult DemoLogin([FromBody] DemoLoginRequest request)
        {
            if (!_config.GetValue("Auth:EnableDemoLogin", false))
            {
                return NotFound();
            }

            var persona = DemoPersonas.Find(request.PersonaId);
            if (persona == null)
            {
                return BadRequest(new { message = "Unknown demo persona." });
            }

            var (token, expiresAt) = _tokens.Issue(persona);
            return Ok(new { token, expiresAt, user = persona });
        }
    }
}
