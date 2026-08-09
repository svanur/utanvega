using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Feedback.Queries;

public record FeedbackDto(
    Guid Id,
    int FeedbackNumber,
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
    DateTimeOffset CreatedAt,
    DateTimeOffset? ClosedAt
);

public record GetFeedbackQuery(string? Status, int Page, int PageSize, string? SortBy = null, string? SortDir = null, string? Search = null) : IRequest<GetFeedbackResult>;
public record FeedbackCounts(int Total, int New, int Reviewed, int Closed, double? AvgResolutionHours);
public record GetFeedbackResult(List<FeedbackDto> Items, int Total, FeedbackCounts Counts);

public class GetFeedbackQueryHandler(UtanvegaDbContext db) : IRequestHandler<GetFeedbackQuery, GetFeedbackResult>
{
    public async Task<GetFeedbackResult> Handle(GetFeedbackQuery request, CancellationToken cancellationToken)
    {
        var q = db.Feedback.AsQueryable();
        if (!string.IsNullOrEmpty(request.Status))
            q = q.Where(f => f.Status == request.Status);
        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var term = request.Search.Trim().ToLower();
            q = q.Where(f =>
                f.Message.ToLower().Contains(term) ||
                (f.Name != null && f.Name.ToLower().Contains(term)) ||
                (f.Email != null && f.Email.ToLower().Contains(term)) ||
                (f.PageUrl != null && f.PageUrl.ToLower().Contains(term)) ||
                (f.AdminComment != null && f.AdminComment.ToLower().Contains(term)));
        }

        var total = await q.CountAsync(cancellationToken);

        var desc = (request.SortDir ?? "desc").Equals("asc", StringComparison.OrdinalIgnoreCase) is false;
        q = (request.SortBy ?? "createdAt") switch
        {
            "feedbackNumber" => desc ? q.OrderByDescending(f => f.FeedbackNumber) : q.OrderBy(f => f.FeedbackNumber),
            "priority"       => desc ? q.OrderByDescending(f => f.Priority)       : q.OrderBy(f => f.Priority),
            "status"         => desc ? q.OrderByDescending(f => f.Status)         : q.OrderBy(f => f.Status),
            "age"            => desc ? q.OrderByDescending(f => f.CreatedAt)      : q.OrderBy(f => f.CreatedAt),
            _                => desc ? q.OrderByDescending(f => f.CreatedAt)      : q.OrderBy(f => f.CreatedAt),
        };

        var items = await q
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .Select(f => new FeedbackDto(f.Id, f.FeedbackNumber, f.PageUrl, f.Message, f.Category, f.Name, f.Email,
                                         f.StepsToReproduce, f.BrowserInfo, f.ScreenshotUrl,
                                         f.Status, f.Priority, f.GitHubIssue, f.AdminComment, f.CreatedAt, f.ClosedAt))
            .ToListAsync(cancellationToken);

        var allStatuses = await db.Feedback
            .GroupBy(f => f.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        var closedTimestamps = await db.Feedback
            .Where(f => f.Status == "closed" && f.ClosedAt != null)
            .Select(f => new { f.CreatedAt, f.ClosedAt })
            .ToListAsync(cancellationToken);

        var avgResolutionHours = closedTimestamps.Any()
            ? closedTimestamps.Average(f => (f.ClosedAt!.Value - f.CreatedAt).TotalHours)
            : (double?)null;

        var counts = new FeedbackCounts(
            Total:              allStatuses.Sum(g => g.Count),
            New:                allStatuses.FirstOrDefault(g => g.Status == "new")?.Count ?? 0,
            Reviewed:           allStatuses.FirstOrDefault(g => g.Status == "reviewed")?.Count ?? 0,
            Closed:             allStatuses.FirstOrDefault(g => g.Status == "closed")?.Count ?? 0,
            AvgResolutionHours: avgResolutionHours
        );

        return new GetFeedbackResult(items, total, counts);
    }
}
