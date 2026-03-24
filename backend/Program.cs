using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddAuthorization();

builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendDev", policy =>
    {
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

if (builder.Environment.IsDevelopment())
{
    builder.Services
        .AddAuthentication("DevHeader")
        .AddScheme<AuthenticationSchemeOptions, DevHeaderAuthenticationHandler>("DevHeader", _ => { });
}

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();

app.UseCors("FrontendDev");

if (app.Environment.IsDevelopment())
{
    app.UseAuthentication();
}

app.UseAuthorization();

app.MapGet("/api/v1/health", () => Results.Ok(new
{
    status = "healthy",
    service = "backend",
    version = "v1",
    timestampUtc = DateTime.UtcNow
}))
.WithName("Health");

app.MapGet("/api/v1/admin/health", [Authorize] () => Results.Ok(new
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

sealed class DevHeaderAuthenticationHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    private const string DevTokenHeaderName = "X-Dev-Token";
    private const string DevTokenValue = "dev-admin-token";

    public DevHeaderAuthenticationHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder)
        : base(options, logger, encoder)
    {
    }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue(DevTokenHeaderName, out var token))
        {
            return Task.FromResult(AuthenticateResult.NoResult());
        }

        if (!string.Equals(token.ToString(), DevTokenValue, StringComparison.Ordinal))
        {
            return Task.FromResult(AuthenticateResult.Fail("Invalid dev token."));
        }

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