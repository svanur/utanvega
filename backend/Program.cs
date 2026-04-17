using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.Encodings.Web;
using Utanvega.Backend.Infrastructure.Persistence;
using Utanvega.Backend.Core.Entities;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;

using Microsoft.EntityFrameworkCore;

using Utanvega.Backend.Application.Trails.Commands.CreateTrailFromGpx;
using Utanvega.Backend.Application.Trails.Commands.CheckTrailSimilarity;
using Utanvega.Backend.Application.Trails.Commands.BulkCreateTrailsFromGpx;
using Utanvega.Backend.Application.Trails.Commands.BulkCheckTrailSimilarity;
using Utanvega.Backend.Application.Trails.Commands.UpdateTrail;
using Utanvega.Backend.Application.Trails.Commands.DeleteTrail;
using Utanvega.Backend.Application.Trails.Commands.BulkTrailAction;
using Utanvega.Backend.Application.Trails.Commands.PatchTrail;
using Utanvega.Backend.Application.Trails.Commands.UpdateTrailGpx;
using Utanvega.Backend.Application.Trails.Queries.GetTrails;
using Utanvega.Backend.Application.Trails.Queries.GetTrailGeometry;
using Utanvega.Backend.Application.Locations.Queries.GetLocations;
using Utanvega.Backend.Application.Locations.Commands.CreateLocation;
using Utanvega.Backend.Application.Locations.Commands.UpdateLocation;
using Utanvega.Backend.Application.Locations.Commands.DeleteLocation;
using Utanvega.Backend.Application.Trails.Queries.GetDuplicateTrails;
using Utanvega.Backend.Application.History.Queries.GetChangeLogs;
using Utanvega.Backend.Application.Analytics.Queries;
using Utanvega.Backend.Application.Trails.Queries.GetTrailBySlug;
using Utanvega.Backend.Application.Trails.Queries.GetTrailSuggestions;
using Utanvega.Backend.Application.Locations.Queries.GetLocationBySlug;
using Utanvega.Backend.Application.Locations.Queries.GetLocationTree;
using Utanvega.Backend.Application.Trails.Queries.GetTrailGpx;
using Utanvega.Backend.Application.Trails.Queries.GetTrailGeometries;
using Utanvega.Backend.Application.Trails.Queries.GetTrendingTrails;
using Utanvega.Backend.Application.Trails.Commands.RecordTrailView;
using Utanvega.Backend.Application.Weather.Queries;
using Utanvega.Backend.Core.Services;
using Utanvega.Backend.Application.Competitions.Queries.GetCompetitions;
using Utanvega.Backend.Application.Competitions.Queries.GetCompetition;
using Utanvega.Backend.Application.Competitions.Queries.GetCompetitionCalendar;
using Utanvega.Backend.Application.Competitions.Commands.CreateCompetition;
using Utanvega.Backend.Application.Competitions.Commands.UpdateCompetition;
using Utanvega.Backend.Application.Competitions.Commands.DeleteCompetition;
using Utanvega.Backend.Application.Competitions.Commands.CreateRace;
using Utanvega.Backend.Application.Competitions.Commands.UpdateRace;
using Utanvega.Backend.Application.Competitions.Commands.DeleteRace;
using MediatR;
using FluentValidation;
using Microsoft.Extensions.Caching.Memory;
using Utanvega.Backend.Application.Validation;

using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

// Allow large multipart uploads (90+ GPX files in bulk)
builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = 200 * 1024 * 1024); // 200 MB
builder.Services.Configure<FormOptions>(o =>
{
    o.MultipartBodyLengthLimit = 200 * 1024 * 1024;
    o.ValueCountLimit = 2048;
});

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
var supabaseUrl = builder.Configuration["SUPABASE_URL"];
if (string.IsNullOrEmpty(supabaseUrl))
{
    if (builder.Environment.IsDevelopment())
        Console.WriteLine("[WARN] SUPABASE_URL not set, Supabase auth will not work.");
    else
        throw new InvalidOperationException("SUPABASE_URL must be configured in production.");
}

