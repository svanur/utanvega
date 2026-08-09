namespace Utanvega.Backend.Core.Entities;

public class Feedback
{
    public Guid Id { get; set; }
    public int FeedbackNumber { get; set; }
    public string PageUrl { get; set; } = "";
    public string Message { get; set; } = "";
    public string? Category { get; set; }      // bug | suggestion | question | other
    public string? Name { get; set; }
    public string? Email { get; set; }
    public string? StepsToReproduce { get; set; }
    public string? BrowserInfo { get; set; }   // JSON blob
    public string? ScreenshotUrl { get; set; }
    public string Status { get; set; } = "new";     // new | reviewed | closed
    public DateTimeOffset? ClosedAt { get; set; }
    public string Priority { get; set; } = "medium"; // low | medium | high
    public int? GitHubIssue { get; set; }
    public string? AdminComment { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
