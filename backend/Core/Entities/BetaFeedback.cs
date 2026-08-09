namespace Utanvega.Backend.Core.Entities;

public class BetaFeedback
{
    public Guid Id { get; set; }
    public string PageUrl { get; set; } = "";
    public string Message { get; set; } = "";
    public string? Category { get; set; }      // bug | suggestion | question | other
    public string? Name { get; set; }
    public string? Email { get; set; }
    public string? StepsToReproduce { get; set; }
    public string? BrowserInfo { get; set; }   // JSON blob
    public string? ScreenshotUrl { get; set; }
    public string Status { get; set; } = "new"; // new | reviewed | closed
    public DateTimeOffset CreatedAt { get; set; }
}
