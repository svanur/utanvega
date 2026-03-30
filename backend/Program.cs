using System.Security.Claims;
using System.Text.Encodings.Web;
using Utanvega.Backend.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;

using Microsoft.EntityFrameworkCore;

using Utanvega.Backend.Application.Trails.Commands.CreateTrailFromGpx;
using Utanvega.Backend.Application.Trails.Commands.BulkCreateTrailsFromGpx;
using Utanvega.Backend.Application.Trails.Commands.UpdateTrail;
using Utanvega.Backend.Application.Trails.Commands.DeleteTrail;
using Utanvega.Backend.Application.Trails.Commands.BulkTrailAction;
using Utanvega.Backend.Application.Trails.Queries.GetTrails;
using Utanvega.Backend.Application.Trails.Queries.GetTrailGeometry;
using Utanvega.Backend.Application.Locations.Queries.GetLocations;
using Utanvega.Backend.Application.Locations.Commands.CreateLocation;
using Utanvega.Backend.Application.Locations.Commands.UpdateLocation;
using Utanvega.Backend.Application.Locations.Commands.DeleteLocation;
using Utanvega.Backend.Application.History.Queries.GetChangeLogs;
using Utanvega.Backend.Application.Trails.Queries.GetTrailBySlug;
using Utanvega.Backend.Application.Locations.Queries.GetLocationBySlug;
using MediatR;

using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// Add Database with PostGIS
var rawConnectionString = builder.Configuration.GetConnectionString("DefaultConnection") 
    ?? builder.Configuration["DATABASE_URL"];

// Fly.io provides DATABASE_URL in the format: postgres://user:password@host:port/dbname
// We need to convert it to Npgsql format for EF Core.
var connectionString = rawConnectionString;
if (!string.IsNullOrEmpty(rawConnectionString) && rawConnectionString.Contains("://"))
{
    Console.WriteLine($"[INFO] Found Connection String with scheme: {rawConnectionString.Split(':')[0]}");
    try 
    {
        // Using manual string splitting instead of Uri class to avoid issues with special characters in passwords
        // Format: postgresql://user:password@host:port/database
        
        string remaining = rawConnectionString.Split("://")[1];
        
        // Split user info from the rest
        int atIndex = remaining.LastIndexOf('@');
        string userInfo = remaining.Substring(0, atIndex);
        string hostPortDb = remaining.Substring(atIndex + 1);
        
        // Split user and password
        string[] userPass = userInfo.Split(':');
        string user = userPass[0];
        string password = userPass.Length > 1 ? Uri.UnescapeDataString(userPass[1]) : "";
        
        // Split host:port from database
        string[] hostPortAndDb = hostPortDb.Split('/');
        string hostPort = hostPortAndDb[0];
        string database = hostPortAndDb.Length > 1 ? hostPortAndDb[1].Split('?')[0] : "postgres";
        
        // Split host and port
        string[] hostAndPort = hostPort.Split(':');
        string host = hostAndPort[0];
        string port = hostAndPort.Length > 1 ? hostAndPort[1] : "5432";

        connectionString = $"Host={host};Port={port};Database={database};Username={user};Password={password};Include Error Detail=true";
        Console.WriteLine($"[INFO] Successfully parsed Connection String. Host={host}, Port={port}, Database={database}");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[CRITICAL] Failed to parse connection string: {ex.Message}");
    }
}
else if (!string.IsNullOrEmpty(rawConnectionString))
{
    Console.WriteLine("[INFO] Using raw Connection String (already in Npgsql format).");
}

if (builder.Environment.IsDevelopment())
{
    Console.WriteLine($"[DEBUG_LOG] Using ConnectionString starting with: {connectionString?.Substring(0, Math.Min(connectionString?.Length ?? 0, 15))}...");
}
else if (string.IsNullOrEmpty(connectionString))
{
    Console.WriteLine("[CRITICAL] No connection string found! Check DATABASE_URL or DefaultConnection secret.");
}

// Supabase Auth Configuration
var supabaseUrl = builder.Configuration["SUPABASE_URL"] ?? "https://honsdscqmhvsoumrcnad.supabase.co";
var jwtSecret = builder.Configuration["SUPABASE_JWT_SECRET"];

