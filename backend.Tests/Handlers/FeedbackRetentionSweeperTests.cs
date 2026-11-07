using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Retention;
using Xunit;

namespace Utanvega.Backend.Tests.Handlers;

/// <summary>
/// The retention sweep clears a feedback report's screenshot and browser metadata past the
/// window while keeping the report itself — message, category, contact details, status,
/// priority and admin comment all survive.
/// </summary>
public class FeedbackRetentionSweeperTests : IDisposable
{
    private readonly TestDbContextFactory _factory = new();
    private readonly DateTimeOffset _now = new(2026, 8, 25, 12, 0, 0, TimeSpan.Zero);

    public void Dispose() => _factory.Dispose();

    private Guid Seed(
        double daysAgo,
        string? screenshotUrl,
        string? browserInfo,
        string message = "Map pin is off by a few metres",
        string? category = "bug",
        string? name = "Jane",
        string? email = "jane@example.com",
        string? stepsToReproduce = "Open trail page, zoom in",
        string status = "new",
        string priority = "medium",
        string? adminComment = "Looking into it")
    {
        using var context = _factory.CreateContext();
        var feedback = new Feedback
        {
            Id = Guid.NewGuid(),
            PageUrl = "https://hlaupadagskra.is/trails/esja",
            Message = message,
            Category = category,
            Name = name,
            Email = email,
            StepsToReproduce = stepsToReproduce,
            BrowserInfo = browserInfo,
            ScreenshotUrl = screenshotUrl,
            Status = status,
            Priority = priority,
            AdminComment = adminComment,
            CreatedAt = _now.AddDays(-daysAgo),
        };
        context.Feedback.Add(feedback);
        context.SaveChanges();
        return feedback.Id;
    }

    private async Task<int> Sweep(int retentionDays = 60)
    {
        await using var context = _factory.CreateContext();
        return await FeedbackRetentionSweeper.SweepAsync(
            context, TimeSpan.FromDays(retentionDays), _now);
    }

    [Fact]
    public async Task ClearsScreenshotAndBrowserInfoPastTheWindow()
    {
        var id = Seed(61, "https://example.com/shot.png", "{\"ua\":\"test\"}");
        Assert.Equal(1, await Sweep());

        await using var context = _factory.CreateContext();
        var feedback = await context.Feedback.SingleAsync(f => f.Id == id);
        Assert.Null(feedback.ScreenshotUrl);
        Assert.Null(feedback.BrowserInfo);
    }

    [Fact]
    public async Task LeavesOtherFieldsUnchangedPastTheWindow()
    {
        var id = Seed(
            61, "https://example.com/shot.png", "{\"ua\":\"test\"}",
            message: "Map pin is off by a few metres", category: "bug", name: "Jane",
            email: "jane@example.com", stepsToReproduce: "Open trail page, zoom in",
            status: "reviewed", priority: "high", adminComment: "Confirmed, fixing");
        await Sweep();

        await using var context = _factory.CreateContext();
        var feedback = await context.Feedback.SingleAsync(f => f.Id == id);
        Assert.Equal("Map pin is off by a few metres", feedback.Message);
        Assert.Equal("bug", feedback.Category);
        Assert.Equal("Jane", feedback.Name);
        Assert.Equal("jane@example.com", feedback.Email);
        Assert.Equal("Open trail page, zoom in", feedback.StepsToReproduce);
        Assert.Equal("reviewed", feedback.Status);
        Assert.Equal("high", feedback.Priority);
        Assert.Equal("Confirmed, fixing", feedback.AdminComment);
    }

    [Fact]
    public async Task LeavesRowsInsideTheWindowAlone()
    {
        var id = Seed(10, "https://example.com/shot.png", "{\"ua\":\"test\"}");
        Assert.Equal(0, await Sweep());

        await using var context = _factory.CreateContext();
        var feedback = await context.Feedback.SingleAsync(f => f.Id == id);
        Assert.NotNull(feedback.ScreenshotUrl);
        Assert.NotNull(feedback.BrowserInfo);
    }

    [Fact]
    public async Task IsANoOpWhenAlreadyCleared()
    {
        Seed(100, null, null);
        Assert.Equal(0, await Sweep());
    }

    [Fact]
    public async Task RespectsAConfiguredWindow()
    {
        var oldId = Seed(45, "https://example.com/a.png", "{\"ua\":\"a\"}");
        var recentId = Seed(20, "https://example.com/b.png", "{\"ua\":\"b\"}");
        Assert.Equal(1, await Sweep(retentionDays: 30));

        await using var context = _factory.CreateContext();
        Assert.Null((await context.Feedback.SingleAsync(f => f.Id == oldId)).ScreenshotUrl);
        Assert.NotNull((await context.Feedback.SingleAsync(f => f.Id == recentId)).ScreenshotUrl);
    }
}
