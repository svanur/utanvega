using System.Security.Claims;
using System.Text.Encodings.Web;
using Utanvega.Backend.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;

using Microsoft.EntityFrameworkCore;

using Utanvega.Backend.Application.Trails.Commands.CreateTrailFromGpx;
using MediatR;

var builder = WebApplication.CreateBuilder(args);

// Add Database with PostGIS
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") 
    ?? builder.Configuration["DATABASE_URL"];

if (builder.Environment.IsDevelopment())
{
    Console.WriteLine($"[DEBUG_LOG] Using ConnectionString starting with: {connectionString?.Substring(0, Math.Min(connectionString.Length, 15))}...");
}

builder.Services.AddDbContext<UtanvegaDbContext>(options =>
    options.UseNpgsql(connectionString, o => o.UseNetTopologySuite()));

// Add CQRS with MediatR
builder.Services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(Program).Assembly));

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddAuthorization();

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        var allowedOrigins = builder.Configuration.GetSection("AllowedOrigins").Get<string[]>() ?? ["http://localhost:5173"];
        policy.WithOrigins(allowedOrigins)
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

app.UseCors("Frontend");

if (app.Environment.IsDevelopment())
{
    app.UseAuthentication();
}

app.UseAuthorization();

// Auto-migration on startup (optional, but helpful for initial setup)
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<UtanvegaDbContext>();
    // We don't call Migrate() here yet because we need to generate migrations first
    // but the setup is ready.
}

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

app.MapPost("/api/v1/admin/trails/upload-gpx", [Authorize] async (string name, IFormFile file, IMediator mediator) =>
{
    if (file == null || file.Length == 0) return Results.BadRequest("No file uploaded.");
    
    using var reader = new StreamReader(file.OpenReadStream());
    var gpxXml = await reader.ReadToEndAsync();
    
    var command = new CreateTrailFromGpxCommand(name, gpxXml);
    var trailId = await mediator.Send(command);
    
    return Results.Created($"/api/v1/admin/trails/{trailId}", new { id = trailId });
})
.WithName("UploadGpx")
.DisableAntiforgery(); // Simple for dev, adjust for prod security

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