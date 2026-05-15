namespace Utanvega.Backend.Application.TrailCheckIns.Commands.CheckOutFromTrail;

using MediatR;

public record CheckOutFromTrailCommand(Guid UserId, string TrailSlug) : IRequest<bool>;
