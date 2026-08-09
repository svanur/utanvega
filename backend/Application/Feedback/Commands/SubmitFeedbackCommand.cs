using MediatR;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Feedback.Commands;

public record SubmitFeedbackCommand(
    string PageUrl,
    string Message,
    string? Category,
    string? Name,
    string? Email,
    string? StepsToReproduce,
    string? BrowserInfo,
    string? ScreenshotUrl
) : IRequest<Guid>;

public class SubmitFeedbackCommandHandler(UtanvegaDbContext db) : IRequestHandler<SubmitFeedbackCommand, Guid>
{
    public async Task<Guid> Handle(SubmitFeedbackCommand request, CancellationToken cancellationToken)
    {
        var entry = new BetaFeedback
        {
            Id = Guid.NewGuid(),
            PageUrl = request.PageUrl,
            Message = request.Message,
            Category = request.Category,
            Name = request.Name,
            Email = request.Email,
            StepsToReproduce = request.StepsToReproduce,
            BrowserInfo = request.BrowserInfo,
            ScreenshotUrl = request.ScreenshotUrl,
            Status = "new",
            CreatedAt = DateTimeOffset.UtcNow,
        };
        db.BetaFeedback.Add(entry);
        await db.SaveChangesAsync(cancellationToken);
        return entry.Id;
    }
}
