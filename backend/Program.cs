using System.Security.Cryptography;
using System.Security.Claims;
using System.Data;
using Serilog;
using Serilog.Events;
using Utanvega.Backend.Infrastructure.Persistence;
using Utanvega.Backend.Infrastructure.Http;
using Utanvega.Backend.Infrastructure.Retention;
using Utanvega.Backend.Core;
using Utanvega.Backend.Core.Entities;
using Microsoft.AspNetCore.Authorization;
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
using Utanvega.Backend.Application.Events.Queries.GetEvents;
using Utanvega.Backend.Application.Events.Queries.GetEvent;
using Utanvega.Backend.Application.Events.Queries.GetEventCalendar;
using Utanvega.Backend.Application.Events.Queries.GetEditionsHistory;
using Utanvega.Backend.Application.Events.Queries.GetRaceDayEditions;
using Utanvega.Backend.Application.Events.Queries.GetNextRaceDay;
using Utanvega.Backend.Application.Events.Queries.GetPrevRaceDay;
using Utanvega.Backend.Application.Events.Commands.PatchEventStatus;
using Utanvega.Backend.Application.Events.Queries.GetAllEventDetails;
using Utanvega.Backend.Application.Events.Commands.CreateEvent;
using Utanvega.Backend.Application.Events.Commands.UpdateEvent;
using Utanvega.Backend.Application.Events.Commands.DeleteEvent;
using Utanvega.Backend.Application.Events.Commands.CreateEdition;
using Utanvega.Backend.Application.Events.Commands.UpdateEdition;
using Utanvega.Backend.Application.Events.Commands.DeleteEdition;
using Utanvega.Backend.Application.Events.Commands.CancelEdition;
using Utanvega.Backend.Application.Events.Commands.CreateRace;
using Utanvega.Backend.Application.Events.Commands.UpdateRace;
using Utanvega.Backend.Application.Events.Commands.DeleteRace;
using Utanvega.Backend.Application.Events.Commands.GenerateEditionsForSeason;
using Utanvega.Backend.Application.Organizers;
using Utanvega.Backend.Application.Activities.Commands.CreateUserTrailActivity;
using Utanvega.Backend.Application.Activities.Commands.UpdateUserTrailActivity;
using Utanvega.Backend.Application.Activities.Commands.DeleteUserTrailActivity;
using Utanvega.Backend.Application.Activities.Queries.GetUserTrailActivities;
using Utanvega.Backend.Application.Activities.Queries.GetTrailLeaderboard;
using Utanvega.Backend.Application.TrailCheckIns.Commands.CheckInToTrail;
using Utanvega.Backend.Application.TrailCheckIns.Commands.CheckOutFromTrail;
using Utanvega.Backend.Application.TrailCheckIns.Queries.GetTrailCheckIns;
using Utanvega.Backend.Application.Tips.Commands;
using Utanvega.Backend.Application.Feedback.Commands;
using Utanvega.Backend.Application.Feedback.Queries;
using Utanvega.Backend.Infrastructure.Email;
using MediatR;
using FluentValidation;
using Microsoft.Extensions.Caching.Memory;
using Utanvega.Backend.Application.Validation;
using Utanvega.Backend.Application.Caching;

using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Threading.RateLimiting;
using Npgsql;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}")
    .CreateBootstrapLogger();

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((ctx, services, config) =>
{
    config
        .MinimumLevel.Information()
        .MinimumLevel.Override("Microsoft.AspNetCore", LogEventLevel.Warning)
        .MinimumLevel.Override("Microsoft.EntityFrameworkCore", LogEventLevel.Warning)
        .Enrich.FromLogContext();

    if (ctx.HostingEnvironment.IsDevelopment())
        config.WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}");
    else
        config.WriteTo.Console(new Serilog.Formatting.Json.JsonFormatter());
});

// Allow large multipart uploads (90+ GPX files in bulk)
builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = 200 * 1024 * 1024); // 200 MB
builder.Services.Configure<FormOptions>(o =>
{
    o.MultipartBodyLengthLimit = 200 * 1024 * 1024;
    o.ValueCountLimit = 2048;
});

// Add Database with PostGIS
var isMigrateMode = args.Contains("--migrate");

// For migrations, prefer DIRECT_DATABASE_URL (Supabase direct port 5432, bypasses PgBouncer).
// Falls back to DATABASE_URL / DefaultConnection for both normal and migrate modes.
var rawConnectionString = (isMigrateMode ? builder.Configuration["DIRECT_DATABASE_URL"] : null)
    ?? builder.Configuration.GetConnectionString("DefaultConnection")
    ?? builder.Configuration["DATABASE_URL"];

// Fly.io provides DATABASE_URL in the format: postgres://user:password@host:port/dbname
// We need to convert it to Npgsql format for EF Core.
var connectionString = rawConnectionString;
if (!string.IsNullOrEmpty(rawConnectionString) && rawConnectionString.Contains("://"))
{
    Log.Information("Found connection string with scheme {Scheme}", rawConnectionString.Split(':')[0]);
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

        var migrationExtra = isMigrateMode
            ? ";Pooling=false;CommandTimeout=120"
            // No Reset On Close: skip DISCARD ALL on connection return — required for PgBouncer transaction mode.
            : ";Keepalive=30;Connection Idle Lifetime=300;Connection Pruning Interval=10;No Reset On Close=true";
        var includeErrorDetail = builder.Environment.IsDevelopment() ? ";Include Error Detail=true" : "";
        connectionString = $"Host={host};Port={port};Database={database};Username={user};Password={password}{includeErrorDetail}{migrationExtra}";
        Log.Information("Successfully parsed connection string. Host={Host}, Port={Port}, Database={Database}", host, port, database);
    }
    catch (Exception ex)
    {
        Log.Fatal(ex, "Failed to parse connection string");
    }
}
else if (!string.IsNullOrEmpty(rawConnectionString))
{
    Log.Information("Using raw connection string (already in Npgsql format)");
}

if (string.IsNullOrEmpty(connectionString))
{
    Log.Fatal("No connection string found. Check DATABASE_URL or DefaultConnection secret");
}

// Supabase Auth Configuration
var supabaseUrl = builder.Configuration["SUPABASE_URL"];
if (string.IsNullOrEmpty(supabaseUrl))
{
    if (builder.Environment.IsDevelopment())
        Log.Warning("SUPABASE_URL not set; Supabase auth will not work");
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
    Log.Information("SUPABASE_JWT_SECRET found (length: {Length})", jwtSecret.Length);
}

var isLocalSupabase = false;
if (!string.IsNullOrWhiteSpace(supabaseUrl) && Uri.TryCreate(supabaseUrl, UriKind.Absolute, out var supabaseUri))
{
    isLocalSupabase = supabaseUri.IsLoopback || string.Equals(supabaseUri.Host, "localhost", StringComparison.OrdinalIgnoreCase);
}

var expectedIssuer = !string.IsNullOrWhiteSpace(supabaseUrl)
    ? $"{supabaseUrl.TrimEnd('/')}/auth/v1"
    : null;

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = expectedIssuer;
        options.RequireHttpsMetadata = !builder.Environment.IsDevelopment();
        options.TokenValidationParameters = new TokenValidationParameters
        {
            // Keep issuer validation for hosted Supabase; local Docker tokens may omit/mismatch issuer.
            ValidateIssuer = !isLocalSupabase && !string.IsNullOrWhiteSpace(expectedIssuer),
            ValidIssuer = expectedIssuer,
            ValidateAudience = true,
            ValidAudience = "authenticated",
            ValidateLifetime = true,
            IssuerSigningKey = !string.IsNullOrEmpty(jwtSecret) 
                ? new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)) 
                : null,
            ValidateIssuerSigningKey = !string.IsNullOrEmpty(jwtSecret)
        };
        
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = context =>
            {
                // Supabase carries app-level roles in the app_metadata claim (a JSON object,
                // settable only via the Supabase service role / dashboard — never by the user
                // themselves). Promote app_metadata.role to a standard role claim so
                // [Authorize(Policy = "AdminOnly")] can check it.
                if (context.Principal?.Identity is ClaimsIdentity identity)
                {
                    var appMetadataClaim = context.Principal.FindFirst("app_metadata");
                    if (appMetadataClaim != null)
                    {
                        try
                        {
                            using var doc = System.Text.Json.JsonDocument.Parse(appMetadataClaim.Value);
                            if (doc.RootElement.TryGetProperty("role", out var roleElement) &&
                                roleElement.ValueKind == System.Text.Json.JsonValueKind.String)
                            {
                                var role = roleElement.GetString();
                                if (!string.IsNullOrEmpty(role))
                                {
                                    identity.AddClaim(new Claim(ClaimTypes.Role, role));
                                }
                            }
                        }
                        catch (System.Text.Json.JsonException ex)
                        {
                            Log.Warning(ex, "Failed to parse app_metadata claim for role extraction");
                        }
                    }
                }

                Log.Information("JWT token validated successfully for user");
                return Task.CompletedTask;
            },
            OnAuthenticationFailed = context =>
            {
                Log.Warning("JWT authentication failed: {Exception}", context.Exception?.Message);
                return Task.CompletedTask;
            },
            OnChallenge = context =>
            {
                Log.Warning("JWT challenge issued: {Error} {Description}", 
                    context.Error, context.ErrorDescription);
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy =>
    {
        policy.RequireAuthenticatedUser();
        // Requires app_metadata.role == "admin" on the Supabase user (set via the
        // Supabase dashboard/service role — see OnTokenValidated above).
        policy.RequireRole("admin");
    });
});

