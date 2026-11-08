using MediatR;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using Npgsql;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Application.Locations;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Core.Services;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Locations.Commands.CreateLocation;

public record CreateLocationCommand(
    string Name,
    string? Slug,
    string? Description,
    string Type,
    Guid? ParentId,
    double? Latitude,
    double? Longitude,
    double? Radius,
    string? CreatedBy,
    string? NameEn = null,
    string? DescriptionEn = null,
    string? ActorUserId = null,
    // #1705: one-time IS 50V import payload. When set, overrides Center with the polygon's
    // centroid — see CreateLocationCommandHandler.
    string? BoundaryGeoJson = null
) : IRequest<Guid>;

public class CreateLocationCommandHandler : IRequestHandler<CreateLocationCommand, Guid>
{
    // Must match the unique index EF Core generates for Location.Slug (see
    // backend/Migrations/UtanvegaDbContextModelSnapshot.cs) — the default naming convention gives
    // "IX_{Table}_{Property}", i.e. IX_Locations_Slug, since neither the entity config nor the
    // migration overrides it with HasDatabaseName.
    private const string SlugUniqueIndexName = "IX_Locations_Slug";

    private readonly UtanvegaDbContext _context;
    private readonly ICacheInvalidator _cacheInvalidator;

    public CreateLocationCommandHandler(UtanvegaDbContext context, ICacheInvalidator cacheInvalidator)
    {
        _context = context;
        _cacheInvalidator = cacheInvalidator;
    }

    public async Task<Guid> Handle(CreateLocationCommand request, CancellationToken cancellationToken)
    {
        var slug = request.Slug ?? SlugGenerator.Generate(request.Name);

        var slugExists = await _context.Locations.AnyAsync(l => l.Slug == slug, cancellationToken);
        if (slugExists)
            throw new InvalidOperationException($"A location with slug '{slug}' already exists.");

        Enum.TryParse<LocationType>(request.Type, true, out var type);

        Point? center = null;
        if (request.Latitude.HasValue && request.Longitude.HasValue)
        {
            center = new Point(request.Longitude.Value, request.Latitude.Value) { SRID = 4326 };
        }

        // #1705: a provided boundary wins over Lat/Lon — Center becomes the polygon's centroid so
        // every existing Center consumer (e.g. GetEventClimateQuery) keeps working unchanged.
        // The validator has already rejected a malformed/non-Polygon/self-intersecting value by
        // the time the handler runs, so TryParse here is only expected to fail on a null input.
        Polygon? boundary = null;
        if (request.BoundaryGeoJson != null &&
            LocationBoundaryParser.TryParse(request.BoundaryGeoJson, out var parsedBoundary, out _))
        {
            boundary = parsedBoundary;
            center = (Point)boundary!.Centroid;
            center.SRID = 4326;
        }

        var location = new Utanvega.Backend.Core.Entities.Location
        {
            Name = request.Name,
            NameEn = request.NameEn,
            Slug = slug,
            Description = request.Description,
            DescriptionEn = request.DescriptionEn,
            Type = type,
            ParentId = request.ParentId,
            Center = center,
            Radius = request.Radius,
            Boundary = boundary,
            CreatedBy = request.CreatedBy,
            CreatedAt = DateTime.UtcNow
        };

        _context.Locations.Add(location);

        try
        {
            await _context.SaveChangesWithAuditAsync(request.ActorUserId);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException
               { SqlState: "23505", ConstraintName: SlugUniqueIndexName })
        {
            throw new InvalidOperationException($"A location with slug '{slug}' already exists.");
        }

        _cacheInvalidator.InvalidateLocation(slug);

        return location.Id;
    }
}
