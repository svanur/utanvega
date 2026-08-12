using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Utanvega.Backend.Application.Feedback.Commands;
using Utanvega.Backend.Application.Feedback.Queries;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Core.Services;

namespace Utanvega.Backend.Tests.Handlers;

public class FeedbackHandlerTests : IDisposable
{
    private readonly TestDbContextFactory _factory;
    private readonly Mock<IEmailService> _emailMock = new();
    private readonly Mock<IConfiguration> _configMock = new();
    private readonly Mock<ILogger<SubmitFeedbackCommandHandler>> _loggerMock = new();

    public FeedbackHandlerTests()
    {
        _factory = new TestDbContextFactory();
    }

    public void Dispose() => _factory.Dispose();

    private SubmitFeedbackCommandHandler CreateSubmitHandler(string? tipRecipient = "admin@example.com")
    {
        _configMock.Setup(c => c["Resend:TipRecipient"]).Returns(tipRecipient);
        return new SubmitFeedbackCommandHandler(
            _factory.CreateContext(), _emailMock.Object, _configMock.Object, _loggerMock.Object);
    }

    // ── Submit ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task SubmitFeedback_StoresEntry_WithNewStatus()
    {
        var handler = CreateSubmitHandler();
        var cmd = new SubmitFeedbackCommand(
            PageUrl: "https://hlaupadagskra.is/trails/esjan",
            Message: "Great trail!",
            Category: "suggestion",
            Name: "Jón", Email: null,
            StepsToReproduce: null, BrowserInfo: null, ScreenshotUrl: null);

        var id = await handler.Handle(cmd, CancellationToken.None);

        using var db = _factory.CreateContext();
        var entry = await db.Feedback.FindAsync(id);
        Assert.NotNull(entry);
        Assert.Equal("new", entry.Status);
        Assert.Equal("medium", entry.Priority);
        Assert.Equal("Great trail!", entry.Message);
        Assert.Equal("suggestion", entry.Category);
        Assert.Null(entry.ClosedAt);
    }