builder.Services.AddDbContextPool<UtanvegaDbContext>(options =>
    options.UseNpgsql(connectionString, o =>
    {
        o.UseNetTopologySuite();
        o.EnableRetryOnFailure(maxRetryCount: 3, maxRetryDelay: TimeSpan.FromSeconds(5), errorCodesToAdd: null);
        o.CommandTimeout(60);
    }));

// Add CQRS with MediatR
builder.Services.AddMediatR(cfg =>
{
    cfg.RegisterServicesFromAssembly(typeof(Program).Assembly);
    cfg.AddOpenBehavior(typeof(ValidationBehavior<,>));
    cfg.AddOpenBehavior(typeof(CachingBehavior<,>));
});
builder.Services.AddValidatorsFromAssembly(typeof(Program).Assembly);
builder.Services.AddScoped<CreateTrailFromGpxCommandHandler>();
builder.Services.AddScoped<LocationDetector>();
builder.Services.AddSingleton<IScheduleRuleEngine, ScheduleRuleEngine>();
builder.Services.AddSingleton<ICacheInvalidator, CacheInvalidator>();
builder.Services.AddHttpClient("OpenMeteo");
builder.Services.AddMemoryCache();
builder.Services.AddSingleton<Utanvega.Backend.Infrastructure.Translation.DeepLTranslatorProvider>();

// builder.Services.AddEndpointsApiExplorer();
// builder.Services.AddSwaggerGen();

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        var allowedOrigins = builder.Configuration.GetSection("AllowedOrigins").Get<string[]>() 
            ?? ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:5176", "http://localhost:5177", "http://localhost:5178", "http://localhost:5179", "http://localhost:5180"];
        
        Log.Information("Allowed Origins: {Origins}", string.Join(", ", allowedOrigins));
        
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

// Salt for the stored IP hashes. Must be stable across deploys: a salt that
// changes makes every returning visitor look new.
//
// Outside development its absence is fatal. An empty key still produces a
// valid-looking HMAC and deduplication keeps working, so nothing looks wrong —
// but IPv4 has only ~4 billion values, so the whole space can be hashed and the
// stored digests turned back into addresses. A warning is too easy to miss for
// a failure whose only symptom is that the data is quietly unprotected, and
// every hash written before it is noticed has to be discarded.
var ipHashSalt = builder.Configuration["IpHashSalt"]
    ?? Environment.GetEnvironmentVariable("IP_HASH_SALT")
    ?? string.Empty;

if (string.IsNullOrWhiteSpace(ipHashSalt) && !builder.Environment.IsDevelopment())
{
    throw new InvalidOperationException(
        "IP_HASH_SALT is not set. Stored view hashes would be unsalted and reversible for IPv4. " +
        "Set it to a stable secret (openssl rand -base64 32) — changing it later resets " +
        "unique-visitor counts, so it must not be regenerated per deploy.");
}

// Injected wherever "now" is needed, so time-dependent logic can be tested at
// an exact instant rather than racing the system clock.
builder.Services.AddSingleton(TimeProvider.System);

builder.Services.AddSingleton(new TrailViewRetentionOptions());
builder.Services.AddHostedService<TrailViewRetentionService>();

builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy("trail-view", httpContext =>
        RateLimitPartition.GetSlidingWindowLimiter(
            ClientIpResolver.GetPartitionKey(httpContext),
            _ => new SlidingWindowRateLimiterOptions
            {
                PermitLimit = 30,
                Window = TimeSpan.FromMinutes(1),
                SegmentsPerWindow = 6,
                QueueLimit = 0,
            }));
    options.AddPolicy("send-feedback", httpContext =>
        RateLimitPartition.GetSlidingWindowLimiter(
            ClientIpResolver.GetPartitionKey(httpContext),
            _ => new SlidingWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(10),
                SegmentsPerWindow = 5,
                QueueLimit = 0,
            }));

    options.AddPolicy("send-tip", httpContext =>
        RateLimitPartition.GetSlidingWindowLimiter(
            ClientIpResolver.GetPartitionKey(httpContext),
            _ => new SlidingWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(10),
                SegmentsPerWindow = 5,
                QueueLimit = 0,
            }));
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});

// Resend email service
builder.Services.AddHttpClient<IEmailService, ResendEmailService>((sp, client) =>
{
    var config = sp.GetRequiredService<IConfiguration>();
    var apiKey = config["Resend:ApiKey"] ?? "";
    client.DefaultRequestHeaders.Authorization =
        new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);
});

var tipRecipient = builder.Configuration["Resend:TipRecipient"];
if (string.IsNullOrEmpty(tipRecipient))
{
    if (builder.Environment.IsDevelopment())
        Log.Warning("Resend:TipRecipient not set; tip emails will not be delivered");
    else
        throw new InvalidOperationException("Resend:TipRecipient must be configured in production.");
}

var app = builder.Build();

if (string.IsNullOrEmpty(ipHashSalt))
{
    // Only reachable in development, where startup above does not throw.
    app.Logger.LogWarning(
        "IP_HASH_SALT is not set — stored view hashes are unsalted and reversible for IPv4. " +
        "Fine locally; outside development this is a startup failure.");
}

// Resolves the Supabase user id from the validated JWT, for audit-trail attribution.
// Never trust a client-supplied "who did this" value instead of this.
static string? GetAuthenticatedUserId(HttpContext context) =>
    context.User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")?.Value
    ?? context.User.FindFirst("sub")?.Value
    ?? context.User.FindFirst("user_id")?.Value
    ?? context.User.FindFirst("uid")?.Value;

Log.Information("Application built. Starting up...");

var middlewareLogger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("App");

try
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<UtanvegaDbContext>();
    var conn = db.Database.GetDbConnection();

    if (conn.State != ConnectionState.Open)
        await conn.OpenAsync();

    await using var cmd = conn.CreateCommand();
    cmd.CommandText = @"
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'UserTrailActivities'
ORDER BY ordinal_position;";

    var columns = new List<string>();
    await using var reader = await cmd.ExecuteReaderAsync();
    while (await reader.ReadAsync())
    {
        columns.Add($"{reader.GetString(0)}:{reader.GetString(1)}:nullable={reader.GetString(2)}");
    }

    if (columns.Count == 0)
        Log.Warning("Schema check: table public.UserTrailActivities not found");
    else
        Log.Information("Schema check: public.UserTrailActivities columns => {Columns}", string.Join(", ", columns));
}
catch (Exception ex)
{
    Log.Warning(ex, "Schema check for public.UserTrailActivities failed");
}

// app.UseSwagger();
// app.UseSwaggerUI();

app.UseCors("Frontend");
app.UseRateLimiter();

app.UseSerilogRequestLogging(opts =>
{
    opts.GetLevel = (ctx, elapsed, ex) =>
        ctx.Request.Path.StartsWithSegments("/api/v1/health")
            ? LogEventLevel.Debug
            : LogEventLevel.Information;
});

// Security headers
app.Use(async (HttpContext context, Func<Task> next) =>
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
app.Use(async (HttpContext context, RequestDelegate next) =>
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
            middlewareLogger.LogError(ex, "Unhandled exception for {Method} {Path}", context.Request.Method, context.Request.Path);
            context.Response.StatusCode = 500;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(new { title = "An unexpected error occurred." });
        }
    }
});

app.UseAuthentication();
app.UseAuthorization();

// Auto-apply pending migrations in development to keep schema aligned with code.
if (app.Environment.IsDevelopment())
{
    using var migrationScope = app.Services.CreateScope();
    try
    {
        var db = migrationScope.ServiceProvider.GetRequiredService<UtanvegaDbContext>();
        Log.Information("Applying database migrations...");
        await db.Database.MigrateAsync();
        Log.Information("Migrations applied successfully.");
    }
    catch (Exception ex)
    {
        Log.Error(ex, "Database migration failed");
    }
}

app.MapGet("/api/v1/trails", async (IMediator mediator, HttpContext ctx) =>
{
    var trails = await mediator.Send(new GetTrailsQuery(IncludeArchived: false, PublishedOnly: true));
    ctx.Response.Headers.CacheControl = "public, max-age=300, stale-while-revalidate=60";
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
    var ipHash = ClientIpResolver.GetClientIpHash(httpContext, ipHashSalt);
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

app.MapGet("/api/v1/trails/{slug}/leaderboard", async (string slug, int? limit, IMediator mediator) =>
{
    if (limit is <= 0 or > 1000)
    {
        return Results.BadRequest("Invalid limit. Must be between 1 and 1000.");
    }

    var query = new GetTrailLeaderboardQuery(slug, limit ?? 10);
    var leaderboard = await mediator.Send(query);
    return Results.Ok(leaderboard);
})
.WithName("GetTrailLeaderboard");

app.MapGet("/api/v1/trails/{slug}/checkins", async (string slug, IMediator mediator) =>
{
    try
    {
        var checkIns = await mediator.Send(new GetTrailCheckInsQuery(slug));
        return Results.Ok(checkIns);
    }
    catch (InvalidOperationException ex)
    {
        return Results.NotFound(new { message = ex.Message });
    }
})
.WithName("GetTrailCheckIns");

app.MapPost("/api/v1/trails/{slug}/checkins", [Authorize] async (string slug, IMediator mediator, HttpContext context) =>
{
    try
    {
        var userIdClaim = context.User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")
            ?? context.User.FindFirst("sub")
            ?? context.User.FindFirst("user_id")
            ?? context.User.FindFirst("uid");

        if (userIdClaim?.Value is null || !Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return Results.Forbid();
        }

        var result = await mediator.Send(new CheckInToTrailCommand(userId, slug));
        return Results.Ok(result);
    }
    catch (InvalidOperationException ex)
    {
        return Results.NotFound(new { message = ex.Message });
    }
})
.WithName("CheckInToTrail");

app.MapDelete("/api/v1/trails/{slug}/checkins/me", [Authorize] async (string slug, IMediator mediator, HttpContext context) =>
{
    try
    {
        var userIdClaim = context.User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")
            ?? context.User.FindFirst("sub")
            ?? context.User.FindFirst("user_id")
            ?? context.User.FindFirst("uid");

        if (userIdClaim?.Value is null || !Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return Results.Forbid();
        }

        await mediator.Send(new CheckOutFromTrailCommand(userId, slug));
        return Results.NoContent();
    }
    catch (InvalidOperationException ex)
    {
        return Results.NotFound(new { message = ex.Message });
    }
})
.WithName("CheckOutFromTrail");

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
    // The API contract version, matching the /api/v1/ route prefix — not the
    // build. appVersion carries the release; the two are separate on purpose.
    version = "v1",
    appVersion = BuildInfo.Version,
    timestampUtc = DateTime.UtcNow
}))
.WithName("Health");

