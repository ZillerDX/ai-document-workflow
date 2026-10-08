using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using AiDocumentWorkflow.Api.Auth;
using AiDocumentWorkflow.Api.Data;
using AiDocumentWorkflow.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// Load local private configuration (gitignored)
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true);

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
        options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    });

builder.Services.AddDbContext<AppDbContext>(options =>
{
    var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") ?? "Data Source=workflow.db";
    options.UseSqlite(connectionString);
});

builder.Services.AddHttpClient<IGeminiDocumentService, GeminiDocumentService>();
builder.Services.AddScoped<IDocumentWorkflowService, DocumentWorkflowService>();
builder.Services.AddScoped<IAuditService, AuditService>();

// --- Demo authentication (JWT issued by /api/auth/demo-login; NOT production auth) ---
// The signing key comes from configuration (env var Auth__JwtKey). In Development a random per-process key
// is generated when none is configured; in any other environment a missing key stops the app at startup.
var jwtKeyText = builder.Configuration["Auth:JwtKey"];
if (string.IsNullOrWhiteSpace(jwtKeyText))
{
    if (!builder.Environment.IsDevelopment() && !builder.Environment.IsEnvironment("Testing"))
    {
        throw new InvalidOperationException("Auth:JwtKey must be configured (env var Auth__JwtKey, at least 32 characters).");
    }
    jwtKeyText = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
}
else if (jwtKeyText.Length < 32)
{
    throw new InvalidOperationException("Auth:JwtKey must be at least 32 characters.");
}

var jwtOptions = new JwtOptions { SigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKeyText)) };
builder.Services.AddSingleton(jwtOptions);
builder.Services.AddSingleton<TokenService>();
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = jwtOptions.Issuer,
            ValidAudience = jwtOptions.Audience,
            IssuerSigningKey = jwtOptions.SigningKey,
            ValidateIssuerSigningKey = true,
            ClockSkew = TimeSpan.FromSeconds(30),
            NameClaimType = System.Security.Claims.ClaimTypes.Name,
            RoleClaimType = System.Security.Claims.ClaimTypes.Role
        };
    });
builder.Services.AddAuthorization();

// CORS: explicit allowlist from configuration (Cors:AllowedOrigins), never "any origin".
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
                     ?? new[] { "http://localhost:4200", "http://localhost:4280", "https://zillerdx.github.io" };
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
        policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod());
});

builder.Services.AddOpenApi();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    if (db.Database.IsRelational())
    {
        db.Database.Migrate();
    }
    else
    {
        db.Database.EnsureCreated();
    }
    db.SeedInitialData();
}

app.UseMiddleware<ExceptionMappingMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

public partial class Program;