var jwtSecret = builder.Configuration["SUPABASE_JWT_SECRET"];
if (string.IsNullOrEmpty(jwtSecret) && !builder.Environment.IsDevelopment())
{
    throw new InvalidOperationException("SUPABASE_JWT_SECRET must be configured in production.");
}
else if (!string.IsNullOrEmpty(jwtSecret))
{
    Console.WriteLine($"[INFO] SUPABASE_JWT_SECRET found (Length: {jwtSecret.Length})");
}

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = supabaseUrl is not null ? supabaseUrl + "/auth/v1" : null;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = !string.IsNullOrEmpty(supabaseUrl),
            ValidIssuer = supabaseUrl is not null ? supabaseUrl + "/auth/v1" : null,
            ValidateAudience = true,
            ValidAudience = "authenticated",
            ValidateLifetime = true,
            IssuerSigningKey = !string.IsNullOrEmpty(jwtSecret) 
                ? new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)) 
                : null,
            ValidateIssuerSigningKey = !string.IsNullOrEmpty(jwtSecret)
        };
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
builder.Services.AddMediatR(cfg =>
{
    cfg.RegisterServicesFromAssembly(typeof(Program).Assembly);
    cfg.AddOpenBehavior(typeof(ValidationBehavior<,>));
});
builder.Services.AddValidatorsFromAssembly(typeof(Program).Assembly);
builder.Services.AddScoped<CreateTrailFromGpxCommandHandler>();
builder.Services.AddScoped<LocationDetector>();
builder.Services.AddSingleton<IScheduleRuleEngine, ScheduleRuleEngine>();
builder.Services.AddHttpClient("OpenMeteo");
builder.Services.AddMemoryCache();

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

builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy("trail-view", httpContext =>
        RateLimitPartition.GetSlidingWindowLimiter(
            httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new SlidingWindowRateLimiterOptions
            {
                PermitLimit = 30,
                Window = TimeSpan.FromMinutes(1),
                SegmentsPerWindow = 6,
                QueueLimit = 0,
            }));
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});

var app = builder.Build();

Console.WriteLine("[INFO] Application built. Starting up...");

// app.UseSwagger();
// app.UseSwaggerUI();

app.UseCors("Frontend");
app.UseRateLimiter();

// Security headers
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    context.Response.Headers["X-XSS-Protection"] = "0";
    await next();
});

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}

// Return validation errors as structured 400 responses; sanitize unhandled exceptions
app.Use(async (context, next) =>
{
    try
    {
        await next(context);
    }
    catch (ValidationException ex)
    {
        context.Response.StatusCode = 400;
        context.Response.ContentType = "application/json";
        var errors = ex.Errors
            .GroupBy(e => e.PropertyName)
            .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray());
        await context.Response.WriteAsJsonAsync(new { title = "Validation failed", errors });
    }
    catch (Exception ex)
    {
        if (!context.Response.HasStarted)
        {
            Console.WriteLine($"[ERROR] Unhandled exception: {ex}");
            context.Response.StatusCode = 500;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(new { title = "An unexpected error occurred." });
        }
    }
});

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

app.MapGet("/api/v1/trails/suggestions", async (string slug, IMediator mediator) =>
{
    var suggestions = await mediator.Send(new GetTrailSuggestionsQuery(slug));
    return Results.Ok(suggestions);
})
.WithName("GetTrailSuggestions");

app.MapGet("/api/v1/trails/geometries", async (IMediator mediator) =>
{
    var features = await mediator.Send(new GetTrailGeometriesQuery());
    return Results.Ok(features);
})
.WithName("GetTrailGeometries");

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

app.MapGet("/api/v1/trails/{slug}/gpx", async (string slug, IMediator mediator) =>
{
    var response = await mediator.Send(new GetTrailGpxQuery(slug));
    if (response == null) return Results.NotFound();
    
    return Results.File(
        Encoding.UTF8.GetBytes(response.Content), 
        "application/gpx+xml", 
        response.FileName
    );
})
.WithName("GetPublicTrailGpx");

app.MapPost("/api/v1/trails/{slug}/view", async (string slug, HttpContext httpContext, IMediator mediator) =>
{
    var ip = httpContext.Connection.RemoteIpAddress?.ToString() ?? "";
    var ipHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(ip))).ToLowerInvariant();
    var recorded = await mediator.Send(new RecordTrailViewCommand(slug, ipHash));
    return recorded ? Results.Ok() : Results.NotFound();
})
.WithName("RecordTrailView")
.RequireRateLimiting("trail-view");

app.MapGet("/api/v1/trails/trending", async (int? count, int? days, IMediator mediator) =>
{
    var trending = await mediator.Send(new GetTrendingTrailsQuery(count ?? 10, days ?? 7));
    return Results.Ok(trending);
})
.WithName("GetTrendingTrails");

app.MapGet("/api/v1/trails/{slug}/weather", async (string slug, IMediator mediator) =>
{
    var weather = await mediator.Send(new GetTrailWeatherQuery(slug));
    if (weather == null) return Results.NotFound();
    return Results.Ok(weather);
})
.WithName("GetTrailWeather");