app.MapGet("/api/v1/admin/health", [Authorize(Policy = "AdminOnly")] () => Results.Ok(new
{
    status = "healthy",
    service = "backend 1",
    area = "admin",
    version = "v1",
    appVersion = BuildInfo.Version,
    gitHash = BuildInfo.GitHash,
    timestampUtc = DateTime.UtcNow
}))
.WithName("AdminHealth");

app.MapGet("/api/v1/admin/analytics", [Authorize(Policy = "AdminOnly")] async (IMediator mediator) =>
{
    var analytics = await mediator.Send(new GetAnalyticsQuery());
    return Results.Ok(analytics);
})
.WithName("AdminAnalytics");

app.MapGet("/", async (IWebHostEnvironment env, UtanvegaDbContext db, IMemoryCache cache) =>
{
    var pendingList = await cache.GetOrCreateAsync("root:pending-migrations", async entry =>
    {
        entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(1);
        var pending = await db.Database.GetPendingMigrationsAsync();
        return pending.ToList();
    }) ?? [];
    return new
    {
        message = "Backend API running!",
        version = BuildInfo.Version,
        gitHash = BuildInfo.GitHash,
        environment = env.EnvironmentName,
        time = DateTime.UtcNow,
        connection = string.IsNullOrEmpty(connectionString) ? "Missing" : "Configured",
        migrations = new
        {
            status = pendingList.Count == 0 ? "Up to date" : "Pending",
            pending = pendingList
        }
    };
});

app.MapGet("/api/v1/admin/trails", [Authorize(Policy = "AdminOnly")] async (IMediator mediator, bool includeArchived = false) =>
{
    var trails = await mediator.Send(new GetTrailsQuery(includeArchived));
    return Results.Ok(trails);
})
.WithName("GetTrails");

