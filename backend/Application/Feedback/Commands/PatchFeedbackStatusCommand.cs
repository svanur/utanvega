using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Feedback.Commands;

public record PatchFeedbackCommand(
    Guid Id,
    string? Status = null,
    string? Priority = null,
    int? GitHubIssue = null,
    bool ClearGitHubIssue = false,
    string? AdminComment = null
) : IRequest<bool>;

public class PatchFeedbackCommandHandler(UtanvegaDbContext db) : IRequestHandler<PatchFeedbackCommand, bool>
{
    public async Task<bool> Handle(PatchFeedbackCommand request, CancellationToken cancellationToken)
    {
        var entry = await db.BetaFeedback.FirstOrDefaultAsync(f => f.Id == request.Id, cancellationToken);
        if (entry is null) return false;
        if (request.Status is not null) entry.Status = request.Status;
        if (request.Priority is not null) entry.Priority = request.Priority;
        if (request.ClearGitHubIssue) entry.GitHubIssue = null;
        else if (request.GitHubIssue is not null) entry.GitHubIssue = request.GitHubIssue;
        if (request.AdminComment is not null) entry.AdminComment = request.AdminComment == "" ? null : request.AdminComment;
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }
}