app.MapGet("/api/v1/locations", async (IMediator mediator) =>
{
    var locations = await mediator.Send(new GetLocationsQuery());
    return Results.Ok(locations);
})
.WithName("GetPublicLocations");

app.MapGet("/api/v1/locations/tree", async (IMediator mediator) =>
{
    var tree = await mediator.Send(new GetLocationTreeQuery());
    return Results.Ok(tree);
})
.WithName("GetLocationTree");

app.MapGet("/api/v1/locations/{slug}", async (string slug, IMediator mediator) =>
{
    var location = await mediator.Send(new GetLocationBySlugQuery(slug));
    return location != null ? Results.Ok(location) : Results.NotFound();
})
.WithName("GetPublicLocationBySlug");

app.MapGet("/api/v1/health", () => Results.Ok(new
{
    status = "healthy",
    service = "api",
    version = "v1",
    timestampUtc = DateTime.UtcNow
}))
.WithName("Health");

app.MapGet("/api/v1/admin/health", [Authorize] () => Results.Ok(new
{
    status = "healthy",
    service = "backend 1",
    area = "admin",
    version = "v1",
    timestampUtc = DateTime.UtcNow
}))
.WithName("AdminHealth");

app.MapGet("/api/v1/admin/analytics", [Authorize] async (IMediator mediator) =>
{
    var analytics = await mediator.Send(new GetAnalyticsQuery());
    return Results.Ok(analytics);
})
.WithName("AdminAnalytics");

app.MapGet("/", () => new
{
    message = "Backend API running!",
    time = DateTime.UtcNow,
    connection = string.IsNullOrEmpty(connectionString) ? "Missing" : "Configured"
});

app.MapGet("/api/v1/admin/trails", [Authorize] async (IMediator mediator, bool includeDeleted = false) =>
{
    var trails = await mediator.Send(new GetTrailsQuery(includeDeleted));
    return Results.Ok(trails);
})
.WithName("GetTrails");

app.MapGet("/api/v1/admin/trails/{idOrSlug}", [Authorize] async (string idOrSlug, UtanvegaDbContext context) =>
{
    var isGuid = Guid.TryParse(idOrSlug, out var id);
    var query = context.Trails
        .Include(t => t.TrailLocations)
        .Include(t => t.TrailTags).ThenInclude(tt => tt.Tag)
        .AsNoTracking();

    var trail = isGuid 
        ? await query.FirstOrDefaultAsync(t => t.Id == id)
        : await query.FirstOrDefaultAsync(t => t.Slug == idOrSlug);

    if (trail == null) return Results.NotFound();

    return Results.Ok(new
    {
        trail.Id,
        trail.Name,
        trail.Slug,
        trail.Description,
        ActivityType = trail.ActivityTypeId.ToString(),
        Status = trail.Status.ToString(),
        Type = trail.Type.ToString(),
        Difficulty = trail.Difficulty.ToString(),
        Visibility = trail.Visibility.ToString(),
        trail.Length,
        trail.ElevationGain,
        trail.ElevationLoss,
        Locations = trail.TrailLocations
            .OrderBy(tl => tl.Order)
            .Select(tl => new { tl.LocationId, Role = tl.Role.ToString(), tl.Order })
            .ToList(),
        Tags = trail.TrailTags
            .Select(tt => new { tt.TagId, tt.Tag.Name, tt.Tag.Slug, tt.Tag.Color })
            .ToList()
    });
})
.WithName("GetAdminTrail");

app.MapPut("/api/v1/admin/trails/{id}", [Authorize] async (Guid id, UpdateTrailCommand command, IMediator mediator) =>
{
    if (id != command.Id) return Results.BadRequest("ID mismatch");
    try
    {
        var success = await mediator.Send(command);
        return success ? Results.NoContent() : Results.NotFound();
    }
    catch (InvalidOperationException ex)
    {
        return Results.Conflict(new { error = ex.Message });
    }
})
.WithName("UpdateTrail");

app.MapPatch("/api/v1/admin/trails/{id}", [Authorize] async (Guid id, PatchTrailCommand command, IMediator mediator) =>
{
    if (id != command.Id) return Results.BadRequest("ID mismatch");
    var success = await mediator.Send(command);
    return success ? Results.NoContent() : Results.NotFound();
})
.WithName("PatchTrail");

app.MapDelete("/api/v1/admin/trails/{id}", [Authorize] async (Guid id, IMediator mediator) =>
{
    var success = await mediator.Send(new DeleteTrailCommand(id));
    return success ? Results.NoContent() : Results.NotFound();
})
.WithName("DeleteTrail");

