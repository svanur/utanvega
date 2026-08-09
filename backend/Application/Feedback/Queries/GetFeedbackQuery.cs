using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Feedback.Queries;

public record FeedbackDto(
    Guid Id,
    string PageUrl,
    string Message,
    string? Category,
    string? Name,
    string? Email,
    string? StepsToReproduce,
    string? BrowserInfo,
    string? ScreenshotUrl,
    string Status,
    string Priority,
    int? GitHubIssue,
    string? AdminComment,
    DateTimeOffset CreatedAt
);

public record GetFeedbackQuery(string? Status, int Page, int PageSize) : IRequest<GetFeedbackResult>;
public record GetFeedbackResult(List<FeedbackDto> Items, int Total);

public class GetFeedbackQueryHandler(UtanvegaDbContext db) : IRequestHandler<GetFeedbackQuery, GetFeedbackResult>
{
    public async Task<GetFeedbackResult> Handle(GetFeedbackQuery request, CancellationToken cancellationToken)
    {
        var q = db.BetaFeedback.AsQueryable();
        if (!string.IsNullOrEmpty(request.Status))
            q = q.Where(f => f.Status == request.Status);

        var total = await q.CountAsync(cancellationToken);
        var items = await q
            .OrderByDescending(f => f.CreatedAt)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(f => new FeedbackDto(f.Id, f.PageUrl, f.Message, f.Category, f.Name, f.Email,
                                         f.StepsToReproduce, f.BrowserInfo, f.ScreenshotUrl,
                                         f.Status, f.Priority, f.GitHubIssue, f.AdminComment, f.CreatedAt))
            .ToListAsync(cancellationToken);

        return new GetFeedbackResult(items, total);
    }
}
