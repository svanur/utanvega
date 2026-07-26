using MediatR;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Core.Services;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Events.Commands.CreateEvent;

public record CreateEventCommand(
    string Name,
    string? Slug,
    string? Description,
    string Type,
    string ActivityType,
    string Status,
    string? OrganizerName,
    string? OrganizerWebsite,
    string? AlertMessage,
    string? AlertSeverity,
    Guid? LocationId,
    ScheduleRule? ScheduleRule,
    List<SocialLink>? SocialLinks,
    double? GpxPointLat = null,
    double? GpxPointLng = null
) : IRequest<Guid>;

public class CreateEventCommandHandler : IRequestHandler<CreateEventCommand, Guid>
{
    private readonly UtanvegaDbContext _context;
    private readonly ICacheInvalidator _cacheInvalidator;

    public CreateEventCommandHandler(UtanvegaDbContext context, ICacheInvalidator cacheInvalidator)
    {
        _context = context;
        _cacheInvalidator = cacheInvalidator;
    }

    public async Task<Guid> Handle(CreateEventCommand request, CancellationToken cancellationToken)
    {
        var slug = request.Slug ?? SlugGenerator.Generate(request.Name);

        Enum.TryParse<EventType>(request.Type, ignoreCase: true, out var type);
        Enum.TryParse<ActivityType>(request.ActivityType, ignoreCase: true, out var activityType);
        Enum.TryParse<EventStatus>(request.Status, ignoreCase: true, out var status);

        var ev = new Core.Entities.Event
        {
            Name = request.Name,
            Slug = slug,
            Description = request.Description,
            Type = type,
            ActivityType = activityType,
            Status = status,
            OrganizerName = request.OrganizerName,
            OrganizerWebsite = request.OrganizerWebsite,
            AlertMessage = request.AlertMessage,
            AlertSeverity = request.AlertSeverity,
            LocationId = request.LocationId,
            ScheduleRule = request.ScheduleRule,
            SocialLinks = request.SocialLinks,
            GpxPointLat = request.GpxPointLat,
            GpxPointLng = request.GpxPointLng,
            CreatedAt = DateTime.UtcNow,
        };

        _context.Events.Add(ev);
        await _context.SaveChangesAsync(cancellationToken);
        _cacheInvalidator.InvalidateEvent(slug);

        return ev.Id;
    }
}
