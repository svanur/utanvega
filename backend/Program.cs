using System.Security.Claims;
using System.Text.Encodings.Web;
using Utanvega.Backend.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;

using Microsoft.EntityFrameworkCore;

using Utanvega.Backend.Application.Trails.Commands.CreateTrailFromGpx;
using Utanvega.Backend.Application.Trails.Commands.UpdateTrail;
using Utanvega.Backend.Application.Trails.Commands.DeleteTrail;
using Utanvega.Backend.Application.Trails.Queries.GetTrails;
using Utanvega.Backend.Application.Trails.Queries.GetTrailGeometry;
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

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
});
builder.Services.Configure<Microsoft.AspNetCore.Mvc.JsonOptions>(options =>
{
    options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
});

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
    db.Database.Migrate();
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

app.MapGet("/api/v1/admin/trails", [Authorize] async (IMediator mediator) =>
{
    var trails = await mediator.Send(new GetTrailsQuery());
    return Results.Ok(trails);
})
.WithName("GetTrails");

app.MapGet("/api/v1/admin/trails/{id}", [Authorize] async (Guid id, UtanvegaDbContext context) =>
{
    var trail = await context.Trails
        .AsNoTracking()
        .Select(t => new
        {
            t.Id,
            t.Name,
            t.Slug,
            t.Description,
            t.ActivityTypeId,
            t.Status,
            t.Difficulty,
            t.Visibility,
            t.Length,
            t.ElevationGain,
            t.ElevationLoss
        })
        .FirstOrDefaultAsync(t => t.Id == id);
    return trail != null ? Results.Ok(trail) : Results.NotFound();
})
.WithName("GetTrailById");

app.MapPut("/api/v1/admin/trails/{id}", [Authorize] async (Guid id, UpdateTrailCommand command, IMediator mediator) =>
{
    if (id != command.Id) return Results.BadRequest("ID mismatch");
    var success = await mediator.Send(command);
    return success ? Results.NoContent() : Results.NotFound();
})
.WithName("UpdateTrail");

app.MapDelete("/api/v1/admin/trails/{id}", [Authorize] async (Guid id, IMediator mediator) =>
{
    var success = await mediator.Send(new DeleteTrailCommand(id));
    return success ? Results.NoContent() : Results.NotFound();
})
.WithName("DeleteTrail");

app.MapGet("/api/v1/admin/trails/{id}/geometry", [Authorize] async (Guid id, IMediator mediator) =>
{
    var geoJson = await mediator.Send(new GetTrailGeometryQuery(id));
    return geoJson != null ? Results.Content(geoJson, "application/json") : Results.NotFound();
})
.WithName("GetTrailGeometry");

app.MapPost("/api/v1/admin/trails/upload-gpx", [Authorize] async (string name, IFormFile file, IMediator mediator) =>
{
    if (file == null || file.Length == 0) return Results.BadRequest("No file uploaded.");
    
    using var reader = new StreamReader(file.OpenReadStream());
    var gpxXml = await reader.ReadToEndAsync();
    
    try 
    {
        var command = new CreateTrailFromGpxCommand(name, gpxXml);
        var trailId = await mediator.Send(command);
        return Results.Created($"/api/v1/admin/trails/{trailId}", new { id = trailId });
    }
    catch (Exception ex)
    {
        return Results.Problem(ex.Message);
    }
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