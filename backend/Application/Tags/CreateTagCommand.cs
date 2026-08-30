using MediatR;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Core.Services;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Tags;

public record CreateTagCommand(
    string Name,
    string? Color,
    string? NameEn = null,
    string? ActorUserId = null
) : IRequest<(Guid Id, string Slug)>;

public class CreateTagCommandHandler : IRequestHandler<CreateTagCommand, (Guid Id, string Slug)>
{
    private readonly UtanvegaDbContext _context;

    public CreateTagCommandHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<(Guid Id, string Slug)> Handle(CreateTagCommand request, CancellationToken cancellationToken)
    {
        var tag = new Tag
        {
            Name = request.Name,
            NameEn = request.NameEn,
            Slug = SlugGenerator.Generate(request.Name),
            Color = request.Color
        };

        _context.Tags.Add(tag);
        await _context.SaveChangesWithAuditAsync(request.ActorUserId);

        return (tag.Id, tag.Slug);
    }
}
