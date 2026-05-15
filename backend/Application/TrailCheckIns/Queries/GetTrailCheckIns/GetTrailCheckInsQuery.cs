namespace Utanvega.Backend.Application.TrailCheckIns.Queries.GetTrailCheckIns;

using MediatR;
using Utanvega.Backend.Application.TrailCheckIns.Commands.CheckInToTrail;

public record GetTrailCheckInsQuery(string TrailSlug) : IRequest<GetTrailCheckInsResponse>;

public record GetTrailCheckInsResponse(
    Guid TrailId,
    List<TrailCheckInDto> Entries,
    int TotalActive
);
