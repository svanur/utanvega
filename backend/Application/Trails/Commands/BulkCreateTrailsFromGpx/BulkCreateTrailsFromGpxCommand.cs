using MediatR;
using NetTopologySuite.Geometries;
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

    public BulkCreateTrailsFromGpxCommandHandler(UtanvegaDbContext context, LocationDetector locationDetector)
    {
        _context = context;
        _singleHandler = new CreateTrailFromGpxCommandHandler(context, locationDetector);
        _locationDetector = locationDetector;
    }

    public async Task<List<Guid>> Handle(BulkCreateTrailsFromGpxCommand request, CancellationToken cancellationToken)
    {
        var resultIds = new List<Guid>();

        foreach (var file in request.Files)
        {
            try
            {
                var trail = _singleHandler.ProcessGpx(file.Name, file.GpxXml);
                
                // Check if slug already exists to avoid unique constraint violation
                var existing = await _context.Trails.AnyAsync(t => t.Slug == trail.Slug, cancellationToken);
                if (existing)
                {
                    trail.Slug += "-" + Guid.NewGuid().ToString().Substring(0, 4);
                }

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

        return resultIds;
    }
}