app.MapGet("/api/v1/admin/trails/{idOrSlug}", [Authorize(Policy = "AdminOnly")] async (string idOrSlug, UtanvegaDbContext context) =>
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
        trail.NameEn,
        trail.Slug,
        trail.Description,
        trail.DescriptionEn,
        ActivityType = trail.ActivityTypeId.ToString(),
        Status = trail.Status.ToString(),
        Type = trail.Type.ToString(),
        Difficulty = trail.Difficulty.ToString(),
        Visibility = trail.Visibility.ToString(),
        trail.Length,
        trail.ElevationGain,
        trail.ElevationLoss,
        trail.YoutubeUrl,
        trail.NeedsReview,
        TerrainType = trail.TerrainType?.ToString(),
        TranslationHashes = trail.TranslationHashes == null ? null : System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, string>>(trail.TranslationHashes),
        MaxAltitude = trail.ElevationProfile != null && trail.ElevationProfile.Length > 0 ? trail.ElevationProfile.Max() : (double?)null,
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

app.MapGet("/api/v1/admin/trails/{idOrSlug}/races", [Authorize(Policy = "AdminOnly")] async (string idOrSlug, UtanvegaDbContext context) =>
{
    var isGuid = Guid.TryParse(idOrSlug, out var id);
    var trailQuery = context.Trails.AsNoTracking();
    var trail = isGuid
        ? await trailQuery.FirstOrDefaultAsync(t => t.Id == id)
        : await trailQuery.FirstOrDefaultAsync(t => t.Slug == idOrSlug);

    if (trail == null) return Results.NotFound();

    var races = await context.Races
        .Include(r => r.EventEdition).ThenInclude(ed => ed.Event)
        .AsNoTracking()
        .Where(r => r.TrailId == trail.Id)
        .OrderByDescending(r => r.EventEdition.Date)
        .Select(r => new
        {
            r.Id,
            RaceName = r.Name,
            EventName = r.EventEdition.Event.Name,
            EventSlug = r.EventEdition.Event.Slug,
            EditionId = r.EventEdition.Id,
            EditionDate = r.EventEdition.Date,
            EditionYear = r.EventEdition.Year,
            EditionTitle = r.EventEdition.Title,
        })
        .ToListAsync();

    return Results.Ok(races);
})
.WithName("GetAdminTrailRaces");

app.MapPut("/api/v1/admin/trails/{id:guid}", [Authorize(Policy = "AdminOnly")] async (Guid id, UpdateTrailCommand command, IMediator mediator, HttpContext httpContext) =>
{
    if (id != command.Id) return Results.BadRequest("ID mismatch");
    try
    {
        // UpdatedBy must reflect who actually authenticated the request, not whatever the client body claims.
        var success = await mediator.Send(command with { UpdatedBy = GetAuthenticatedUserId(httpContext) });
        return success ? Results.NoContent() : Results.NotFound();
    }
    catch (InvalidOperationException ex)
    {
        return Results.Conflict(new { error = ex.Message });
    }
})
.WithName("UpdateTrail");

app.MapPatch("/api/v1/admin/trails/{id:guid}", [Authorize(Policy = "AdminOnly")] async (Guid id, PatchTrailCommand command, IMediator mediator) =>
{
    if (id != command.Id) return Results.BadRequest("ID mismatch");
    var success = await mediator.Send(command);
    return success ? Results.NoContent() : Results.NotFound();
})
.WithName("PatchTrail");

app.MapDelete("/api/v1/admin/trails/{id:guid}", [Authorize(Policy = "AdminOnly")] async (Guid id, IMediator mediator, HttpContext httpContext) =>
{
    var success = await mediator.Send(new DeleteTrailCommand(id, GetAuthenticatedUserId(httpContext)));
    return success ? Results.NoContent() : Results.NotFound();
})
.WithName("DeleteTrail");

// --- Trail Location inline management ---
app.MapPost("/api/v1/admin/trails/{trailId}/locations", [Authorize(Policy = "AdminOnly")] async (Guid trailId, TrailLocationAddRequest body, UtanvegaDbContext context) =>
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

app.MapDelete("/api/v1/admin/trails/{trailId}/locations/{locationId}", [Authorize(Policy = "AdminOnly")] async (Guid trailId, Guid locationId, UtanvegaDbContext context) =>
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

app.MapPatch("/api/v1/admin/trails/{id:guid}/status", [Authorize(Policy = "AdminOnly")] async (Guid id, [Microsoft.AspNetCore.Mvc.FromBody] string status, UtanvegaDbContext context, HttpContext httpContext) =>
{
    var trail = await context.Trails.FindAsync(id);
    if (trail == null) return Results.NotFound();

    if (Enum.TryParse<Utanvega.Backend.Core.Entities.TrailStatus>(status, true, out var trailStatus))
    {
        trail.Status = trailStatus;
        await context.SaveChangesWithAuditAsync(GetAuthenticatedUserId(httpContext));
        return Results.NoContent();
    }
    return Results.BadRequest("Invalid status");
})
.WithName("UpdateTrailStatus");

app.MapPost("/api/v1/admin/trails/bulk-action", [Authorize(Policy = "AdminOnly")] async (BulkTrailActionCommand command, IMediator mediator, HttpContext httpContext) =>
{
    var count = await mediator.Send(command with { ActorUserId = GetAuthenticatedUserId(httpContext) });
    return Results.Ok(new { count });
})
.WithName("BulkTrailAction");

app.MapPost("/api/v1/admin/trails/backfill-elevation-profiles", [Authorize(Policy = "AdminOnly")] async (UtanvegaDbContext context) =>
{
    var trails = await context.Trails
        .Where(t => t.GpxData != null && t.ElevationProfile == null)
        .ToListAsync();

    foreach (var trail in trails)
    {
        var line = trail.GpxData as NetTopologySuite.Geometries.LineString;
        if (line == null) continue;

        var elevations = line.Coordinates
            .Select(c => c.Z)
            .Where(z => !double.IsNaN(z))
            .ToArray();

        if (elevations.Length < 2) continue;

        trail.ElevationProfile = SampleProfile(elevations, 50);
    }

    await context.SaveChangesAsync();
    return Results.Ok(new { updated = trails.Count });

    static double[] SampleProfile(double[] src, int n)
    {
        if (src.Length <= n) return src;
        var result = new double[n];
        for (var i = 0; i < n; i++)
        {
            var idx = (double)i / (n - 1) * (src.Length - 1);
            var lo = (int)idx;
            var hi = Math.Min(lo + 1, src.Length - 1);
            result[i] = src[lo] * (1 - (idx - lo)) + src[hi] * (idx - lo);
        }
        return result;
    }
})
.WithName("BackfillElevationProfiles");

app.MapPost("/api/v1/admin/trails/bulk-add-tag", [Authorize(Policy = "AdminOnly")] async (BulkAddTagRequest request, UtanvegaDbContext context) =>
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

app.MapPost("/api/v1/admin/trails/bulk-remove-tag", [Authorize(Policy = "AdminOnly")] async (BulkAddTagRequest request, UtanvegaDbContext context) =>
{
    var toRemove = context.TrailTags
        .Where(tt => request.TrailIds.Contains(tt.TrailId) && tt.TagId == request.TagId)
        .ToList();
    context.TrailTags.RemoveRange(toRemove);
    await context.SaveChangesAsync();
    return Results.Ok(new { removed = toRemove.Count });
})
.WithName("BulkRemoveTag");

app.MapPost("/api/v1/admin/trails/{id:guid}/recalculate-difficulty", [Authorize(Policy = "AdminOnly")] async (Guid id, UtanvegaDbContext context, HttpContext httpContext) =>
{
    var trail = await context.Trails.FindAsync(id);
    if (trail == null) return Results.NotFound();

    trail.Difficulty = DifficultyCalculator.Calculate(trail);
    trail.UpdatedAt = DateTime.UtcNow;
    await context.SaveChangesWithAuditAsync(GetAuthenticatedUserId(httpContext));

    return Results.Ok(new { trail.Id, difficulty = trail.Difficulty.ToString() });
})
.WithName("RecalculateTrailDifficulty");

app.MapPost("/api/v1/admin/trails/recalculate-all-difficulties", [Authorize(Policy = "AdminOnly")] async (UtanvegaDbContext context, HttpContext httpContext) =>
{
    var trails = await context.Trails
        .Where(t => t.Status != Utanvega.Backend.Core.Entities.TrailStatus.Archived)
        .ToListAsync();

    foreach (var trail in trails)
    {
        trail.Difficulty = DifficultyCalculator.Calculate(trail);
        trail.UpdatedAt = DateTime.UtcNow;
    }

    await context.SaveChangesWithAuditAsync(GetAuthenticatedUserId(httpContext));
    return Results.Ok(new { count = trails.Count });
})
.WithName("RecalculateAllDifficulties");

app.MapGet("/api/v1/admin/detect-locations", [Authorize(Policy = "AdminOnly")] async (double lat, double lng, LocationDetector detector) =>
{
    var locations = await detector.DetectLocationsAsync(lat, lng);
    return Results.Ok(locations.Select(l => new { l.Id, l.Name, l.Type, l.DistanceMeters }));
})
.WithName("DetectLocations");

app.MapGet("/api/v1/admin/trails/{idOrSlug}/geometry", [Authorize(Policy = "AdminOnly")] async (string idOrSlug, IMediator mediator) =>
{
    var isGuid = Guid.TryParse(idOrSlug, out var id);
    var query = isGuid ? new GetTrailGeometryQuery(Id: id) : new GetTrailGeometryQuery(Slug: idOrSlug);
    var geoJson = await mediator.Send(query);
    return geoJson != null ? Results.Content(geoJson, "application/json") : Results.NotFound();
})
.WithName("GetTrailGeometry");

app.MapPost("/api/v1/admin/trails/upload-gpx", [Authorize(Policy = "AdminOnly")] async (string name, IFormFile file, IMediator mediator, string? activityType, ILogger<Program> logger, HttpContext httpContext) =>
{
    if (file == null || file.Length == 0) return Results.BadRequest("No file uploaded.");
    
    using var reader = new StreamReader(file.OpenReadStream());
    var gpxXml = await reader.ReadToEndAsync();
    
    ActivityType parsedActivityType;
    if (activityType is null)
    {
        parsedActivityType = ActivityType.TrailRunning;
    }
    else if (!Enum.TryParse<ActivityType>(activityType, ignoreCase: true, out parsedActivityType))
    {
        return Results.BadRequest($"Invalid activityType '{activityType}'. Valid values: {string.Join(", ", Enum.GetNames<ActivityType>())}");
    }
    
    try 
    {
        var command = new CreateTrailFromGpxCommand(name, gpxXml, parsedActivityType, GetAuthenticatedUserId(httpContext));
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
        logger.LogError(ex, "GPX upload failed for trail {TrailName}", name);
        return Results.Problem("Failed to process GPX file. Ensure it contains valid GPX data.");
    }
})
.WithName("UploadGpx")
.DisableAntiforgery(); // Bearer token auth is not vulnerable to CSRF; antiforgery not needed

app.MapPut("/api/v1/admin/trails/{id:guid}/gpx", [Authorize(Policy = "AdminOnly")] async (Guid id, IFormFile file, IMediator mediator, ILogger<Program> logger, HttpContext httpContext) =>
{
    if (file == null || file.Length == 0) return Results.BadRequest("No file uploaded.");

    using var reader = new StreamReader(file.OpenReadStream());
    var gpxXml = await reader.ReadToEndAsync();

    try
    {
        var result = await mediator.Send(new UpdateTrailGpxCommand(id, gpxXml, GetAuthenticatedUserId(httpContext)));
        if (result == null) return Results.NotFound();
        return Results.Ok(result);
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "GPX update failed for trail {TrailId}", id);
        return Results.Problem("Failed to process GPX file. Ensure it contains valid GPX data.");
    }
})
.WithName("UpdateTrailGpx")
.DisableAntiforgery();

app.MapPost("/api/v1/admin/trails/check-similarity", [Authorize(Policy = "AdminOnly")] async (string? name, IFormFile file, IMediator mediator, ILogger<Program> logger) =>
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
        logger.LogError(ex, "Similarity check failed for {TrailName}", name);
        return Results.Problem("Failed to check trail similarity. Ensure the GPX data is valid.");
    }
})
.WithName("CheckTrailSimilarity")
.DisableAntiforgery(); // Bearer token auth is not vulnerable to CSRF; antiforgery not needed

app.MapPost("/api/v1/admin/trails/bulk-check-similarity", [Authorize(Policy = "AdminOnly")] async (HttpContext context, IMediator mediator, ILogger<Program> logger) =>
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
        logger.LogError(ex, "Bulk similarity check failed for {FileCount} files", gpxFiles.Count);
        return Results.Problem("Failed to check trail similarity. Ensure the GPX files contain valid data.");
    }
})
.WithName("BulkCheckTrailSimilarity")
.DisableAntiforgery(); // Bearer token auth is not vulnerable to CSRF; antiforgery not needed

app.MapPost("/api/v1/admin/trails/bulk-upload-gpx", [Authorize(Policy = "AdminOnly")] async (HttpContext context, IMediator mediator, ILogger<Program> logger) =>
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
        var command = new BulkCreateTrailsFromGpxCommand(gpxFiles, GetAuthenticatedUserId(context));
        var trailIds = await mediator.Send(command);
        return Results.Ok(new { count = trailIds.Count, ids = trailIds });
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Bulk GPX upload failed for {FileCount} files", gpxFiles.Count);
        return Results.Problem("Failed to upload GPX files. Ensure they contain valid GPX data.");
    }
})
.WithName("BulkUploadGpx")
.DisableAntiforgery(); // Bearer token auth is not vulnerable to CSRF; antiforgery not needed

// Locations Admin API
app.MapGet("/api/v1/admin/locations", [Authorize(Policy = "AdminOnly")] async (Guid? parentId, string? search, IMediator mediator) =>
{
    var locations = await mediator.Send(new GetLocationsQuery(parentId, search));
    return Results.Ok(locations);
})
.WithName("GetLocations");

app.MapPost("/api/v1/admin/locations", [Authorize(Policy = "AdminOnly")] async (CreateLocationCommand command, IMediator mediator) =>
{
    var id = await mediator.Send(command);
    return Results.Created($"/api/v1/admin/locations/{id}", new { id });
})
.WithName("CreateLocation");

app.MapPut("/api/v1/admin/locations/{id:guid}", [Authorize(Policy = "AdminOnly")] async (Guid id, UpdateLocationCommand command, IMediator mediator, HttpContext httpContext) =>
{
    if (id != command.Id) return Results.BadRequest("ID mismatch");
    // UpdatedBy must reflect who actually authenticated the request, not whatever the client body claims.
    await mediator.Send(command with { UpdatedBy = GetAuthenticatedUserId(httpContext) });
    return Results.NoContent();
})
.WithName("UpdateLocation");

app.MapDelete("/api/v1/admin/locations/{id:guid}", [Authorize(Policy = "AdminOnly")] async (Guid id, IMediator mediator, ILogger<Program> logger, HttpContext httpContext) =>
{
    try
    {
        await mediator.Send(new DeleteLocationCommand(id, GetAuthenticatedUserId(httpContext)));
        return Results.NoContent();
    }
    catch (InvalidOperationException)
    {
        return Results.BadRequest("Cannot delete this location. It may have child locations or linked trails.");
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Location delete failed for {LocationId}", id);
        return Results.Problem("Failed to delete location.");
    }
})
.WithName("DeleteLocation");

// Tags Admin API
app.MapGet("/api/v1/admin/tags", [Authorize(Policy = "AdminOnly")] async (UtanvegaDbContext context) =>
{
    var tags = await context.Tags
        .AsNoTracking()
        .OrderBy(t => t.Name)
        .Select(t => new { t.Id, t.Name, t.NameEn, t.Slug, t.Color, TrailCount = t.TrailTags.Count, t.TranslationHashes })
        .ToListAsync();
    return Results.Ok(tags);
})
.WithName("GetTags");

