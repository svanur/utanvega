using System.Net;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Moq.Protected;
using Utanvega.Backend.Application.Advent;
using Utanvega.Backend.Application.Advent.Commands;
using Utanvega.Backend.Application.Advent.Queries;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Newsletter;

namespace Utanvega.Backend.Tests.Handlers;

/// <summary>
/// Covers the "Jóladagatal Hlaupadagskra.is 2026" advent engine (#1875): the server-side day-lock
/// gate, the answer/share handlers' idempotency, and the admin export's deduplication. Every test
/// pins the clock to a known instant with <see cref="FixedClock"/> (mirroring
/// <c>AnalyticsHandlerTests.FixedClock</c>) rather than depending on the real December 2026
/// calendar being current when the suite runs.
/// </summary>
public class AdventHandlerTests : IDisposable
{
    private readonly TestDbContextFactory _factory = new();

    public void Dispose() => _factory.Dispose();

    private sealed class FixedClock(DateTime utcNow) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => new(utcNow, TimeSpan.Zero);
    }

    // Day 10 unlocks at 2026-12-10 00:00 Iceland-local (== UTC, see AdventCalendar's doc comment).
    private static readonly TimeProvider OnDay10 = new FixedClock(new DateTime(2026, 12, 10, 12, 0, 0, DateTimeKind.Utc));
    private static readonly TimeProvider BeforeDay10 = new FixedClock(new DateTime(2026, 12, 9, 23, 59, 0, DateTimeKind.Utc));
    private static readonly TimeProvider AfterDay10 = new FixedClock(new DateTime(2026, 12, 11, 0, 0, 0, DateTimeKind.Utc));

    private static Mock<HttpMessageHandler> MockHandlerReturning(HttpStatusCode statusCode, string body)
    {
        var handlerMock = new Mock<HttpMessageHandler>();
        handlerMock
            .Protected()
            .Setup<Task<HttpResponseMessage>>("SendAsync", ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(() => new HttpResponseMessage
            {
                StatusCode = statusCode,
                Content = new StringContent(body, Encoding.UTF8, "application/json"),
            });
        return handlerMock;
    }

    /// <summary>
    /// A real <see cref="MailerLiteClientProvider"/> wired to a mocked <see cref="HttpMessageHandler"/>
    /// — same shape as <c>MailerLiteClientProviderTests.BuildProvider</c> — so call *count* can be
    /// asserted via <paramref name="handlerMock"/> without a sealed class blocking a Moq mock of the
    /// provider itself.
    /// </summary>
    private static MailerLiteClientProvider BuildMailerLite(Mock<HttpMessageHandler> handlerMock)
    {
        var httpClient = new HttpClient(handlerMock.Object);
        var factoryMock = new Mock<IHttpClientFactory>();
        factoryMock.Setup(f => f.CreateClient("MailerLite")).Returns(httpClient);
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["MailerLite:ApiKey"] = "test-key",
                ["MailerLite:GroupId"] = "group-123",
            })
            .Build();
        return new MailerLiteClientProvider(config, factoryMock.Object);
    }

    private static void VerifySubscribeCallCount(Mock<HttpMessageHandler> handlerMock, int times) =>
        handlerMock.Protected().Verify(
            "SendAsync", Times.Exactly(times), ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>());

    private SubmitAdventAnswerCommandHandler CreateAnswerHandler(
        TimeProvider timeProvider, Mock<HttpMessageHandler> handlerMock) =>
        new(_factory.CreateContext(), timeProvider, BuildMailerLite(handlerMock),
            Mock.Of<ILogger<SubmitAdventAnswerCommandHandler>>());

    // ── GetAdventQuestionQuery: day-lock boundary ──────────────────────────────

    [Fact]
    public async Task GetAdventQuestion_BeforeUnlockDate_ReturnsNull()
    {
        var handler = new GetAdventQuestionQueryHandler(BeforeDay10);
        var result = await handler.Handle(new GetAdventQuestionQuery(10), CancellationToken.None);
        Assert.Null(result);
    }

    [Fact]
    public async Task GetAdventQuestion_OnUnlockDate_ReturnsQuestionWithoutCorrectIndex()
    {
        var handler = new GetAdventQuestionQueryHandler(OnDay10);
        var result = await handler.Handle(new GetAdventQuestionQuery(10), CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(10, result!.Day);
        Assert.Equal(4, result.ChoicesIs.Length);
        Assert.Equal(4, result.ChoicesEn.Length);
        // AdventQuestionDto has no CorrectIndex property at all — nothing to assert "is hidden"
        // beyond the type itself not exposing it, which the compiler already enforces.
    }

    [Fact]
    public async Task GetAdventQuestion_AfterUnlockDate_StillReturnsQuestion()
    {
        var handler = new GetAdventQuestionQueryHandler(AfterDay10);
        var result = await handler.Handle(new GetAdventQuestionQuery(10), CancellationToken.None);
        Assert.NotNull(result);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(25)]
    [InlineData(-1)]
    public async Task GetAdventQuestion_DayOutsideRange_ReturnsNull(int day)
    {
        var handler = new GetAdventQuestionQueryHandler(OnDay10);
        var result = await handler.Handle(new GetAdventQuestionQuery(day), CancellationToken.None);
        Assert.Null(result);
    }

    // ── SubmitAdventAnswerCommand: day lock, wrong vs correct, idempotency ─────

    [Fact]
    public async Task SubmitAnswer_DayNotYetUnlocked_ReturnsDayLocked_NoRowNoMailerLiteCall()
    {
        var handlerMock = MockHandlerReturning(HttpStatusCode.Created, "{}");
        var handler = CreateAnswerHandler(BeforeDay10, handlerMock);
        var correctIndex = AdventQuestions.ForDay(10)!.CorrectIndex;

        var outcome = await handler.Handle(
            new SubmitAdventAnswerCommand(10, correctIndex, "runner@example.com"), CancellationToken.None);

        Assert.Equal(SubmitAdventAnswerOutcome.DayLocked, outcome);
        using var db = _factory.CreateContext();
        Assert.Empty(db.AdventEntries);
        VerifySubscribeCallCount(handlerMock, 0);
    }

    [Fact]
    public async Task SubmitAnswer_WrongIndex_ReturnsIncorrect_NoRowNoMailerLiteCall()
    {
        var handlerMock = MockHandlerReturning(HttpStatusCode.Created, "{}");
        var handler = CreateAnswerHandler(OnDay10, handlerMock);
        var correctIndex = AdventQuestions.ForDay(10)!.CorrectIndex;
        var wrongIndex = (correctIndex + 1) % 4;

        var outcome = await handler.Handle(
            new SubmitAdventAnswerCommand(10, wrongIndex, "runner@example.com"), CancellationToken.None);

        Assert.Equal(SubmitAdventAnswerOutcome.Incorrect, outcome);
        using var db = _factory.CreateContext();
        Assert.Empty(db.AdventEntries);
        VerifySubscribeCallCount(handlerMock, 0);
    }

    [Fact]
    public async Task SubmitAnswer_CorrectIndexFirstTime_CreatesOneRow_CallsMailerLiteOnce()
    {
        var handlerMock = MockHandlerReturning(HttpStatusCode.Created, "{}");
        var handler = CreateAnswerHandler(OnDay10, handlerMock);
        var correctIndex = AdventQuestions.ForDay(10)!.CorrectIndex;

        var outcome = await handler.Handle(
            new SubmitAdventAnswerCommand(10, correctIndex, "Runner@Example.com"), CancellationToken.None);

        Assert.Equal(SubmitAdventAnswerOutcome.Correct, outcome);
        using var db = _factory.CreateContext();
        var rows = db.AdventEntries.ToList();
        Assert.Single(rows);
        Assert.Equal("runner@example.com", rows[0].Email); // normalized
        Assert.Equal(10, rows[0].Day);
        Assert.Equal(AdventEntrySource.Answer, rows[0].Source);
        VerifySubscribeCallCount(handlerMock, 1);
    }

    [Fact]
    public async Task SubmitAnswer_CorrectAgainForAlreadyWonDay_CreatesNoSecondRow_NoError()
    {
        var handlerMock = MockHandlerReturning(HttpStatusCode.Created, "{}");
        var correctIndex = AdventQuestions.ForDay(10)!.CorrectIndex;

        var firstHandler = CreateAnswerHandler(OnDay10, handlerMock);
        await firstHandler.Handle(new SubmitAdventAnswerCommand(10, correctIndex, "runner@example.com"), CancellationToken.None);

        var secondHandler = CreateAnswerHandler(OnDay10, handlerMock);
        var outcome = await secondHandler.Handle(
            new SubmitAdventAnswerCommand(10, correctIndex, "runner@example.com"), CancellationToken.None);

        Assert.Equal(SubmitAdventAnswerOutcome.Correct, outcome);
        using var db = _factory.CreateContext();
        Assert.Single(db.AdventEntries);
    }

    // ── GrantAdventShareBonusCommand: no-answer rejection + idempotency ────────

    [Fact]
    public async Task Share_NoPriorAnswerForDay_ReturnsNoPriorAnswer_CreatesNoRow()
    {
        using var db = _factory.CreateContext();
        var handler = new GrantAdventShareBonusCommandHandler(db);

        var outcome = await handler.Handle(new GrantAdventShareBonusCommand(10, "runner@example.com"), CancellationToken.None);

        Assert.Equal(GrantAdventShareBonusOutcome.NoPriorAnswer, outcome);
        Assert.Empty(db.AdventEntries);
    }

    [Fact]
    public async Task Share_WithPriorAnswer_CreatesOneShareRow()
    {
        using (var seed = _factory.CreateContext())
        {
            seed.AdventEntries.Add(new AdventEntry
            {
                Id = Guid.NewGuid(), Email = "runner@example.com", Day = 10,
                Source = AdventEntrySource.Answer, CreatedAt = DateTime.UtcNow,
            });
            await seed.SaveChangesAsync();
        }

        using var db = _factory.CreateContext();
        var handler = new GrantAdventShareBonusCommandHandler(db);
        var outcome = await handler.Handle(new GrantAdventShareBonusCommand(10, "runner@example.com"), CancellationToken.None);

        Assert.Equal(GrantAdventShareBonusOutcome.Granted, outcome);
        var shareRows = db.AdventEntries.Where(e => e.Source == AdventEntrySource.Share).ToList();
        Assert.Single(shareRows);
    }

    [Fact]
    public async Task Share_RepeatCallAfterGrant_StaysAtOneRow()
    {
        using (var seed = _factory.CreateContext())
        {
            seed.AdventEntries.Add(new AdventEntry
            {
                Id = Guid.NewGuid(), Email = "runner@example.com", Day = 10,
                Source = AdventEntrySource.Answer, CreatedAt = DateTime.UtcNow,
            });
            await seed.SaveChangesAsync();
        }

        using (var db1 = _factory.CreateContext())
        {
            var handler1 = new GrantAdventShareBonusCommandHandler(db1);
            await handler1.Handle(new GrantAdventShareBonusCommand(10, "runner@example.com"), CancellationToken.None);
        }

        using (var db2 = _factory.CreateContext())
        {
            var handler2 = new GrantAdventShareBonusCommandHandler(db2);
            var outcome = await handler2.Handle(new GrantAdventShareBonusCommand(10, "runner@example.com"), CancellationToken.None);
            Assert.Equal(GrantAdventShareBonusOutcome.Granted, outcome);
        }

        using var verify = _factory.CreateContext();
        var shareRows = verify.AdventEntries.Where(e => e.Source == AdventEntrySource.Share).ToList();
        Assert.Single(shareRows);
    }

    // ── ExportAdventEntriesQuery: deduplication ────────────────────────────────

    [Fact]
    public async Task Export_ReturnsOneDistinctEmailPerRow_RegardlessOfSourceOrCase()
    {
        using (var seed = _factory.CreateContext())
        {
            seed.AdventEntries.AddRange(
                new AdventEntry { Id = Guid.NewGuid(), Email = "a@example.com", Day = 1, Source = AdventEntrySource.Answer, CreatedAt = DateTime.UtcNow },
                new AdventEntry { Id = Guid.NewGuid(), Email = "a@example.com", Day = 1, Source = AdventEntrySource.Share, CreatedAt = DateTime.UtcNow },
                new AdventEntry { Id = Guid.NewGuid(), Email = "a@example.com", Day = 2, Source = AdventEntrySource.Answer, CreatedAt = DateTime.UtcNow },
                new AdventEntry { Id = Guid.NewGuid(), Email = "b@example.com", Day = 3, Source = AdventEntrySource.Answer, CreatedAt = DateTime.UtcNow });
            await seed.SaveChangesAsync();
        }

        using var db = _factory.CreateContext();
        var handler = new ExportAdventEntriesQueryHandler(db);
        var emails = await handler.Handle(new ExportAdventEntriesQuery(), CancellationToken.None);

        Assert.Equal(["a@example.com", "b@example.com"], emails);
    }

    [Fact]
    public async Task Export_NoEntries_ReturnsEmptyList()
    {
        using var db = _factory.CreateContext();
        var handler = new ExportAdventEntriesQueryHandler(db);
        var emails = await handler.Handle(new ExportAdventEntriesQuery(), CancellationToken.None);
        Assert.Empty(emails);
    }
}
