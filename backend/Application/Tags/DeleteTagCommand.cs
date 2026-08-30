using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Tags;

public record DeleteTagCommand(Guid Id, string? ActorUserId = null) : IRequest<bool>;

public class DeleteTagCommandHandler : IRequestHandler<DeleteTagCommand, bool>
{
    private readonly UtanvegaDbContext _context;

    public DeleteTagCommandHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(DeleteTagCommand request, CancellationToken cancellationToken)
    {
        var tag = await _context.Tags
            .Include(t => t.TrailTags)
            .FirstOrDefaultAsync(t => t.Id == request.Id, cancellationToken);

        if (tag is null) return false;

        _context.TrailTags.RemoveRange(tag.TrailTags);
        _context.Tags.Remove(tag);
        await _context.SaveChangesWithAuditAsync(request.ActorUserId);
        return true;
    }
}
