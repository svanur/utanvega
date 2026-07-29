using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Events.Commands.UpdateEvent;

public record UpdateEventCommand(
    Guid Id,
    string Name,
    string? Description,
    string Type,
    string ActivityType,
    string Status,
    string? OrganizerName,
    string? OrganizerWebsite,
    Guid? OrganizerId,
    string? AlertMessage,
    string? AlertSeverity,
    Guid? LocationId,
    ScheduleRule? ScheduleRule,
    List<SocialLink>? SocialLinks,
    double? GpxPointLat,
    double? GpxPointLng
) : IRequest<bool>;

public class UpdateEventCommandHandler : IRequestHandler<UpdateEventCommand, bool>
{
    private readonly UtanvegaDbContext _context;
    private readonly ICacheInvalidator _cacheInvalidator;

    public UpdateEventCommandHandler(UtanvegaDbContext context, ICacheInvalidator cacheInvalidator)
    {
        _context = context;
        _cacheInvalidator = cacheInvalidator;
    }

    public async Task<bool> Handle(UpdateEventCommand request, CancellationToken cancellationToken)
    {
        var ev = await _context.Events
            .FirstOrDefaultAsync(e => e.Id == request.Id, cancellationToken);

        if (ev == null) return false;

        Enum.TryParse<EventType>(request.Type, ignoreCase: true, out var type);
        Enum.TryParse<ActivityType>(request.ActivityType, ignoreCase: true, out var activityType);
        Enum.TryParse<EventStatus>(request.Status, ignoreCase: true, out var status);

        ev.Name = request.Name;
        ev.Description = request.Description;
        ev.Type = type;
        ev.ActivityType = activityType;
        ev.Status = status;
        ev.OrganizerName = request.OrganizerName;
        ev.OrganizerWebsite = request.OrganizerWebsite;
        ev.OrganizerId = request.OrganizerId;
        ev.AlertMessage = request.AlertMessage;
        ev.AlertSeverity = request.AlertSeverity;
        ev.LocationId = request.LocationId;
        ev.ScheduleRule = request.ScheduleRule;
        ev.SocialLinks = request.SocialLinks;
        ev.GpxPointLat = request.GpxPointLat;
        ev.GpxPointLng = request.GpxPointLng;
        ev.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
        _cacheInvalidator.InvalidateEvent(ev.Slug);
        return true;
    }
}