// --- Trail Location inline management ---
app.MapPost("/api/v1/admin/trails/{trailId}/locations", [Authorize] async (Guid trailId, TrailLocationAddRequest body, UtanvegaDbContext context) =>
{
    var trail = await context.Trails.FindAsync(trailId);
    if (trail == null) return Results.NotFound();

    var location = await context.Locations.FindAsync(body.LocationId);
    if (location == null) return Results.BadRequest("Location not found");

    var existing = await context.Set<TrailLocation>()
        .AnyAsync(tl => tl.TrailId == trailId && tl.LocationId == body.LocationId);
    if (existing) return Results.Conflict("Location already linked");

    if (!Enum.TryParse<TrailLocationRole>(body.Role, true, out var role))
        role = TrailLocationRole.BelongsTo;

    var maxOrder = await context.Set<TrailLocation>()
        .Where(tl => tl.TrailId == trailId)
        .Select(tl => (int?)tl.Order)
        .MaxAsync() ?? -1;

    context.Set<TrailLocation>().Add(new TrailLocation
    {
        TrailId = trailId,
        LocationId = body.LocationId,
        Role = role,
        Order = maxOrder + 1,
    });

    trail.UpdatedAt = DateTime.UtcNow;
    await context.SaveChangesAsync();
    return Results.NoContent();
})
.WithName("AddTrailLocation");

app.MapDelete("/api/v1/admin/trails/{trailId}/locations/{locationId}", [Authorize] async (Guid trailId, Guid locationId, UtanvegaDbContext context) =>
{
    var link = await context.Set<TrailLocation>()
        .FirstOrDefaultAsync(tl => tl.TrailId == trailId && tl.LocationId == locationId);
    if (link == null) return Results.NotFound();

    context.Set<TrailLocation>().Remove(link);

    var trail = await context.Trails.FindAsync(trailId);
    if (trail != null) trail.UpdatedAt = DateTime.UtcNow;

    await context.SaveChangesAsync();
    return Results.NoContent();
})
.WithName("RemoveTrailLocation");

app.MapPatch("/api/v1/admin/trails/{id}/status", [Authorize] async (Guid id, [Microsoft.AspNetCore.Mvc.FromBody] string status, UtanvegaDbContext context) =>
{
    var trail = await context.Trails.FindAsync(id);
    if (trail == null) return Results.NotFound();

    if (Enum.TryParse<Utanvega.Backend.Core.Entities.TrailStatus>(status, true, out var trailStatus))
    {
        trail.Status = trailStatus;
        await context.SaveChangesWithAuditAsync("admin");
        return Results.NoContent();
    }
    return Results.BadRequest("Invalid status");
})
.WithName("UpdateTrailStatus");

app.MapPost("/api/v1/admin/trails/bulk-action", [Authorize] async (BulkTrailActionCommand command, IMediator mediator) =>
{
    var count = await mediator.Send(command);
    return Results.Ok(new { count });
})
.WithName("BulkTrailAction");

app.MapPost("/api/v1/admin/trails/bulk-add-tag", [Authorize] async (BulkAddTagRequest request, UtanvegaDbContext context) =>
{
    var tag = await context.Tags.FindAsync(request.TagId);
    if (tag == null) return Results.NotFound("Tag not found");

    var existingPairs = context.TrailTags
        .Where(tt => request.TrailIds.Contains(tt.TrailId) && tt.TagId == request.TagId)
        .Select(tt => tt.TrailId)
        .ToHashSet();

    var added = 0;
    foreach (var trailId in request.TrailIds)
    {
        if (!existingPairs.Contains(trailId))
        {
            context.TrailTags.Add(new TrailTag { TrailId = trailId, TagId = request.TagId });
            added++;
        }
    }
    await context.SaveChangesAsync();
    return Results.Ok(new { added });
})
.WithName("BulkAddTag");

app.MapPost("/api/v1/admin/trails/bulk-remove-tag", [Authorize] async (BulkAddTagRequest request, UtanvegaDbContext context) =>
{
    var toRemove = context.TrailTags
        .Where(tt => request.TrailIds.Contains(tt.TrailId) && tt.TagId == request.TagId)
        .ToList();
    context.TrailTags.RemoveRange(toRemove);
    await context.SaveChangesAsync();
    return Results.Ok(new { removed = toRemove.Count });
})
.WithName("BulkRemoveTag");

app.MapPost("/api/v1/admin/trails/{id:guid}/recalculate-difficulty", [Authorize] async (Guid id, UtanvegaDbContext context) =>
{
    var trail = await context.Trails.FindAsync(id);
    if (trail == null) return Results.NotFound();

    trail.Difficulty = DifficultyCalculator.Calculate(trail);
    trail.UpdatedAt = DateTime.UtcNow;
    await context.SaveChangesWithAuditAsync("admin");

    return Results.Ok(new { trail.Id, difficulty = trail.Difficulty.ToString() });
})
.WithName("RecalculateTrailDifficulty");