app.MapPost("/api/v1/admin/tags", [Authorize(Policy = "AdminOnly")] async (TagCreateDto dto, UtanvegaDbContext context, HttpContext httpContext) =>
{
    var tag = new Utanvega.Backend.Core.Entities.Tag
    {
        Name = dto.Name,
        NameEn = dto.NameEn,
        Slug = Utanvega.Backend.Core.Services.SlugGenerator.Generate(dto.Name),
        Color = dto.Color
    };
    context.Tags.Add(tag);
    await context.SaveChangesWithAuditAsync(GetAuthenticatedUserId(httpContext));
    return Results.Created($"/api/v1/admin/tags/{tag.Id}", new { tag.Id, tag.Name, tag.Slug, tag.Color });
})
.WithName("CreateTag");

app.MapPut("/api/v1/admin/tags/{id:guid}", [Authorize(Policy = "AdminOnly")] async (Guid id, TagCreateDto dto, UtanvegaDbContext context, HttpContext httpContext) =>
{
    var tag = await context.Tags.FindAsync(id);
    if (tag == null) return Results.NotFound();
    tag.Name = dto.Name;
    tag.NameEn = dto.NameEn;
    tag.Color = dto.Color;
    if (dto.TranslationHashes != null)
        tag.TranslationHashes = System.Text.Json.JsonSerializer.Serialize(dto.TranslationHashes);
    await context.SaveChangesWithAuditAsync(GetAuthenticatedUserId(httpContext));
    return Results.NoContent();
})
.WithName("UpdateTag");

app.MapDelete("/api/v1/admin/tags/{id:guid}", [Authorize(Policy = "AdminOnly")] async (Guid id, UtanvegaDbContext context, HttpContext httpContext) =>
{
    var tag = await context.Tags.Include(t => t.TrailTags).FirstOrDefaultAsync(t => t.Id == id);
    if (tag == null) return Results.NotFound();
    context.TrailTags.RemoveRange(tag.TrailTags);
    context.Tags.Remove(tag);
    await context.SaveChangesWithAuditAsync(GetAuthenticatedUserId(httpContext));
    return Results.NoContent();
})
.WithName("DeleteTag");

// Translation API
app.MapPost("/api/v1/admin/translate", [Authorize(Policy = "AdminOnly")] async (TranslateRequest req, Utanvega.Backend.Infrastructure.Translation.DeepLTranslatorProvider translatorProvider) =>
{
    var translator = translatorProvider.Translator;
    if (translator == null)
        return Results.Problem("DeepL API key not configured.");

    if (req.Texts == null || req.Texts.Count == 0)
        return Results.BadRequest("No texts provided.");

    try
    {
        var results = await translator.TranslateTextAsync(
            req.Texts,
            DeepL.LanguageCode.Icelandic,
            DeepL.LanguageCode.EnglishAmerican
        );
        return Results.Ok(new { translations = results.Select(r => r.Text).ToList() });
    }
    catch (DeepL.AuthorizationException)
    {
        return Results.Problem("Invalid DeepL API key.", statusCode: 502);
    }
    catch (DeepL.QuotaExceededException)
    {
        return Results.Problem("DeepL translation quota exceeded.", statusCode: 429);
    }
    catch (Exception ex)
    {
        return Results.Problem($"Translation failed: {ex.Message}", statusCode: 502);
    }
})
.WithName("Translate");

// History / Audit API
app.MapGet("/api/v1/admin/history", [Authorize(Policy = "AdminOnly")] async (string? entityName, string? entityId, int? limit, IMediator mediator) =>
{
    var logs = await mediator.Send(new GetChangeLogsQuery(entityName, entityId, limit ?? 50));
    return Results.Ok(logs);
})
.WithName("GetHistory");

// Duplicate Detection
app.MapGet("/api/v1/admin/trails/duplicates", [Authorize(Policy = "AdminOnly")] async (double? threshold, IMediator mediator) =>
{
    var duplicates = await mediator.Send(new GetDuplicateTrailsQuery(threshold ?? 95));
    return Results.Ok(duplicates);
})
.WithName("GetDuplicateTrails");

// Re-detect trail types for all trails with GPX data
app.MapPost("/api/v1/admin/trails/detect-types", [Authorize(Policy = "AdminOnly")] async (UtanvegaDbContext context, HttpContext httpContext) =>
{
    var trails = await context.Trails
        .Where(t => t.GpxData != null && t.Status != TrailStatus.Archived)
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

    await context.SaveChangesWithAuditAsync(GetAuthenticatedUserId(httpContext));

    return Results.Ok(new { total = trails.Count, updated });
})
.WithName("DetectTrailTypes");

app.MapPost("/api/v1/admin/trails/detect-locations", [Authorize(Policy = "AdminOnly")] async (UtanvegaDbContext context, LocationDetector detector, HttpContext httpContext) =>
{
    var trails = await context.Trails
        .Where(t => t.GpxData != null && t.Status != TrailStatus.Archived)
        .ToListAsync();

    var updated = 0;
    foreach (var trail in trails)
    {
        var detected = await detector.RedetectAndRelinkAsync(trail);
        if (detected.Count > 0) updated++;
    }

    await context.SaveChangesWithAuditAsync(GetAuthenticatedUserId(httpContext));

    return Results.Ok(new { total = trails.Count, updated });
})
.WithName("DetectTrailLocations");

app.MapPost("/api/v1/admin/trails/detect-terrain-types", [Authorize(Policy = "AdminOnly")] async (UtanvegaDbContext context, ICacheInvalidator cacheInvalidator, HttpContext httpContext) =>
{
    var trails = await context.Trails
        .Where(t => t.TerrainType == null && t.GpxData != null)
        .ToListAsync();

    var updated = 0;
    var skipped = 0;

    foreach (var trail in trails)
    {
        if (trail.Length <= 1000 || trail.ElevationProfile == null || trail.ElevationProfile.Length == 0)
        {
            skipped++;
            continue;
        }

        var climbRatio = trail.ElevationGain / (trail.Length / 1000.0);
        var maxAltitude = trail.ElevationProfile.Max();

        // Mountain Index — high-latitude (Iceland) thresholds
        Utanvega.Backend.Core.Entities.TerrainType terrainType;
        if (climbRatio < 20)
            terrainType = Utanvega.Backend.Core.Entities.TerrainType.Flat;
        else if (maxAltitude > 600 && climbRatio >= 30)
            terrainType = Utanvega.Backend.Core.Entities.TerrainType.Mountainous;
        else if (maxAltitude < 400)
            terrainType = Utanvega.Backend.Core.Entities.TerrainType.Hilly;
        else
            terrainType = climbRatio >= 50
                ? Utanvega.Backend.Core.Entities.TerrainType.Mountainous
                : Utanvega.Backend.Core.Entities.TerrainType.Hilly;

        trail.TerrainType = terrainType;
        updated++;
    }

    if (updated > 0)
    {
        await context.SaveChangesWithAuditAsync(GetAuthenticatedUserId(httpContext));
        cacheInvalidator.InvalidateTrail();
        cacheInvalidator.InvalidateEvent();
    }

    return Results.Ok(new { total = trails.Count, updated, skipped });
})
.WithName("DetectTerrainTypes");

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

app.MapGet("/api/v1/admin/features", [Authorize(Policy = "AdminOnly")] async (UtanvegaDbContext context) =>
{
    var flags = await context.FeatureFlags
        .AsNoTracking()
        .OrderBy(f => f.Name)
        .ToListAsync();
    return Results.Ok(flags);
})
.WithName("GetAdminFeatureFlags");

