using System.Text.Json;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Trails.Commands.UpdateTrail;

public record TrailLocationUpdateDto(
    Guid LocationId,
    string Role,
    int Order
);

public record UpdateTrailCommand(
    Guid Id,
    string Name,
    string Slug,
    string? Description,
    string ActivityType,
    string Status,
    string Type,
    string Difficulty,
    string Visibility,
    string? UpdatedBy,
    string? YoutubeUrl = null,
    List<TrailLocationUpdateDto>? Locations = null,
    List<Guid>? TagIds = null,
    string? TerrainType = null,
    string? NameEn = null,
    string? DescriptionEn = null,
    Dictionary<string, string>? TranslationHashes = null,
    bool? NeedsReview = null
) : IRequest<bool>;

public class UpdateTrailCommandHandler : IRequestHandler<UpdateTrailCommand, bool>
{
    private readonly UtanvegaDbContext _context;
    private readonly ICacheInvalidator _cacheInvalidator;

    public UpdateTrailCommandHandler(UtanvegaDbContext context, ICacheInvalidator cacheInvalidator)
    {
        _context = context;
        _cacheInvalidator = cacheInvalidator;
    }

    public async Task<bool> Handle(UpdateTrailCommand request, CancellationToken cancellationToken)
    {
        var trail = await _context.Trails
            .Include(t => t.TrailLocations)
            .Include(t => t.TrailTags)
            .FirstOrDefaultAsync(t => t.Id == request.Id, cancellationToken);

        if (trail == null) return false;

        // GpxData and ElevationProfile are never modified here — exclude them from
        // the change-tracker snapshot so EF skips diffing and updating these large columns.
        var entry = _context.Entry(trail);
        entry.Property(t => t.GpxData).IsModified = false;
        entry.Property(t => t.ElevationProfile).IsModified = false;

        var oldSlug = trail.Slug;
        trail.Name = request.Name;
        
        // Reject if slug is taken by a different non-deleted trail
        var slugTaken = await _context.Trails.AnyAsync(
            t => t.Slug == request.Slug && t.Id != request.Id && t.Status != TrailStatus.Archived, cancellationToken);
        if (slugTaken)
        {
            throw new InvalidOperationException($"A trail with slug '{request.Slug}' already exists.");
        }
        trail.Slug = request.Slug;
        
        trail.Description = request.Description;
        trail.NameEn = request.NameEn;
        trail.DescriptionEn = request.DescriptionEn;
        if (request.TranslationHashes != null)
            trail.TranslationHashes = JsonSerializer.Serialize(request.TranslationHashes);
        trail.YoutubeUrl = request.YoutubeUrl;
        
        if (Enum.TryParse<ActivityType>(request.ActivityType, true, out var activityType))
        {
            trail.ActivityTypeId = activityType;
        }
        else
        {
            // If the value is "TrailRunnin" or similar, we want to match it to TrailRunning
            if (request.ActivityType.StartsWith("TrailRunnin", StringComparison.OrdinalIgnoreCase))
            {
                trail.ActivityTypeId = ActivityType.TrailRunning;
            }
        }
            
        if (Enum.TryParse<TrailStatus>(request.Status, true, out var status))
            trail.Status = status;
            
        if (Enum.TryParse<Difficulty>(request.Difficulty, true, out var difficulty))
            trail.Difficulty = difficulty;
            
        if (Enum.TryParse<Visibility>(request.Visibility, true, out var visibility))
            trail.Visibility = visibility;
            
        if (Enum.TryParse<TrailType>(request.Type, true, out var trailType))
            trail.Type = trailType;

        if (request.TerrainType != null)
        {
            if (!Enum.TryParse<TerrainType>(request.TerrainType, ignoreCase: true, out var parsedTerrain))
                throw new ValidationException($"Invalid TerrainType value: '{request.TerrainType}'.");
            trail.TerrainType = parsedTerrain;
        }
        else
        {
            trail.TerrainType = null;
        }

        // Null means "not supplied" — the edit form doesn't own this flag, so leave it alone
        // rather than clearing a bookmark set from the detail page.
        if (request.NeedsReview is not null)
            trail.NeedsReview = request.NeedsReview.Value;

        trail.UpdatedBy = request.UpdatedBy;
        trail.UpdatedAt = DateTime.UtcNow;

        // Sync Locations
        if (request.Locations != null)
        {
            var currentLocations = trail.TrailLocations.ToList();
            var requestedLocations = request.Locations.ToList();

            // Remove locations not in the request
            foreach (var current in currentLocations)
            {
                var roleString = current.Role.ToString();
                if (!requestedLocations.Any(r => r.LocationId == current.LocationId && string.Equals(r.Role, roleString, StringComparison.OrdinalIgnoreCase)))
                {
                    _context.TrailLocations.Remove(current);
                }
            }

            // Add or Update locations
            foreach (var requested in requestedLocations)
            {
                if (Enum.TryParse<TrailLocationRole>(requested.Role, true, out var role))
                {
                    var existing = currentLocations.FirstOrDefault(c => c.LocationId == requested.LocationId && c.Role == role);
                    if (existing != null)
                    {
                        existing.Order = requested.Order;
                    }
                    else
                    {
                        var newTL = new TrailLocation
                        {
                            TrailId = trail.Id,
                            LocationId = requested.LocationId,
                            Role = role,
                            Order = requested.Order
                        };
                        _context.TrailLocations.Add(newTL);
                    }
                }
            }
        }

        // Sync Tags
        if (request.TagIds != null)
        {
            var currentTags = trail.TrailTags.ToList();
            var requestedTagIds = request.TagIds.ToHashSet();

            // Remove tags not in the request
            foreach (var current in currentTags)
            {
                if (!requestedTagIds.Contains(current.TagId))
                    _context.TrailTags.Remove(current);
            }

            // Add new tags
            var existingTagIds = currentTags.Select(t => t.TagId).ToHashSet();
            foreach (var tagId in requestedTagIds)
            {
                if (!existingTagIds.Contains(tagId))
                {
                    _context.TrailTags.Add(new TrailTag { TrailId = trail.Id, TagId = tagId });
                }
            }
        }

        await _context.SaveChangesWithAuditAsync(request.UpdatedBy);
        _cacheInvalidator.InvalidateTrail(oldSlug);
        if (oldSlug != request.Slug)
            _cacheInvalidator.InvalidateTrail(request.Slug);

        // Invalidate events that have races linked to this trail
        var affectedEventSlugs = await _context.Races
            .Where(r => r.TrailId == trail.Id)
            .Select(r => r.EventEdition.Event.Slug)
            .Distinct()
            .ToListAsync(cancellationToken);
        foreach (var slug in affectedEventSlugs)
            _cacheInvalidator.InvalidateEvent(slug);

        return true;
    }
}