app.MapPost("/api/v1/admin/trails/recalculate-all-difficulties", [Authorize] async (UtanvegaDbContext context) =>
{
    var trails = await context.Trails
        .Where(t => t.Status != Utanvega.Backend.Core.Entities.TrailStatus.Deleted)
        .ToListAsync();

    foreach (var trail in trails)
    {
        trail.Difficulty = DifficultyCalculator.Calculate(trail);
        trail.UpdatedAt = DateTime.UtcNow;
    }

    await context.SaveChangesWithAuditAsync("admin");
    return Results.Ok(new { count = trails.Count });
})
.WithName("RecalculateAllDifficulties");

app.MapGet("/api/v1/admin/detect-locations", [Authorize] async (double lat, double lng, LocationDetector detector) =>
{
    var locations = await detector.DetectLocationsAsync(lat, lng);
    return Results.Ok(locations.Select(l => new { l.Id, l.Name, l.Type, l.DistanceMeters }));
})
.WithName("DetectLocations");

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
        var result = await mediator.Send(command);
        
        var response = new 
        { 
            id = result.Id,
            slug = result.Slug,
            name = result.Name,
            detectedType = result.DetectedType,
            matches = result.Matches.Select(m => new {
                trailId = m.TrailId,
                trailName = m.TrailName,
                matchPercentage = m.MatchPercentage,
                message = $"This trail is a {m.MatchPercentage}% match to '{m.TrailName}'"
            }),
            detectedLocations = result.DetectedLocations.Select(l => new {
                id = l.Id,
                name = l.Name,
                type = l.Type,
                role = l.Role,
                distanceMeters = l.DistanceMeters
            })
        };
        
        return Results.Created($"/api/v1/admin/trails/{result.Id}", response);
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[ERROR] GPX upload failed: {ex}");
        return Results.Problem("Failed to process GPX file. Ensure it contains valid GPX data.");
    }
})
.WithName("UploadGpx")
.DisableAntiforgery(); // Bearer token auth is not vulnerable to CSRF; antiforgery not needed

app.MapPut("/api/v1/admin/trails/{id:guid}/gpx", [Authorize] async (Guid id, IFormFile file, IMediator mediator) =>
{
    if (file == null || file.Length == 0) return Results.BadRequest("No file uploaded.");

    using var reader = new StreamReader(file.OpenReadStream());
    var gpxXml = await reader.ReadToEndAsync();

    try
    {
        var result = await mediator.Send(new UpdateTrailGpxCommand(id, gpxXml));
        if (result == null) return Results.NotFound();
        return Results.Ok(result);
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[ERROR] GPX update failed: {ex}");
        return Results.Problem("Failed to process GPX file. Ensure it contains valid GPX data.");
    }
})
.WithName("UpdateTrailGpx")
.DisableAntiforgery();

app.MapPost("/api/v1/admin/trails/check-similarity", [Authorize] async (string? name, IFormFile file, IMediator mediator) =>
{
    if (file == null || file.Length == 0) return Results.BadRequest("No file uploaded.");
    
    using var reader = new StreamReader(file.OpenReadStream());
    var gpxXml = await reader.ReadToEndAsync();
    
    try 
    {
        var command = new CheckTrailSimilarityCommand(name, gpxXml);
        var matches = await mediator.Send(command);
        
        var response = matches.Select(m => new {
            trailId = m.TrailId,
            trailName = m.TrailName,
            matchPercentage = m.MatchPercentage,
            message = $"This trail is a {m.MatchPercentage}% match to '{m.TrailName}'"
        });
        
        return Results.Ok(response);
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[ERROR] Similarity check failed: {ex}");
        return Results.Problem("Failed to check trail similarity. Ensure the GPX data is valid.");
    }
})
.WithName("CheckTrailSimilarity")
.DisableAntiforgery(); // Bearer token auth is not vulnerable to CSRF; antiforgery not needed