app.MapPost("/api/v1/admin/features", [Authorize(Policy = "AdminOnly")] async (FeatureFlagCreateDto body, UtanvegaDbContext context, IMemoryCache cache) =>
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

app.MapPatch("/api/v1/admin/features/{id:guid}", [Authorize(Policy = "AdminOnly")] async (Guid id, FeatureFlagUpdateDto body, UtanvegaDbContext context, IMemoryCache cache) =>
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

app.MapDelete("/api/v1/admin/features/{id:guid}", [Authorize(Policy = "AdminOnly")] async (Guid id, UtanvegaDbContext context, IMemoryCache cache) =>
{
    var flag = await context.FeatureFlags.FindAsync(id);
    if (flag == null) return Results.NotFound();

    context.FeatureFlags.Remove(flag);
    await context.SaveChangesAsync();
    cache.Remove("feature_flags");
    return Results.NoContent();
})
.WithName("DeleteFeatureFlag");

// ============ Event Endpoints ============

// Public
app.MapGet("/api/v1/events", async (IMediator mediator, HttpContext ctx, bool includeHidden = false) =>
{
    var events = await mediator.Send(new GetEventsQuery(includeHidden));
    if (!includeHidden)
        ctx.Response.Headers.CacheControl = "public, max-age=300, stale-while-revalidate=60";
    return Results.Ok(events);
})
.WithName("GetPublicEvents");

// Legacy stubs — keep deployed frontend/admin from crashing until redeployed
app.MapGet("/api/v1/competitions", () => Results.Ok(Array.Empty<object>())).WithName("LegacyCompetitions");
app.MapGet("/api/v1/competitions/calendar", () => Results.Ok(Array.Empty<object>())).WithName("LegacyCompetitionsCalendar");
app.MapGet("/api/v1/competitions/{slug}", (string slug) => Results.NotFound()).WithName("LegacyCompetitionBySlug");

app.MapGet("/api/v1/events/calendar", async (IMediator mediator, DateOnly? from, DateOnly? to) =>
{
    var today = DateOnly.FromDateTime(DateTime.UtcNow);
    var rangeFrom = from ?? new DateOnly(today.Year, today.Month, 1);
    var rangeTo = to ?? rangeFrom.AddMonths(1).AddDays(-1);
    var calendar = await mediator.Send(new GetEventCalendarQuery(rangeFrom, rangeTo));
    return Results.Ok(calendar);
})
.WithName("GetEventCalendar");

app.MapGet("/api/v1/events/history", async (IMediator mediator, int? year, bool includeCancelled = true) =>
{
    var targetYear = year ?? DateOnly.FromDateTime(DateTime.UtcNow).Year;
    var history = await mediator.Send(new GetEditionsHistoryQuery(targetYear, includeCancelled));
    return Results.Ok(history);
})
.WithName("GetEditionsHistory");

app.MapGet("/api/v1/events/history/years", async (IMediator mediator) =>
{
    var years = await mediator.Send(new GetEditionsHistoryYearsQuery());
    return Results.Ok(years);
})
.WithName("GetEditionsHistoryYears");

app.MapGet("/api/v1/events/calendar.ics", async (IMediator mediator, IConfiguration configuration, UtanvegaDbContext context, IMemoryCache cache) =>
{
    var flags = await cache.GetOrCreateAsync("feature_flags", async entry =>
    {
        entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);
        return await context.FeatureFlags
            .AsNoTracking()
            .ToDictionaryAsync(f => f.Name, f => f.Enabled);
    });
    if (flags == null || !flags.TryGetValue("calendar_integration", out var enabled) || !enabled)
        return Results.NotFound();

    var icsContent = await cache.GetOrCreateAsync("calendar_ics_content", async entry =>
    {
        entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10);

        var siteUrl = configuration["SiteUrl"] ?? "https://www.hlaupadagskra.is";
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var rangeFrom = today.AddMonths(-3);
        var rangeTo = today.AddMonths(12);
        var days = await mediator.Send(new GetEventCalendarQuery(rangeFrom, rangeTo));

        var ical = new Ical.Net.Calendar();
        ical.ProductId = "-//Hlaupadagskra.is//Events//IS";

        // Collapse multi-day events: track full key → (firstDay, lastDay, event)
        // keyMap maps slug|title → current active full key; gap detection prevents collapsing separate editions
        var seen = new Dictionary<string, (DateOnly First, DateOnly Last, CalendarEventDto Ev)>();
        var keyMap = new Dictionary<string, string>();
        foreach (var day in days.OrderBy(d => d.Date))
        {
            foreach (var ev in day.Events)
            {
                var baseKey = $"{ev.Slug}|{ev.EditionTitle}";
                if (keyMap.TryGetValue(baseKey, out var currentFullKey) &&
                    seen.TryGetValue(currentFullKey, out var existing) &&
                    day.Date <= existing.Last.AddDays(1))
                {
                    seen[currentFullKey] = (existing.First, day.Date, existing.Ev);
                }
                else
                {
                    var fullKey = $"{ev.Slug}|{ev.EditionTitle}|{day.Date:yyyy-MM-dd}";
                    seen[fullKey] = (day.Date, day.Date, ev);
                    keyMap[baseKey] = fullKey;
                }
            }
        }

        foreach (var (key, (first, last, ev)) in seen)
        {
            var dtEnd = last.AddDays(1); // iCal all-day end is exclusive
            var vEvent = new Ical.Net.CalendarComponents.CalendarEvent
            {
                Uid = $"{ev.Slug}-{first:yyyy-MM-dd}@hlaupadagskra.is",
                DtStart = new Ical.Net.DataTypes.CalDateTime(first.Year, first.Month, first.Day),
                DtEnd = new Ical.Net.DataTypes.CalDateTime(dtEnd.Year, dtEnd.Month, dtEnd.Day),
                IsAllDay = true,
                Summary = ev.EditionTitle != null ? $"{ev.Name} – {ev.EditionTitle}" : ev.Name,
                Location = ev.LocationName ?? "",
                Url = new Uri($"{siteUrl}/events/{ev.Slug}"),
            };
            vEvent.Description = ev.RaceCount > 0
                ? $"{ev.RaceCount} race(s). More info: {siteUrl}/events/{ev.Slug}\n\nhttps://www.hlaupadagskra.is – Öll hlaup á einum stað"
                : $"More info: {siteUrl}/events/{ev.Slug}\n\nhttps://www.hlaupadagskra.is – Öll hlaup á einum stað";
            ical.Events.Add(vEvent);
        }

        var serializer = new Ical.Net.Serialization.CalendarSerializer();
        return serializer.SerializeToString(ical);
    });

    return Results.Text(icsContent!, "text/calendar; charset=utf-8");
})
.WithName("GetEventCalendarIcs");

app.MapGet("/api/v1/events/{slug}", async (string slug, IMediator mediator) =>
{
    var ev = await mediator.Send(new GetEventQuery(slug));
    return ev != null ? Results.Ok(ev) : Results.NotFound();
})
.WithName("GetEventBySlug");

app.MapGet("/api/v1/admin/events/{slug}", [Authorize(Policy = "AdminOnly")] async (string slug, IMediator mediator) =>
{
    var ev = await mediator.Send(new GetEventQuery(slug, IncludeHidden: true));
    return ev != null ? Results.Ok(ev) : Results.NotFound();
})
.WithName("GetAdminEventBySlug");

// Race Day
app.MapGet("/api/v1/admin/race-day", [Authorize(Policy = "AdminOnly")] async (IMediator mediator, DateOnly? date) =>
{
    var d = date ?? DateOnly.FromDateTime(DateTime.UtcNow);
    var result = await mediator.Send(new GetRaceDayEditionsQuery(d));
    return Results.Ok(result);
})
.WithName("GetRaceDay");

app.MapGet("/api/v1/admin/next-race-day", [Authorize(Policy = "AdminOnly")] async (IMediator mediator, DateOnly? after) =>
{
    var d = after ?? DateOnly.FromDateTime(DateTime.UtcNow);
    var result = await mediator.Send(new GetNextRaceDayQuery(d));
    return Results.Ok(result);
})
.WithName("GetNextRaceDay");

app.MapGet("/api/v1/admin/prev-race-day", [Authorize(Policy = "AdminOnly")] async (IMediator mediator, DateOnly? before) =>
{
    var d = before ?? DateOnly.FromDateTime(DateTime.UtcNow);
    var result = await mediator.Send(new GetPrevRaceDayQuery(d));
    return Results.Ok(result);
})
.WithName("GetPrevRaceDay");

app.MapPatch("/api/v1/admin/events/{id}/status", [Authorize(Policy = "AdminOnly")] async (IMediator mediator, Guid id, PatchEventStatusCommand body, HttpContext httpContext) =>
{
    var result = await mediator.Send(body with { Id = id, ActorUserId = GetAuthenticatedUserId(httpContext) });
    return result ? Results.NoContent() : Results.NotFound();
})
.WithName("PatchEventStatus");

// Admin Event CRUD
app.MapGet("/api/v1/admin/events", [Authorize(Policy = "AdminOnly")] async (IMediator mediator) =>
{
    var events = await mediator.Send(new GetEventsQuery(IncludeHidden: true));
    return Results.Ok(events);
})
.WithName("GetAdminEvents");

app.MapGet("/api/v1/admin/events/details", [Authorize(Policy = "AdminOnly")] async (IMediator mediator) =>
{
    var events = await mediator.Send(new GetAllEventDetailsQuery());
    return Results.Ok(events);
})
.WithName("GetAdminEventDetails");

app.MapPost("/api/v1/admin/events", [Authorize(Policy = "AdminOnly")] async (CreateEventCommand command, IMediator mediator) =>
{
    try
    {
        var id = await mediator.Send(command);
        return Results.Created($"/api/v1/events/{id}", new { id });
    }
    catch (InvalidOperationException ex)
    {
        return Results.Conflict(new { error = ex.Message });
    }
})
.WithName("CreateEvent");

app.MapPut("/api/v1/admin/events/{id:guid}", [Authorize(Policy = "AdminOnly")] async (Guid id, UpdateEventCommand command, IMediator mediator) =>
{
    if (id != command.Id) return Results.BadRequest("ID mismatch");
    var success = await mediator.Send(command);
    return success ? Results.NoContent() : Results.NotFound();
})
.WithName("UpdateEvent");

app.MapDelete("/api/v1/admin/events/{id:guid}", [Authorize(Policy = "AdminOnly")] async (Guid id, IMediator mediator) =>
{
    var success = await mediator.Send(new DeleteEventCommand(id));
    return success ? Results.NoContent() : Results.NotFound();
})
.WithName("DeleteEvent");

// Organizers (public list for dropdowns — trimmed DTO, no PII)
app.MapGet("/api/v1/organizers", async (IMediator mediator) =>
{
    var organizers = await mediator.Send(new GetOrganizersPublicQuery());
    return Results.Ok(organizers);
})
.WithName("GetOrganizers");

app.MapGet("/api/v1/organizers/{slug}", async (string slug, IMediator mediator) =>
{
    var organizer = await mediator.Send(new GetOrganizerBySlugQuery(slug));
    return organizer is null ? Results.NotFound() : Results.Ok(organizer);
})
.WithName("GetOrganizerBySlug");

