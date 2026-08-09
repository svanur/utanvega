using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Feedback.Commands;

public record PatchFeedbackStatusCommand(Guid Id, string Status) : IRequest<bool>;

public class PatchFeedbackStatusCommandHandler(UtanvegaDbContext db) : IRequestHandler<PatchFeedbackStatusCommand, bool>
{
    public async Task<bool> Handle(PatchFeedbackStatusCommand request, CancellationToken cancellationToken)
    {
        var entry = await db.BetaFeedback.FirstOrDefaultAsync(f => f.Id == request.Id, cancellationToken);
        if (entry is null) return false;
        entry.Status = request.Status;
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }
}