app.MapPost("/api/v1/admin/trails/bulk-check-similarity", [Authorize] async (HttpContext context, IMediator mediator) =>
{
    var form = await context.Request.ReadFormAsync();
    var files = form.Files.GetFiles("files");
    var names = form.TryGetValue("names", out var namesList) ? namesList.ToList() : new List<string?>();

    if (files == null || files.Count == 0) return Results.BadRequest("No files uploaded.");
    
    var gpxFiles = new List<Utanvega.Backend.Application.Trails.Commands.BulkCheckTrailSimilarity.GpxFileInfo>();
    for (int i = 0; i < files.Count; i++)
    {
        var file = files[i];
        var name = names.Count > i ? names[i] : null;

        using var reader = new StreamReader(file.OpenReadStream());
        var gpxXml = await reader.ReadToEndAsync();
        
        gpxFiles.Add(new Utanvega.Backend.Application.Trails.Commands.BulkCheckTrailSimilarity.GpxFileInfo(name, gpxXml, file.FileName));
    }
    
    try 
    {
        var command = new BulkCheckTrailSimilarityCommand(gpxFiles);
        var results = await mediator.Send(command);
        
        var response = results.Select(r => new {
            fileName = r.FileName,
            name = r.Name,
            matches = r.Matches.Select(m => new {
                trailId = m.TrailId,
                trailName = m.TrailName,
                matchPercentage = m.MatchPercentage,
                message = $"This trail is a {m.MatchPercentage}% match to '{m.TrailName}'"
            })
        });
        
        return Results.Ok(response);
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[ERROR] Bulk similarity check failed: {ex}");
        return Results.Problem("Failed to check trail similarity. Ensure the GPX files contain valid data.");
    }
})
.WithName("BulkCheckTrailSimilarity")
.DisableAntiforgery(); // Bearer token auth is not vulnerable to CSRF; antiforgery not needed

app.MapPost("/api/v1/admin/trails/bulk-upload-gpx", [Authorize] async (HttpContext context, IMediator mediator) =>
{
    var form = await context.Request.ReadFormAsync();
    var files = form.Files.GetFiles("files");
    var names = form.TryGetValue("names", out var namesList) ? namesList.ToList() : new List<string?>();

    if (files == null || files.Count == 0) return Results.BadRequest("No files uploaded.");
    
    var gpxFiles = new List<Utanvega.Backend.Application.Trails.Commands.BulkCreateTrailsFromGpx.GpxFileInfo>();
    for (int i = 0; i < files.Count; i++)
    {
        var file = files[i];
        var name = names.Count > i ? names[i] : null;

        using var reader = new StreamReader(file.OpenReadStream());
        var gpxXml = await reader.ReadToEndAsync();
        
        gpxFiles.Add(new Utanvega.Backend.Application.Trails.Commands.BulkCreateTrailsFromGpx.GpxFileInfo(name, gpxXml));
    }
    
    try 
    {
        var command = new BulkCreateTrailsFromGpxCommand(gpxFiles);
        var trailIds = await mediator.Send(command);
        return Results.Ok(new { count = trailIds.Count, ids = trailIds });
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[ERROR] Bulk GPX upload failed: {ex}");
        return Results.Problem("Failed to upload GPX files. Ensure they contain valid GPX data.");
    }
})
.WithName("BulkUploadGpx")
.DisableAntiforgery(); // Bearer token auth is not vulnerable to CSRF; antiforgery not needed

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
    catch (InvalidOperationException)
    {
        return Results.BadRequest("Cannot delete this location. It may have child locations or linked trails.");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[ERROR] Location delete failed: {ex}");
        return Results.Problem("Failed to delete location.");
    }
})
.WithName("DeleteLocation");

// Tags Admin API
app.MapGet("/api/v1/admin/tags", [Authorize] async (UtanvegaDbContext context) =>
{
    var tags = await context.Tags
        .AsNoTracking()
        .OrderBy(t => t.Name)
        .Select(t => new { t.Id, t.Name, t.Slug, t.Color, TrailCount = t.TrailTags.Count })
        .ToListAsync();
    return Results.Ok(tags);
})
.WithName("GetTags");

app.MapPost("/api/v1/admin/tags", [Authorize] async (TagCreateDto dto, UtanvegaDbContext context) =>
{
    var tag = new Utanvega.Backend.Core.Entities.Tag
    {
        Name = dto.Name,
        Slug = Utanvega.Backend.Core.Services.SlugGenerator.Generate(dto.Name),
        Color = dto.Color
    };
    context.Tags.Add(tag);
    await context.SaveChangesWithAuditAsync("admin");
    return Results.Created($"/api/v1/admin/tags/{tag.Id}", new { tag.Id, tag.Name, tag.Slug, tag.Color });
})
.WithName("CreateTag");

app.MapPut("/api/v1/admin/tags/{id}", [Authorize] async (Guid id, TagCreateDto dto, UtanvegaDbContext context) =>
{
    var tag = await context.Tags.FindAsync(id);
    if (tag == null) return Results.NotFound();
    tag.Name = dto.Name;
    tag.Slug = Utanvega.Backend.Core.Services.SlugGenerator.Generate(dto.Name);
    tag.Color = dto.Color;
    await context.SaveChangesWithAuditAsync("admin");
    return Results.NoContent();
})
.WithName("UpdateTag");