    [Fact]
    public async Task SubmitFeedback_SendsEmailNotification_WhenRecipientConfigured()
    {
        var handler = CreateSubmitHandler(tipRecipient: "admin@example.com");
        var cmd = new SubmitFeedbackCommand(
            "https://hlaupadagskra.is/", "Test message", "bug",
            "Tester", "tester@example.com", null, null, null);

        await handler.Handle(cmd, CancellationToken.None);

        _emailMock.Verify(e => e.SendAsync(
            "admin@example.com",
            It.Is<string>(s => s.Contains("bug")),
            It.Is<string>(b => b.Contains("Test message")),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SubmitFeedback_DoesNotThrow_WhenEmailFails()
    {
        _emailMock.Setup(e => e.SendAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
                  .ThrowsAsync(new InvalidOperationException("SMTP down"));

        var handler = CreateSubmitHandler();
        var cmd = new SubmitFeedbackCommand(
            "https://hlaupadagskra.is/", "Test", null, null, null, null, null, null);

        // should not propagate the email exception
        var id = await handler.Handle(cmd, CancellationToken.None);
        Assert.NotEqual(Guid.Empty, id);
    }

    [Fact]
    public async Task SubmitFeedback_DoesNotSendEmail_WhenNoRecipientConfigured()
    {
        var handler = CreateSubmitHandler(tipRecipient: null);
        var cmd = new SubmitFeedbackCommand(
            "https://hlaupadagskra.is/", "Test", null, null, null, null, null, null);

        await handler.Handle(cmd, CancellationToken.None);

        _emailMock.Verify(e => e.SendAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    // ── Patch ────────────────────────────────────────────────────────────────

    private int _feedbackNumberCounter = 1;

    private async Task<Feedback> SeedFeedback(string status = "new", DateTimeOffset? closedAt = null)
    {
        using var db = _factory.CreateContext();
        var entry = new Feedback
        {
            Id = Guid.NewGuid(),
            FeedbackNumber = _feedbackNumberCounter++,
            PageUrl = "https://hlaupadagskra.is/",
            Message = "Test",
            Status = status,
            Priority = "medium",
            CreatedAt = DateTimeOffset.UtcNow,
            ClosedAt = closedAt,
        };
        db.Feedback.Add(entry);
        await db.SaveChangesAsync();
        return entry;
    }

    [Fact]
    public async Task PatchFeedback_SetsClosedAt_WhenStatusChangedToClosed()
    {
        var entry = await SeedFeedback("reviewed");
        var handler = new PatchFeedbackCommandHandler(_factory.CreateContext());

        var result = await handler.Handle(
            new PatchFeedbackCommand(entry.Id, Status: "closed"), CancellationToken.None);

        Assert.True(result);
        using var db = _factory.CreateContext();
        var updated = await db.Feedback.FindAsync(entry.Id);
        Assert.Equal("closed", updated!.Status);
        Assert.NotNull(updated.ClosedAt);
    }

    [Fact]
    public async Task PatchFeedback_ClearsClosedAt_WhenReopened()
    {
        var closedAt = DateTimeOffset.UtcNow.AddDays(-1);
        var entry = await SeedFeedback("closed", closedAt);
        var handler = new PatchFeedbackCommandHandler(_factory.CreateContext());

        await handler.Handle(
            new PatchFeedbackCommand(entry.Id, Status: "new"), CancellationToken.None);

        using var db = _factory.CreateContext();
        var updated = await db.Feedback.FindAsync(entry.Id);
        Assert.Equal("new", updated!.Status);
        Assert.Null(updated.ClosedAt);
    }

    [Fact]
    public async Task PatchFeedback_PreservesClosedAt_WhenAlreadyClosed()
    {
        var originalClosedAt = DateTimeOffset.UtcNow.AddHours(-2);
        var entry = await SeedFeedback("reviewed");
        // Set ClosedAt already via first patch
        var handler = new PatchFeedbackCommandHandler(_factory.CreateContext());
        await handler.Handle(new PatchFeedbackCommand(entry.Id, Status: "closed"), CancellationToken.None);

        using var db1 = _factory.CreateContext();
        var afterFirstClose = (await db1.Feedback.FindAsync(entry.Id))!.ClosedAt;

        // Patch something else without changing status
        var handler2 = new PatchFeedbackCommandHandler(_factory.CreateContext());
        await handler2.Handle(new PatchFeedbackCommand(entry.Id, Priority: "high"), CancellationToken.None);

        using var db2 = _factory.CreateContext();
        var updated = await db2.Feedback.FindAsync(entry.Id);
        Assert.Equal(afterFirstClose, updated!.ClosedAt); // unchanged
    }

    [Fact]
    public async Task PatchFeedback_ReturnsFalse_ForUnknownId()
    {
        var handler = new PatchFeedbackCommandHandler(_factory.CreateContext());

        var result = await handler.Handle(
            new PatchFeedbackCommand(Guid.NewGuid(), Status: "closed"), CancellationToken.None);

        Assert.False(result);
    }

    [Fact]
    public async Task PatchFeedback_UpdatesPriorityAndGitHubIssue()
    {
        var entry = await SeedFeedback();
        var handler = new PatchFeedbackCommandHandler(_factory.CreateContext());

        await handler.Handle(
            new PatchFeedbackCommand(entry.Id, Priority: "high", GitHubIssue: 42, AdminComment: "tracked"),
            CancellationToken.None);

        using var db = _factory.CreateContext();
        var updated = await db.Feedback.FindAsync(entry.Id);
        Assert.Equal("high", updated!.Priority);
        Assert.Equal(42, updated.GitHubIssue);
        Assert.Equal("tracked", updated.AdminComment);
    }

    [Fact]
    public async Task PatchFeedback_ClearsGitHubIssue_WhenFlagSet()
    {
        var entry = await SeedFeedback();
        using var db = _factory.CreateContext();
        var seeded = await db.Feedback.FindAsync(entry.Id);
        seeded!.GitHubIssue = 99;
        await db.SaveChangesAsync();

        var handler = new PatchFeedbackCommandHandler(_factory.CreateContext());
        await handler.Handle(
            new PatchFeedbackCommand(entry.Id, ClearGitHubIssue: true), CancellationToken.None);

        using var db2 = _factory.CreateContext();
        var updated = await db2.Feedback.FindAsync(entry.Id);
        Assert.Null(updated!.GitHubIssue);
    }

    [Fact]
    public async Task PatchFeedback_ClearsAdminComment_WhenEmptyString()
    {
        var entry = await SeedFeedback();
        using var db = _factory.CreateContext();
        var seeded = await db.Feedback.FindAsync(entry.Id);
        seeded!.AdminComment = "old comment";
        await db.SaveChangesAsync();

        var handler = new PatchFeedbackCommandHandler(_factory.CreateContext());
        await handler.Handle(
            new PatchFeedbackCommand(entry.Id, AdminComment: ""), CancellationToken.None);

        using var db2 = _factory.CreateContext();
        var updated = await db2.Feedback.FindAsync(entry.Id);
        Assert.Null(updated!.AdminComment);
    }

    // ── Get / Query ───────────────────────────────────────────────────────────

    private async Task SeedMultiple()
    {
        using var db = _factory.CreateContext();
        db.Feedback.AddRange(
            new Feedback { Id = Guid.NewGuid(), FeedbackNumber = 1, PageUrl = "https://hlaupadagskra.is/trails/esjan", Message = "Great map!", Category = "suggestion", Status = "new",      Priority = "high",   CreatedAt = DateTimeOffset.UtcNow.AddDays(-3) },
            new Feedback { Id = Guid.NewGuid(), FeedbackNumber = 2, PageUrl = "https://hlaupadagskra.is/events",       Message = "Button broken", Category = "bug",        Status = "reviewed", Priority = "medium", CreatedAt = DateTimeOffset.UtcNow.AddDays(-2), Email = "user@example.com" },
            new Feedback { Id = Guid.NewGuid(), FeedbackNumber = 3, PageUrl = "https://hlaupadagskra.is/tools",        Message = "Love the pace calc", Category = "other",  Status = "closed",   Priority = "low",    CreatedAt = DateTimeOffset.UtcNow.AddDays(-1), ClosedAt = DateTimeOffset.UtcNow }
        );
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task GetFeedback_FiltersBy_Status()
    {
        await SeedMultiple();
        var handler = new GetFeedbackQueryHandler(_factory.CreateContext());

        var result = await handler.Handle(new GetFeedbackQuery("new", 1, 25), CancellationToken.None);

        Assert.Single(result.Items);
        Assert.Equal("new", result.Items[0].Status);
    }

    [Fact]
    public async Task GetFeedback_ReturnsAll_WhenNoStatusFilter()
    {
        await SeedMultiple();
        var handler = new GetFeedbackQueryHandler(_factory.CreateContext());

        var result = await handler.Handle(new GetFeedbackQuery(null, 1, 25), CancellationToken.None);

        Assert.Equal(3, result.Items.Count);
    }

    [Fact]
    public async Task GetFeedback_SearchesAcrossMessage()
    {
        await SeedMultiple();
        var handler = new GetFeedbackQueryHandler(_factory.CreateContext());

        var result = await handler.Handle(new GetFeedbackQuery(null, 1, 25, Search: "broken"), CancellationToken.None);

        Assert.Single(result.Items);
        Assert.Contains("broken", result.Items[0].Message);
    }

    [Fact]
    public async Task GetFeedback_SearchesAcrossEmail()
    {
        await SeedMultiple();
        var handler = new GetFeedbackQueryHandler(_factory.CreateContext());

        var result = await handler.Handle(new GetFeedbackQuery(null, 1, 25, Search: "user@example"), CancellationToken.None);

        Assert.Single(result.Items);
        Assert.Equal("user@example.com", result.Items[0].Email);
    }

    [Fact]
    public async Task GetFeedback_Returns_CorrectCounts()
    {
        await SeedMultiple();
        var handler = new GetFeedbackQueryHandler(_factory.CreateContext());

        // Filter to "new" but counts should reflect all statuses
        var result = await handler.Handle(new GetFeedbackQuery("new", 1, 25), CancellationToken.None);

        Assert.Equal(3, result.Counts.Total);
        Assert.Equal(1, result.Counts.New);
        Assert.Equal(1, result.Counts.Reviewed);
        Assert.Equal(1, result.Counts.Closed);
    }

    [Fact]
    public async Task GetFeedback_Paginates_Results()
    {
        await SeedMultiple();
        var handler = new GetFeedbackQueryHandler(_factory.CreateContext());

        var page1 = await handler.Handle(new GetFeedbackQuery(null, 1, 2), CancellationToken.None);
        var page2 = await handler.Handle(new GetFeedbackQuery(null, 2, 2), CancellationToken.None);

        Assert.Equal(3, page1.Total);
        Assert.Equal(2, page1.Items.Count);
        Assert.Single(page2.Items);
    }

    [Fact]
    public async Task GetFeedback_SortsBy_Priority()
    {
        await SeedMultiple();
        var handler = new GetFeedbackQueryHandler(_factory.CreateContext());

        var result = await handler.Handle(new GetFeedbackQuery(null, 1, 25, SortBy: "priority", SortDir: "asc"), CancellationToken.None);

        // alphabetical: high, low, medium
        Assert.Equal("high", result.Items[0].Priority);
        Assert.Equal("low", result.Items[1].Priority);
        Assert.Equal("medium", result.Items[2].Priority);
    }

    [Fact]
    public async Task GetFeedback_AvgResolutionHours_ReflectsClosedItems()
    {
        await SeedMultiple();
        var handler = new GetFeedbackQueryHandler(_factory.CreateContext());

        var result = await handler.Handle(new GetFeedbackQuery(null, 1, 25), CancellationToken.None);

        Assert.NotNull(result.Counts.AvgResolutionHours);
        Assert.True(result.Counts.AvgResolutionHours > 0);
    }
}