// Admin Organizer CRUD
app.MapGet("/api/v1/admin/organizers", [Authorize(Policy = "AdminOnly")] async (IMediator mediator) =>
{
    var organizers = await mediator.Send(new GetOrganizersQuery());
    return Results.Ok(organizers);
})
.WithName("GetAdminOrganizers");

app.MapPost("/api/v1/admin/organizers", [Authorize(Policy = "AdminOnly")] async (CreateOrganizerCommand command, IMediator mediator) =>
{
    var (id, slug) = await mediator.Send(command);
    return Results.Created($"/api/v1/organizers/{slug}", new { id, slug });
})
.WithName("CreateOrganizer");

app.MapPut("/api/v1/admin/organizers/{id:guid}", [Authorize(Policy = "AdminOnly")] async (Guid id, UpdateOrganizerCommand command, IMediator mediator) =>
{
    if (id != command.Id) return Results.BadRequest("ID mismatch");
    var success = await mediator.Send(command);
    return success ? Results.NoContent() : Results.NotFound();
})
.WithName("UpdateOrganizer");

app.MapDelete("/api/v1/admin/organizers/{id:guid}", [Authorize(Policy = "AdminOnly")] async (Guid id, IMediator mediator) =>
{
    var success = await mediator.Send(new DeleteOrganizerCommand(id));
    return success ? Results.NoContent() : Results.NotFound();
})
.WithName("DeleteOrganizer");

// Admin Edition CRUD
app.MapPost("/api/v1/admin/events/{eventId:guid}/editions", [Authorize(Policy = "AdminOnly")] async (Guid eventId, CreateEditionCommand command, IMediator mediator) =>
{
    if (eventId != command.EventId) return Results.BadRequest("EventId mismatch");
    var id = await mediator.Send(command);
    return Results.Created($"/api/v1/admin/events/{eventId}/editions/{id}", new { id });
})
.WithName("CreateEdition");

app.MapPut("/api/v1/admin/editions/{id:guid}", [Authorize(Policy = "AdminOnly")] async (Guid id, UpdateEditionCommand command, IMediator mediator) =>
{
    if (id != command.Id) return Results.BadRequest("ID mismatch");
    var success = await mediator.Send(command);
    return success ? Results.NoContent() : Results.NotFound();
})
.WithName("UpdateEdition");

app.MapDelete("/api/v1/admin/editions/{id:guid}", [Authorize(Policy = "AdminOnly")] async (Guid id, IMediator mediator) =>
{
    var success = await mediator.Send(new DeleteEditionCommand(id));
    return success ? Results.NoContent() : Results.NotFound();
})
.WithName("DeleteEdition");

app.MapPost("/api/v1/admin/editions/{id:guid}/cancel", [Authorize(Policy = "AdminOnly")] async (Guid id, IMediator mediator) =>
{
    var success = await mediator.Send(new CancelEditionCommand(id));
    return success ? Results.NoContent() : Results.NotFound();
})
.WithName("CancelEdition");

app.MapPost("/api/v1/admin/events/{eventId:guid}/editions/generate", [Authorize(Policy = "AdminOnly")] async (Guid eventId, GenerateEditionsForSeasonCommand command, IMediator mediator) =>
{
    if (eventId != command.EventId) return Results.BadRequest("EventId mismatch");
    var result = await mediator.Send(command);
    return Results.Ok(new { editionIds = result.EditionIds, count = result.EditionIds.Count, racesCreated = result.RacesCreated });
})
.WithName("GenerateEditionsForSeason");

// Admin Race CRUD
app.MapPost("/api/v1/admin/editions/{editionId:guid}/races", [Authorize(Policy = "AdminOnly")] async (Guid editionId, CreateRaceCommand command, IMediator mediator) =>
{
    if (editionId != command.EventEditionId) return Results.BadRequest("EventEditionId mismatch");
    var id = await mediator.Send(command);
    return Results.Created($"/api/v1/admin/editions/{editionId}/races/{id}", new { id });
})
.WithName("CreateRace");

app.MapPut("/api/v1/admin/races/{id:guid}", [Authorize(Policy = "AdminOnly")] async (Guid id, UpdateRaceCommand command, IMediator mediator) =>
{
    if (id != command.Id) return Results.BadRequest("ID mismatch");
    var success = await mediator.Send(command);
    return success ? Results.NoContent() : Results.NotFound();
})
.WithName("UpdateRace");

app.MapDelete("/api/v1/admin/races/{id:guid}", [Authorize(Policy = "AdminOnly")] async (Guid id, IMediator mediator) =>
{
    var success = await mediator.Send(new DeleteRaceCommand(id));
    return success ? Results.NoContent() : Results.NotFound();
})
.WithName("DeleteRace");

app.MapPost("/api/v1/admin/events/detect-gpx", [Authorize(Policy = "AdminOnly")] async (UtanvegaDbContext context, HttpContext httpContext) =>
{
    var events = await context.Events
        .Where(e => e.GpxPointLat == null)
        .Include(e => e.Editions)
            .ThenInclude(ed => ed.Races)
                .ThenInclude(r => r.Trail)
        .Include(e => e.Editions)
            .ThenInclude(ed => ed.Trail)
        .ToListAsync();

    var total = events.Count;
    var updated = 0;
    var skipped = 0;

    foreach (var ev in events)
    {
        // Collect candidate trails: edition-level trail first, then race-level trails
        var candidateTrails = ev.Editions
            .SelectMany(ed =>
            {
                var trails = new List<Trail?>();
                if (ed.Trail?.GpxData != null) trails.Add(ed.Trail);
                trails.AddRange(ed.Races.Select(r => r.Trail).Where(t => t?.GpxData != null));
                return trails;
            })
            .Where(t => t?.GpxData != null && t.GpxData.NumPoints > 0)
            .ToList();

        if (candidateTrails.Count == 0) { skipped++; continue; }

        var trail = candidateTrails.First();
        var start = trail!.GpxData!.Coordinates[0];
        ev.GpxPointLat = start.Y;
        ev.GpxPointLng = start.X;
        updated++;
    }

    if (updated > 0) await context.SaveChangesWithAuditAsync(GetAuthenticatedUserId(httpContext));
    return Results.Ok(new { total, updated, skipped });
})
.WithName("DetectEventGpx");

// User Trail Activities Endpoints
app.MapPost("/api/v1/user/activities", [Authorize] async (IMediator mediator, HttpContext context, CreateUserTrailActivityDto dto) =>
{
    try
    {
        // Try multiple claim names (Supabase uses "nameidentifier" from JWT "sub")
        var userIdClaim = context.User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")
            ?? context.User.FindFirst("sub")
            ?? context.User.FindFirst("user_id")
            ?? context.User.FindFirst("uid");
        
        if (userIdClaim?.Value is null)
        {
            var claims = string.Join(", ", context.User.Claims.Select(c => $"{c.Type}={c.Value}"));
            throw new UnauthorizedAccessException($"User ID not found in token. Available claims: {claims}");
        }
        
        var userId = Guid.Parse(userIdClaim.Value);
        
        var command = new CreateUserTrailActivityCommand(
            userId,
            dto.TrailSlug,
            dto.LogDate,
            dto.TimeInSeconds,
            dto.Distance,
            dto.ElevationGain,
            dto.Notes,
            dto.IsPublic
        );

        var result = await mediator.Send(command);
        return Results.Created($"/api/v1/user/activities/{result.Id}", result);
    }
    catch (UnauthorizedAccessException ex)
    {
        Log.Warning("Unauthorized access to create activity: {Message}", ex.Message);
        return Results.Forbid();
    }
    catch (InvalidOperationException ex)
    {
        Log.Error("Invalid operation creating activity: {Message}", ex.Message);
        return Results.NotFound(new { message = ex.Message });
    }
    catch (FormatException ex)
    {
        Log.Error("Format error creating activity: {Message}", ex.Message);
        return Results.BadRequest(new { message = "Invalid input format" });
    }
    catch (DbUpdateException ex) when (ex.InnerException is PostgresException pg)
    {
        Log.Error(ex, "Database error creating activity. SqlState={SqlState} Detail={Detail}", pg.SqlState, pg.Detail);
        
        // Handle unique constraint violation (SQL state 23505)
        if (pg.SqlState == "23505" && pg.MessageText.Contains("IX_UserTrailActivities_UserId_TrailSlug_LogDate"))
        {
            return Results.Conflict(new 
            { 
                message = "You already have an activity logged for this trail on this date. Please edit the existing activity or choose a different date.",
                messageIs = "Þú hefur þegar skráð æfingu fyrir þessa leið á þessum degi. Vinsamlegast breyttu núverandi æfingu eða veldu aðra dagsetningu."
            });
        }
        
        return Results.Problem(
            title: "Failed to create activity",
            detail: "A database error occurred while saving the activity.",
            statusCode: StatusCodes.Status500InternalServerError);
    }
    catch (DbUpdateException ex)
    {
        Log.Error(ex, "Database update error creating activity");
        return Results.Problem(
            title: "Failed to create activity",
            detail: ex.InnerException?.Message ?? ex.Message,
            statusCode: StatusCodes.Status500InternalServerError);
    }
    catch (Exception ex)
    {
        Log.Error(ex, "Unexpected error creating activity");
        return Results.Problem("Internal server error");
    }
})
.WithName("CreateActivity");

