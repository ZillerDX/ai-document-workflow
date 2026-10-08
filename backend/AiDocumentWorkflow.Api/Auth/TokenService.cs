using System;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace AiDocumentWorkflow.Api.Auth
{
    public class JwtOptions
    {
        public string Issuer { get; set; } = "aegisflow-demo";
        public string Audience { get; set; } = "aegisflow-client";
        public int LifetimeMinutes { get; set; } = 60;
        public SymmetricSecurityKey SigningKey { get; set; } = null!;
    }

    public class TokenService
    {
        private readonly JwtOptions _options;

        public TokenService(JwtOptions options) => _options = options;

        public (string Token, DateTime ExpiresAt) Issue(DemoPersona persona)
        {
            var expires = DateTime.UtcNow.AddMinutes(_options.LifetimeMinutes);
            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, persona.Id),
                new Claim(ClaimTypes.Name, persona.Name),
                new Claim(ClaimTypes.Role, persona.Role),
            };
            var token = new JwtSecurityToken(
                _options.Issuer, _options.Audience, claims,
                expires: expires,
                signingCredentials: new SigningCredentials(_options.SigningKey, SecurityAlgorithms.HmacSha256));
            return (new JwtSecurityTokenHandler().WriteToken(token), expires);
        }
    }
}