if (string.IsNullOrEmpty(jwtSecret) && !builder.Environment.IsDevelopment())
{
    Console.WriteLine("[CRITICAL] SUPABASE_JWT_SECRET is missing in production. App will likely fail to validate Admin requests.");
}
else if (!string.IsNullOrEmpty(jwtSecret))
{
    Console.WriteLine($"[INFO] SUPABASE_JWT_SECRET found (Length: {jwtSecret.Length})");
}

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = supabaseUrl + "/auth/v1";
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = supabaseUrl + "/auth/v1",
            ValidateAudience = true,
            ValidAudience = "authenticated",
            ValidateLifetime = true,
            IssuerSigningKey = !string.IsNullOrEmpty(jwtSecret) 
                ? new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)) 
                : null,
            ValidateIssuerSigningKey = !string.IsNullOrEmpty(jwtSecret)
        };
        
        // Supabase uses a single key for all tenants if you use the shared API.
        // For development without a secret, we might need to be careful.
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy => 
    {
        policy.RequireAuthenticatedUser();
        // You can add role checks here if you store roles in Supabase user metadata
        // e.g., policy.RequireClaim("role", "admin");
    });
});

builder.Services.AddDbContext<UtanvegaDbContext>(options =>
    options.UseNpgsql(connectionString, o => o.UseNetTopologySuite()));

// Add CQRS with MediatR
builder.Services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(Program).Assembly));

// builder.Services.AddEndpointsApiExplorer();
// builder.Services.AddSwaggerGen();

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        var allowedOrigins = builder.Configuration.GetSection("AllowedOrigins").Get<string[]>() ?? ["http://localhost:5173", "http://localhost:5174"];
        
        Console.WriteLine($"[INFO] Allowed Origins: {string.Join(", ", allowedOrigins)}");
        
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
});
builder.Services.Configure<Microsoft.AspNetCore.Mvc.JsonOptions>(options =>
{
    options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
});

var app = builder.Build();

Console.WriteLine("[INFO] Application built. Starting up...");

// app.UseSwagger();
// app.UseSwaggerUI();

app.UseCors("Frontend");

app.UseAuthentication();
app.UseAuthorization();

// Auto-migration on startup (optional, but helpful for initial setup)
/*
using (var scope = app.Services.CreateScope())
{
    try 
    {
        var db = scope.ServiceProvider.GetRequiredService<UtanvegaDbContext>();
        Console.WriteLine("[INFO] Applying database migrations...");
        db.Database.Migrate();
        Console.WriteLine("[INFO] Migrations applied successfully.");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[ERROR] Database migration failed: {ex.Message}");
        if (ex.InnerException != null)
        {
            Console.WriteLine($"[ERROR] Inner exception: {ex.InnerException.Message}");
        }
        // We don't throw here to allow the app to start even if migrations fail, 
        // which helps in identifying if the issue is DB-related or App-related.
    }
}
*/

app.MapGet("/api/v1/trails", async (IMediator mediator) =>
{
    var trails = await mediator.Send(new GetTrailsQuery(IncludeDeleted: false, PublishedOnly: true));
    return Results.Ok(trails);
})
.WithName("GetPublicTrails");

app.MapGet("/api/v1/trails/{slug}", async (string slug, IMediator mediator) =>
{
    var trail = await mediator.Send(new GetTrailBySlugQuery(slug));
    return trail != null ? Results.Ok(trail) : Results.NotFound();
})
.WithName("GetPublicTrailBySlug");

app.MapGet("/api/v1/trails/{slug}/geometry", async (string slug, IMediator mediator) =>
{
    var geoJson = await mediator.Send(new GetTrailGeometryQuery(Slug: slug));
    return geoJson != null ? Results.Content(geoJson, "application/json") : Results.NotFound();
})
.WithName("GetPublicTrailGeometry");

app.MapGet("/api/v1/locations", async (IMediator mediator) =>
{
    var locations = await mediator.Send(new GetLocationsQuery());
    return Results.Ok(locations);
})
.WithName("GetPublicLocations");

app.MapGet("/api/v1/locations/{slug}", async (string slug, IMediator mediator) =>
{
    var location = await mediator.Send(new GetLocationBySlugQuery(slug));
    return location != null ? Results.Ok(location) : Results.NotFound();
})
.WithName("GetPublicLocationBySlug");

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
    time = DateTime.UtcNow,
    connection = string.IsNullOrEmpty(connectionString) ? "Missing" : "Configured"
});

app.MapGet("/api/v1/admin/trails", [Authorize] async (bool includeDeleted, IMediator mediator) =>
{
    var trails = await mediator.Send(new GetTrailsQuery(includeDeleted));
    return Results.Ok(trails);
})
.WithName("GetTrails");

