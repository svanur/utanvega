namespace Utanvega.Backend.Application.TrailCheckIns.Commands.CheckInToTrail;

using MediatR;

public record CheckInToTrailCommand(Guid UserId, string TrailSlug) : IRequest<TrailCheckInDto>;

public record TrailCheckInDto(
    Guid Id,
    Guid TrailId,
    Guid UserId,
    string DisplayName,
    string? AvatarUrl,
    DateTimeOffset CheckedInAt,
    DateTimeOffset ExpiresAt
);
