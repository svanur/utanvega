using MediatR;
using Utanvega.Backend.Core.Services;
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

public class SubmitFeedbackCommandHandler(
    UtanvegaDbContext db,
    IEmailService emailService,
    IConfiguration config,
    ILogger<SubmitFeedbackCommandHandler> logger
) : IRequestHandler<SubmitFeedbackCommand, Guid>
{
    public async Task<Guid> Handle(SubmitFeedbackCommand request, CancellationToken cancellationToken)
    {
        var entry = new Utanvega.Backend.Core.Entities.Feedback
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
        db.Feedback.Add(entry);
        await db.SaveChangesAsync(cancellationToken);

        var recipient = config["Resend:TipRecipient"];
        if (!string.IsNullOrEmpty(recipient))
        {
            try
            {
                var from = string.IsNullOrEmpty(request.Name) ? "Anonymous" : request.Name;
                var category = string.IsNullOrEmpty(request.Category) ? "" : $"[{request.Category}] ";
                var subject = $"New feedback {category}on hlaupadagskra.is";
                var body = $"""
                    New feedback received (#{entry.FeedbackNumber})

                    From:     {from}{(request.Email != null ? $" <{request.Email}>" : "")}
                    Page:     {request.PageUrl}
                    Category: {request.Category ?? "—"}

                    Message:
                    {request.Message}

                    {(request.StepsToReproduce != null ? $"Steps to reproduce:\n{request.StepsToReproduce}\n" : "")}
                    Review in admin: https://admin.hlaupadagskra.is
                    """;

                await emailService.SendAsync(recipient, subject, body, cancellationToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to send feedback notification email");
            }
        }

        return entry.Id;
    }
}