app.MapGet("/api/v1/admin/trails/{idOrSlug}", [Authorize] async (string idOrSlug, UtanvegaDbContext context) =>
{
    var isGuid = Guid.TryParse(idOrSlug, out var id);
    var query = context.Trails
        .AsNoTracking()
        .Select(t => new
        {
            t.Id,
            t.Name,
            t.Slug,
            t.Description,
            ActivityType = t.ActivityTypeId.ToString(),
            Status = t.Status.ToString(),
            Type = t.Type.ToString(),
            Difficulty = t.Difficulty.ToString(),
            Visibility = t.Visibility.ToString(),
            t.Length,
            t.ElevationGain,
            t.ElevationLoss,
            Locations = t.TrailLocations.Select(tl => new
            {
                tl.LocationId,
                Role = tl.Role.ToString()
            }).ToList()
        });

    var trail = isGuid 
        ? await query.FirstOrDefaultAsync(t => t.Id == id)
        : await query.FirstOrDefaultAsync(t => t.Slug == idOrSlug);

    return trail != null ? Results.Ok(trail) : Results.NotFound();
})
.WithName("GetAdminTrail");

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

app.MapPost("/api/v1/admin/trails/bulk-action", [Authorize] async (BulkTrailActionCommand command, IMediator mediator) =>
{
    var count = await mediator.Send(command);
    return Results.Ok(new { count });
})
.WithName("BulkTrailAction");

app.MapGet("/api/v1/admin/trails/{idOrSlug}/geometry", [Authorize] async (string idOrSlug, IMediator mediator) =>
{
    var isGuid = Guid.TryParse(idOrSlug, out var id);
    var query = isGuid ? new GetTrailGeometryQuery(Id: id) : new GetTrailGeometryQuery(Slug: idOrSlug);
    var geoJson = await mediator.Send(query);
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

app.MapPost("/api/v1/admin/trails/bulk-upload-gpx", [Authorize] async (HttpContext context, IMediator mediator) =>
{
    var form = await context.Request.ReadFormAsync();
    var files = form.Files.GetFiles("files");
    var names = form.TryGetValue("names", out var namesList) ? namesList.ToList() : new List<string?>();

    if (files == null || files.Count == 0) return Results.BadRequest("No files uploaded.");
    
    var gpxFiles = new List<GpxFileInfo>();
    for (int i = 0; i < files.Count; i++)
    {
        var file = files[i];
        var name = names.Count > i ? names[i] : null;

        using var reader = new StreamReader(file.OpenReadStream());
        var gpxXml = await reader.ReadToEndAsync();
        
        gpxFiles.Add(new GpxFileInfo(name, gpxXml));
    }
    
    try 
    {
        var command = new BulkCreateTrailsFromGpxCommand(gpxFiles);
        var trailIds = await mediator.Send(command);
        return Results.Ok(new { count = trailIds.Count, ids = trailIds });
    }
    catch (Exception ex)
    {
        return Results.Problem(ex.Message);
    }
})
.WithName("BulkUploadGpx")
.DisableAntiforgery();

// Locations Admin API
app.MapGet("/api/v1/admin/locations", [Authorize] async (Guid? parentId, string? search, IMediator mediator) =>
{
    var locations = await mediator.Send(new GetLocationsQuery(parentId, search));
    return Results.Ok(locations);
})
.WithName("GetLocations");

app.MapPost("/api/v1/admin/locations", [Authorize] async (CreateLocationCommand command, IMediator mediator) =>
{
    var id = await mediator.Send(command);
    return Results.Created($"/api/v1/admin/locations/{id}", new { id });
})
.WithName("CreateLocation");

app.MapPut("/api/v1/admin/locations/{id}", [Authorize] async (Guid id, UpdateLocationCommand command, IMediator mediator) =>
{
    if (id != command.Id) return Results.BadRequest("ID mismatch");
    await mediator.Send(command);
    return Results.NoContent();
})
.WithName("UpdateLocation");

app.MapDelete("/api/v1/admin/locations/{id}", [Authorize] async (Guid id, IMediator mediator) =>
{
    try 
    {
        await mediator.Send(new DeleteLocationCommand(id));
        return Results.NoContent();
    }
    catch (Exception ex)
    {
        return Results.BadRequest(ex.Message);
    }
})
.WithName("DeleteLocation");

// History / Audit API
app.MapGet("/api/v1/admin/history", [Authorize] async (string? entityName, string? entityId, int? limit, IMediator mediator) =>
{
    var logs = await mediator.Send(new GetChangeLogsQuery(entityName, entityId, limit ?? 50));
    return Results.Ok(logs);
})
.WithName("GetHistory");

app.Run();