using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddAuthorization();

if (builder.Environment.IsDevelopment())
{
    builder.Services
        .AddAuthentication("Dev")
        .AddScheme<AuthenticationSchemeOptions, DevAuthenticationHandler>("Dev", _ => { });
}

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();

if (app.Environment.IsDevelopment())
{
    app.UseAuthentication();
}

app.UseAuthorization();

var api = app.MapGroup("/api/v1");

api.MapGet("/health", () => Results.Ok(new
{
    status = "healthy",
    service = "backend",
    version = "v1",
    timestampUtc = DateTime.UtcNow
}))
.WithName("Health");

var adminApi = api.MapGroup("/admin")
    .RequireAuthorization();

adminApi.MapGet("/health", () => Results.Ok(new
{
    status = "healthy",
    service = "backend",
    area = "admin",
    version = "v1",
    timestampUtc = DateTime.UtcNow
}))
.WithName("AdminHealth");

app.MapGet("/", () => new
{
    message = "Backend API running!",
});

app.Run();

sealed class DevAuthenticationHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public DevAuthenticationHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder)
        : base(options, logger, encoder)
    {
    }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, "dev-user"),
            new Claim(ClaimTypes.Name, "Development User"),
            new Claim(ClaimTypes.Role, "Admin"),
        };

        var identity = new ClaimsIdentity(claims, Scheme.Name);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, Scheme.Name);

        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