app.MapDelete("/api/v1/admin/tags/{id}", [Authorize] async (Guid id, UtanvegaDbContext context) =>
{
    var tag = await context.Tags.Include(t => t.TrailTags).FirstOrDefaultAsync(t => t.Id == id);
    if (tag == null) return Results.NotFound();
    context.TrailTags.RemoveRange(tag.TrailTags);
    context.Tags.Remove(tag);
    await context.SaveChangesWithAuditAsync("admin");
    return Results.NoContent();
})
.WithName("DeleteTag");

// History / Audit API
app.MapGet("/api/v1/admin/history", [Authorize] async (string? entityName, string? entityId, int? limit, IMediator mediator) =>
{
    var logs = await mediator.Send(new GetChangeLogsQuery(entityName, entityId, limit ?? 50));
    return Results.Ok(logs);
})
.WithName("GetHistory");

// Duplicate Detection
app.MapGet("/api/v1/admin/trails/duplicates", [Authorize] async (double? threshold, IMediator mediator) =>
{
    var duplicates = await mediator.Send(new GetDuplicateTrailsQuery(threshold ?? 95));
    return Results.Ok(duplicates);
})
.WithName("GetDuplicateTrails");

// Re-detect trail types for all trails with GPX data
app.MapPost("/api/v1/admin/trails/detect-types", [Authorize] async (UtanvegaDbContext context) =>
{
    var trails = await context.Trails
        .Where(t => t.GpxData != null && t.Status != TrailStatus.Deleted)
        .ToListAsync();

    var updated = 0;
    foreach (var trail in trails)
    {
        var detected = TrailTypeDetector.Detect(trail);
        if (trail.Type != detected)
        {
            trail.Type = detected;
            updated++;
        }
    }

    await context.SaveChangesWithAuditAsync("system");
    
    return Results.Ok(new { total = trails.Count, updated });
})
.WithName("DetectTrailTypes");

app.MapPost("/api/v1/admin/trails/detect-locations", [Authorize] async (UtanvegaDbContext context, LocationDetector detector) =>
{
    var trails = await context.Trails
        .Where(t => t.GpxData != null && t.Status != TrailStatus.Deleted)
        .ToListAsync();

    var updated = 0;
    foreach (var trail in trails)
    {
        var detected = await detector.RedetectAndRelinkAsync(trail);
        if (detected.Count > 0) updated++;
    }

    await context.SaveChangesWithAuditAsync("system");

    return Results.Ok(new { total = trails.Count, updated });
})
.WithName("DetectTrailLocations");

// --- Feature Flags ---
app.MapGet("/api/v1/features", async (UtanvegaDbContext context, IMemoryCache cache) =>
{
    var flags = await cache.GetOrCreateAsync("feature_flags", async entry =>
    {
        entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);
        return await context.FeatureFlags
            .AsNoTracking()
            .ToDictionaryAsync(f => f.Name, f => f.Enabled);
    });
    return Results.Ok(flags);
})
.WithName("GetFeatureFlags");

app.MapGet("/api/v1/admin/features", [Authorize] async (UtanvegaDbContext context) =>
{
    var flags = await context.FeatureFlags
        .AsNoTracking()
        .OrderBy(f => f.Name)
        .ToListAsync();
    return Results.Ok(flags);
})
.WithName("GetAdminFeatureFlags");

app.MapPost("/api/v1/admin/features", [Authorize] async (FeatureFlagCreateDto body, UtanvegaDbContext context, IMemoryCache cache) =>
{
    var exists = await context.FeatureFlags.AnyAsync(f => f.Name == body.Name);
    if (exists) return Results.Conflict("Feature flag already exists");

    var flag = new FeatureFlag
    {
        Name = body.Name,
        Enabled = body.Enabled,
        Description = body.Description,
    };
    context.FeatureFlags.Add(flag);
    await context.SaveChangesAsync();
    cache.Remove("feature_flags");
    return Results.Created($"/api/v1/admin/features/{flag.Id}", flag);
})
.WithName("CreateFeatureFlag");

app.MapPatch("/api/v1/admin/features/{id}", [Authorize] async (Guid id, FeatureFlagUpdateDto body, UtanvegaDbContext context, IMemoryCache cache) =>
{
    var flag = await context.FeatureFlags.FindAsync(id);
    if (flag == null) return Results.NotFound();

    if (body.Enabled.HasValue) flag.Enabled = body.Enabled.Value;
    if (body.Description != null) flag.Description = body.Description;
    flag.UpdatedAt = DateTime.UtcNow;

    await context.SaveChangesAsync();
    cache.Remove("feature_flags");
    return Results.Ok(flag);
})
.WithName("UpdateFeatureFlag");

