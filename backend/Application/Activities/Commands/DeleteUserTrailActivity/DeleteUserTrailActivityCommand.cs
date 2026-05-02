namespace Utanvega.Backend.Application.Activities.Commands.DeleteUserTrailActivity;

using MediatR;

public record DeleteUserTrailActivityCommand(
    Guid Id,
    Guid UserId
) : IRequest<Unit>;
