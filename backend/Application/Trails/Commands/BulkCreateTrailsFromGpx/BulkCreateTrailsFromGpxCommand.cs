using MediatR;
using NetTopologySuite.Geometries;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Core.Services;
using Utanvega.Backend.Infrastructure.Persistence;
using System.Xml.Linq;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Trails.Commands.CreateTrailFromGpx;

namespace Utanvega.Backend.Application.Trails.Commands.BulkCreateTrailsFromGpx;

public record GpxFileInfo(string? Name, string GpxXml);

public record BulkCreateTrailsFromGpxCommand(List<GpxFileInfo> Files) : IRequest<List<Guid>>;

public class BulkCreateTrailsFromGpxCommandHandler : IRequestHandler<BulkCreateTrailsFromGpxCommand, List<Guid>>
{
    private readonly UtanvegaDbContext _context;
    private readonly CreateTrailFromGpxCommandHandler _singleHandler;
    private readonly LocationDetector _locationDetector;
    private readonly ICacheInvalidator _cacheInvalidator;

    public BulkCreateTrailsFromGpxCommandHandler(UtanvegaDbContext context, LocationDetector locationDetector, ICacheInvalidator cacheInvalidator)
    {
        _context = context;
        _singleHandler = new CreateTrailFromGpxCommandHandler(context, locationDetector, cacheInvalidator);
        _locationDetector = locationDetector;
        _cacheInvalidator = cacheInvalidator;
    }

    public async Task<List<Guid>> Handle(BulkCreateTrailsFromGpxCommand request, CancellationToken cancellationToken)
    {
        var resultIds = new List<Guid>();
        var usedSlugs = new HashSet<string>();

        foreach (var file in request.Files)
        {
            try
            {
                var trail = _singleHandler.ProcessGpx(file.Name, file.GpxXml);
                
                // Check if slug already exists in DB or in this batch
                var existing = await _context.Trails.AnyAsync(t => t.Slug == trail.Slug, cancellationToken);
                while (existing || usedSlugs.Contains(trail.Slug))
                {
                    trail.Slug += "-" + Guid.NewGuid().ToString()[..4];
                    existing = await _context.Trails.AnyAsync(t => t.Slug == trail.Slug, cancellationToken);
                }

                usedSlugs.Add(trail.Slug);
                _context.Trails.Add(trail);

                // Auto-detect and link locations
                await _locationDetector.DetectAndLinkAsync(trail, cancellationToken);

                resultIds.Add(trail.Id);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERROR] Failed to process GPX file '{file.Name ?? "Unnamed"}': {ex.Message}");
                throw; 
            }
        }

        await _context.SaveChangesWithAuditAsync("system");
        _cacheInvalidator.InvalidateTrail();

        return resultIds;
    }
}