app.MapPut("/api/v1/user/activities/{id:guid}", [Authorize] async (Guid id, IMediator mediator, HttpContext context, UpdateUserTrailActivityDto dto) =>
{
    try
    {
        var userIdClaim = context.User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")
            ?? context.User.FindFirst("sub")
            ?? context.User.FindFirst("user_id")
            ?? context.User.FindFirst("uid");
        
        if (userIdClaim?.Value is null)
        {
            throw new UnauthorizedAccessException("User ID not found in token");
        }
        
        var userId = Guid.Parse(userIdClaim.Value);
        
        var command = new UpdateUserTrailActivityCommand(
            id,
            userId,
            dto.LogDate,
            dto.TimeInSeconds,
            dto.Distance,
            dto.ElevationGain,
            dto.Notes,
            dto.IsPublic
        );

        var result = await mediator.Send(command);
        return Results.Ok(result);
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }
    catch (InvalidOperationException ex)
    {
        return Results.NotFound(new { message = ex.Message });
    }
    catch (DbUpdateException ex) when (ex.InnerException is PostgresException pg)
    {
        Log.Error(ex, "Database error updating activity. SqlState={SqlState}", pg.SqlState);
        
        // Handle unique constraint violation (SQL state 23505)
        if (pg.SqlState == "23505" && pg.MessageText.Contains("IX_UserTrailActivities_UserId_TrailSlug_LogDate"))
        {
            return Results.Conflict(new 
            { 
                message = "You already have an activity logged for this trail on this date. Please choose a different date.",
                messageIs = "Þú hefur þegar skráð æfingu fyrir þessa leið á þessum degi. Vinsamlegast veldu aðra dagsetningu."
            });
        }

        return Results.Problem(
            title: "Failed to update activity",
            detail: "Database error occurred while updating the activity",
            statusCode: StatusCodes.Status500InternalServerError);
    }
    catch (Exception ex)
    {
        Log.Error(ex, "Unexpected error updating activity");
        return Results.Problem("Internal server error");
    }
})
.WithName("UpdateActivity");

app.MapDelete("/api/v1/user/activities/{id:guid}", [Authorize] async (Guid id, IMediator mediator, HttpContext context) =>
{
    try
    {
        var userIdClaim = context.User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")
            ?? context.User.FindFirst("sub")
            ?? context.User.FindFirst("user_id")
            ?? context.User.FindFirst("uid");
        
        if (userIdClaim?.Value is null)
        {
            throw new UnauthorizedAccessException("User ID not found in token");
        }
        
        var userId = Guid.Parse(userIdClaim.Value);
        
        var command = new DeleteUserTrailActivityCommand(id, userId);

        await mediator.Send(command);
        return Results.NoContent();
    }
    catch (UnauthorizedAccessException)
    {
        return Results.Forbid();
    }
    catch (InvalidOperationException ex)
    {
        return Results.NotFound(new { message = ex.Message });
    }
})
.WithName("DeleteActivity");

app.MapGet("/api/v1/user/activities", [Authorize] async (IMediator mediator, HttpContext context) =>
{
    try
    {
        // Try multiple claim names (Supabase uses "nameidentifier" which maps from JWT "sub")
        var userIdClaim = context.User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")
            ?? context.User.FindFirst("sub")
            ?? context.User.FindFirst("user_id")
            ?? context.User.FindFirst("uid");
        
        if (userIdClaim?.Value is null)
        {
            var claims = string.Join(", ", context.User.Claims.Select(c => $"{c.Type}={c.Value}"));
            Log.Warning("User ID not found in token. Available claims: {Claims}", claims);
            throw new UnauthorizedAccessException($"User ID not found in token. Available claims: {claims}");
        }
        
        Log.Information("Found user ID claim: {ClaimType} = {ClaimValue}", userIdClaim.Type, userIdClaim.Value);
        if (!Guid.TryParse(userIdClaim.Value, out var userId))
        {
            Log.Warning("User ID claim value is not a valid GUID: {Value}", userIdClaim.Value);
            return Results.Forbid();
        }
        Log.Information("Parsed userId: {UserId}", userId);
        
        Log.Information("Creating GetUserTrailActivitiesQuery for userId: {UserId}", userId);
        var query = new GetUserTrailActivitiesQuery(userId);
        
        Log.Information("Sending query via MediatR");
        var result = await mediator.Send(query);
        
        Log.Information("Successfully fetched {Count} activities for user {UserId}", result.Activities.Count(), userId);
        return Results.Ok(result.Activities);
    }
    catch (UnauthorizedAccessException ex)
    {
        Log.Warning("Unauthorized access to activities: {Message}", ex.Message);
        return Results.Forbid();
    }
    catch (InvalidOperationException ex)
    {
        Log.Error(ex, "Invalid operation fetching activities: {Message}", ex.Message);
        return Results.NotFound(new { message = ex.Message });
    }
    catch (Exception ex)
    {
        Log.Error(ex, "Unexpected error fetching activities: {Message}", ex.Message);
        return Results.Problem("Internal server error");
    }
})
.WithName("GetUserActivities");

app.MapPost("/api/v1/tips", async (SendTipRequest request, IMediator mediator, ILogger<Program> logger) =>
{
    if (string.IsNullOrWhiteSpace(request.Message) || request.Message.Length > 2000)
        return Results.BadRequest("Message is required and must be under 2000 characters.");

    if (string.IsNullOrWhiteSpace(request.PageUrl))
        return Results.BadRequest("PageUrl is required.");

    try
    {
        await mediator.Send(new SendTipCommand(request.PageUrl, request.Message));
        return Results.Ok();
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Failed to send tip for page {PageUrl}", request.PageUrl);
        return Results.Problem("Failed to send tip. Please try again later.");
    }
})
.WithName("SendTip")
.RequireRateLimiting("send-tip");

// --- Beta Feedback ---

app.MapPost("/api/v1/feedback", async (SubmitFeedbackRequest req, IMediator mediator, ILogger<Program> logger) =>
{
    if (string.IsNullOrWhiteSpace(req.Message) || req.Message.Length > 2000)
        return Results.BadRequest("Message is required and must be under 2000 characters.");
    if (string.IsNullOrWhiteSpace(req.PageUrl))
        return Results.BadRequest("PageUrl is required.");
    if (req.Email is not null)
    {
        try { _ = new System.Net.Mail.MailAddress(req.Email); }
        catch { return Results.BadRequest("Email format is invalid."); }
    }
    if (req.ScreenshotUrl?.Length > 500_000)
        return Results.BadRequest("Screenshot exceeds maximum allowed size.");

    try
    {
        var id = await mediator.Send(new SubmitFeedbackCommand(
            req.PageUrl, req.Message, req.Category, req.Name, req.Email,
            req.StepsToReproduce, req.BrowserInfo, req.ScreenshotUrl));
        return Results.Ok(new { id });
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Failed to save feedback for page {PageUrl}", req.PageUrl);
        return Results.Problem("Failed to save feedback. Please try again later.");
    }
})
.WithName("SubmitFeedback")
.RequireRateLimiting("send-feedback");

app.MapGet("/api/v1/admin/feedback", [Authorize(Policy = "AdminOnly")] async (
    IMediator mediator, string? status, int page = 1, int pageSize = 25, string? sortBy = null, string? sortDir = null, string? search = null) =>
{
    var result = await mediator.Send(new GetFeedbackQuery(status, page, pageSize, sortBy, sortDir, search));
    return Results.Ok(result);
})
.WithName("GetFeedback");

app.MapPatch("/api/v1/admin/feedback/{id:guid}", [Authorize(Policy = "AdminOnly")] async (
    Guid id, PatchFeedbackRequest req, IMediator mediator) =>
{
    var ok = await mediator.Send(new PatchFeedbackCommand(
        id, req.Status, req.Priority, req.GitHubIssue, req.ClearGitHubIssue ?? false, req.AdminComment));
    return ok ? Results.NoContent() : Results.NotFound();
})
.WithName("PatchFeedback");

if (isMigrateMode)
{
    var directUrlUsed = builder.Configuration["DIRECT_DATABASE_URL"] is not null;
    Log.Information("Running database migrations (using {UrlType} connection)...",
        directUrlUsed ? "DIRECT_DATABASE_URL" : "DATABASE_URL");
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<UtanvegaDbContext>();
    await db.Database.MigrateAsync();
    Log.Information("Database migrations applied successfully");
    Log.CloseAndFlush();
    return;
}

try
{
    app.Run();
}
finally
{
    Log.CloseAndFlush();
}

public record SendTipRequest(string PageUrl, string Message);
public record SubmitFeedbackRequest(
    string PageUrl, string Message, string? Category, string? Name, string? Email,
    string? StepsToReproduce, string? BrowserInfo, string? ScreenshotUrl);
public record PatchFeedbackRequest(
    string? Status, string? Priority, int? GitHubIssue, bool? ClearGitHubIssue, string? AdminComment);
public record TagCreateDto(string Name, string? Color, string? NameEn = null, Dictionary<string, string>? TranslationHashes = null);
public record TranslateRequest(List<string> Texts);
public record BulkAddTagRequest(List<Guid> TrailIds, Guid TagId);
public record TrailLocationAddRequest(Guid LocationId, string? Role);
public record FeatureFlagCreateDto(string Name, bool Enabled = true, string? Description = null);
public record FeatureFlagUpdateDto(bool? Enabled, string? Description);
public record CreateUserTrailActivityDto(
    string TrailSlug,
    DateOnly? LogDate,
    int TimeInSeconds,
    decimal? Distance,
    int? ElevationGain,
    string? Notes,
    bool IsPublic
);
public record UpdateUserTrailActivityDto(
    DateOnly? LogDate,
    int TimeInSeconds,
    decimal? Distance,
    int? ElevationGain,
    string? Notes,
    bool IsPublic
);