app.MapDelete("/api/v1/admin/features/{id}", [Authorize] async (Guid id, UtanvegaDbContext context, IMemoryCache cache) =>
{
    var flag = await context.FeatureFlags.FindAsync(id);
    if (flag == null) return Results.NotFound();

    context.FeatureFlags.Remove(flag);
    await context.SaveChangesAsync();
    cache.Remove("feature_flags");
    return Results.NoContent();
})
.WithName("DeleteFeatureFlag");

// ============ Competition Endpoints ============

app.MapGet("/api/v1/competitions", async (IMediator mediator, bool includeHidden = false) =>
{
    var competitions = await mediator.Send(new GetCompetitionsQuery(includeHidden));
    return Results.Ok(competitions);
})
.WithName("GetPublicCompetitions");

app.MapGet("/api/v1/competitions/calendar", async (IMediator mediator, DateOnly? from, DateOnly? to) =>
{
    var today = DateOnly.FromDateTime(DateTime.UtcNow);
    var rangeFrom = from ?? new DateOnly(today.Year, today.Month, 1);
    var rangeTo = to ?? rangeFrom.AddMonths(1).AddDays(-1);
    var calendar = await mediator.Send(new GetCompetitionCalendarQuery(rangeFrom, rangeTo));
    return Results.Ok(calendar);
})
.WithName("GetCompetitionCalendar");

app.MapGet("/api/v1/competitions/{slug}", async (string slug, IMediator mediator) =>
{
    var competition = await mediator.Send(new GetCompetitionQuery(slug));
    return competition != null ? Results.Ok(competition) : Results.NotFound();
})
.WithName("GetCompetitionBySlug");

// Admin Competition CRUD
app.MapGet("/api/v1/admin/competitions", [Authorize] async (IMediator mediator) =>
{
    var competitions = await mediator.Send(new GetCompetitionsQuery(IncludeHidden: true));
    return Results.Ok(competitions);
})
.WithName("GetAdminCompetitions");

app.MapPost("/api/v1/admin/competitions", [Authorize] async (CreateCompetitionCommand command, IMediator mediator) =>
{
    var id = await mediator.Send(command);
    return Results.Created($"/api/v1/competitions/{id}", new { id });
})
.WithName("CreateCompetition");

app.MapPut("/api/v1/admin/competitions/{id}", [Authorize] async (Guid id, UpdateCompetitionCommand command, IMediator mediator) =>
{
    if (id != command.Id) return Results.BadRequest("ID mismatch");
    var success = await mediator.Send(command);
    return success ? Results.NoContent() : Results.NotFound();
})
.WithName("UpdateCompetition");

app.MapDelete("/api/v1/admin/competitions/{id}", [Authorize] async (Guid id, IMediator mediator) =>
{
    var success = await mediator.Send(new DeleteCompetitionCommand(id));
    return success ? Results.NoContent() : Results.NotFound();
})
.WithName("DeleteCompetition");

// Admin Race CRUD
app.MapPost("/api/v1/admin/competitions/{competitionId}/races", [Authorize] async (Guid competitionId, CreateRaceCommand command, IMediator mediator) =>
{
    if (competitionId != command.CompetitionId) return Results.BadRequest("CompetitionId mismatch");
    var id = await mediator.Send(command);
    return Results.Created($"/api/v1/admin/competitions/{competitionId}/races/{id}", new { id });
})
.WithName("CreateRace");

app.MapPut("/api/v1/admin/races/{id}", [Authorize] async (Guid id, UpdateRaceCommand command, IMediator mediator) =>
{
    if (id != command.Id) return Results.BadRequest("ID mismatch");
    var success = await mediator.Send(command);
    return success ? Results.NoContent() : Results.NotFound();
})
.WithName("UpdateRace");

app.MapDelete("/api/v1/admin/races/{id}", [Authorize] async (Guid id, IMediator mediator) =>
{
    var success = await mediator.Send(new DeleteRaceCommand(id));
    return success ? Results.NoContent() : Results.NotFound();
})
.WithName("DeleteRace");

app.Run();

public record TagCreateDto(string Name, string? Color);
public record BulkAddTagRequest(List<Guid> TrailIds, Guid TagId);
public record TrailLocationAddRequest(Guid LocationId, string? Role);
public record FeatureFlagCreateDto(string Name, bool Enabled = true, string? Description = null);
public record FeatureFlagUpdateDto(bool? Enabled, string? Description);