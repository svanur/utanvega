using System.Text.Json;
using MediatR;
using Serilog;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Trails.Queries.GetTrails;

public record GetTrailsQuery(bool IncludeArchived = false, bool PublishedOnly = false) : IRequest<List<TrailDto>>, ICacheable
{
    public string CacheKey => CacheKeys.Trails(IncludeArchived, PublishedOnly);
    public TimeSpan CacheDuration => TimeSpan.FromHours(1);
}

public record LocationInfoDto(Guid Id, string Name, string? NameEn, string Slug, int Order, string Role, double? CenterLatitude = null, double? CenterLongitude = null);

public record TagInfoDto(string Name, string? NameEn, string Slug, string? Color);

public record LinkedRaceDto(
    string EventName,
    string EventSlug,
    string RaceName,
    string? DistanceLabel,
    int? DaysUntil,
    string? StartTime,
    string? TicketStatus,
    int? ItraPoints
);

public record TrailDto(
    Guid Id,
    string Name,
    string Slug,
    string? Description,
    double Length,
    double ElevationGain,
    double ElevationLoss,
    string Status,
    string ActivityType,
    string TrailType,
    string Difficulty,
    double? StartLatitude,
    double? StartLongitude,
    List<LocationInfoDto> Locations,
    List<TagInfoDto> Tags,
    int ViewCount = 0,
    List<LinkedRaceDto>? LinkedRaces = null,
    string? YoutubeUrl = null,
    double[]? ElevationProfile = null,
    DateTime? UpdatedAt = null,
    DateTime CreatedAt = default,
    string? TerrainType = null,
    string? NameEn = null,
    string? DescriptionEn = null,
    Dictionary<string, string>? TranslationHashes = null,
    bool NeedsReview = false
);

public class GetTrailsQueryHandler : IRequestHandler<GetTrailsQuery, List<TrailDto>>
{
    private readonly UtanvegaDbContext _context;

    public GetTrailsQueryHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<List<TrailDto>> Handle(GetTrailsQuery request, CancellationToken cancellationToken)
    {
        var baseQuery = _context.Trails
            .AsNoTracking()
            .AsQueryable();

        if (!request.IncludeArchived)
            baseQuery = baseQuery.Where(t => t.Status != TrailStatus.Archived);

        if (request.PublishedOnly)
            baseQuery = baseQuery.Where(t => t.Status == TrailStatus.Published);

        // Project in SQL — excludes GpxData (full geometry) and ElevationProfile,
        // which are large columns not needed for the list view.
        var trails = await baseQuery
            .Select(t => new
            {
                t.Id,
                t.Name,
                t.Slug,
                t.Description,
                t.DescriptionEn,
                t.NameEn,
                t.Length,
                t.ElevationGain,
                t.ElevationLoss,
                t.Status,
                t.ActivityTypeId,
                t.Type,
                t.Difficulty,
                t.YoutubeUrl,
                t.UpdatedAt,
                t.CreatedAt,
                t.TerrainType,
                t.TranslationHashes,
                t.NeedsReview,
                HasGpx = t.GpxData != null,
                Locations = t.TrailLocations
                    .OrderBy(tl => tl.Order)
                    .Select(tl => new LocationInfoDto(tl.LocationId, tl.Location.Name, tl.Location.NameEn, tl.Location.Slug, tl.Order, tl.Role.ToString(), tl.Location.Center != null ? (double?)tl.Location.Center.Y : null, tl.Location.Center != null ? (double?)tl.Location.Center.X : null))
                    .ToList(),
                Tags = t.TrailTags
                    .Select(tt => new TagInfoDto(tt.Tag.Name, tt.Tag.NameEn, tt.Tag.Slug, tt.Tag.Color))
                    .ToList(),
            })
            .ToListAsync(cancellationToken);

        // GpxData is typed as Geometry (base class) — EF can't translate a (LineString) cast to SQL.
        // Load just the start point for trails that have GPX data in a separate focused query.
        var trailIdsWithGpx = trails.Where(t => t.HasGpx).Select(t => t.Id).ToHashSet();
        var startCoords = trailIdsWithGpx.Count > 0
            ? (await _context.Trails.AsNoTracking()
                .Where(t => trailIdsWithGpx.Contains(t.Id) && t.GpxData != null)
                .Select(t => new { t.Id, t.GpxData })
                .ToListAsync(cancellationToken))
                .ToDictionary(t => t.Id, t => t.GpxData as LineString)
            : new Dictionary<Guid, LineString?>();

        Dictionary<Guid, int> viewCounts;
        try
        {
            viewCounts = await _context.TrailViews
                .GroupBy(v => v.TrailId)
                .Select(g => new { TrailId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.TrailId, x => x.Count, cancellationToken);
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Failed to fetch trail view counts, returning zero counts");
            viewCounts = new Dictionary<Guid, int>();
        }

        var result = trails.Select(t => new TrailDto(
            t.Id,
            t.Name,
            t.Slug,
            t.Description,
            t.Length,
            t.ElevationGain,
            t.ElevationLoss,
            t.Status.ToString(),
            t.ActivityTypeId.ToString(),
            t.Type.ToString(),
            t.Difficulty.ToString(),
            startCoords.TryGetValue(t.Id, out var ls) ? ls?.StartPoint.Y : null,
            startCoords.TryGetValue(t.Id, out var ls2) ? ls2?.StartPoint.X : null,
            t.Locations,
            t.Tags,
            viewCounts.GetValueOrDefault(t.Id, 0),
            YoutubeUrl: t.YoutubeUrl,
            ElevationProfile: null,
            UpdatedAt: t.UpdatedAt,
            CreatedAt: t.CreatedAt,
            TerrainType: t.TerrainType?.ToString(),
            NameEn: t.NameEn,
            DescriptionEn: t.DescriptionEn,
            TranslationHashes: t.TranslationHashes == null ? null : JsonSerializer.Deserialize<Dictionary<string, string>>(t.TranslationHashes),
            NeedsReview: t.NeedsReview
        )).ToList();

        return result;
    }
}
