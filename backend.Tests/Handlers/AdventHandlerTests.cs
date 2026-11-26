using System.Data.Common;
using System.Net;
using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore.Diagnostics;
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

    private static readonly AdventTestOverride NoOverride = new(UnlockAllDoors: false);
    private static readonly AdventTestOverride UnlockAll = new(UnlockAllDoors: true);

    private SubmitAdventAnswerCommandHandler CreateAnswerHandler(
        TimeProvider timeProvider, Mock<HttpMessageHandler> handlerMock, AdventTestOverride? testOverride = null) =>
        new(_factory.CreateContext(), timeProvider, testOverride ?? NoOverride, BuildMailerLite(handlerMock),
            Mock.Of<ILogger<SubmitAdventAnswerCommandHandler>>());

    // ── AdventCalendar.IsDayUnlocked: unlockAllDoors parameter (#1885) ─────────

    /// <summary>
    /// Baseline: with the default <c>unlockAllDoors: false</c> (i.e. the call shape every existing
    /// caller used before #1885), behavior is exactly what it was before this parameter existed —
    /// day 10 is locked in November and unlocked from Dec 10 on.
    /// </summary>
    [Fact]
    public void IsDayUnlocked_DefaultParameter_BehavesAsBeforeOverrideExisted()
    {
        Assert.False(AdventCalendar.IsDayUnlocked(10, BeforeDay10));
        Assert.True(AdventCalendar.IsDayUnlocked(10, OnDay10));
    }

    [Fact]
    public void IsDayUnlocked_UnlockAllDoorsTrue_BypassesDateCheckForInRangeDay()
    {
        // Day 24 in November — the furthest-out door, checked against the earliest clock in this
        // file's fixtures, so there is no ambiguity this is the date check being bypassed.
        Assert.False(AdventCalendar.IsDayUnlocked(24, BeforeDay10));
        Assert.True(AdventCalendar.IsDayUnlocked(24, BeforeDay10, unlockAllDoors: true));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(25)]
    public void IsDayUnlocked_UnlockAllDoorsTrue_StillRejectsOutOfRangeDay(int day)
    {
        Assert.False(AdventCalendar.IsDayUnlocked(day, BeforeDay10, unlockAllDoors: true));
    }

    // ── AdventTestOverride.FromConfiguration: the IsProduction() guard (#1885) ─

    private static IConfiguration ConfigWithUnlockAllDoors(bool value) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["ADVENT_UNLOCK_ALL_DOORS"] = value.ToString() })
            .Build();

    /// <summary>
    /// AC: with the env var unset, the computed override is inert regardless of environment —
    /// same as production today, before this feature existed.
    /// </summary>
    [Fact]
    public void FromConfiguration_EnvVarUnset_UnlockAllDoorsIsFalse()
    {
        var environment = Mock.Of<IWebHostEnvironment>(e => e.EnvironmentName == "Staging");
        var result = AdventTestOverride.FromConfiguration(ConfigWithUnlockAllDoors(false), environment);
        Assert.False(result.UnlockAllDoors);
    }

    /// <summary>AC: the env var set and a non-Production environment (e.g. Staging) honors it.</summary>
    [Fact]
    public void FromConfiguration_EnvVarSet_NonProduction_UnlockAllDoorsIsTrue()
    {
        var environment = Mock.Of<IWebHostEnvironment>(e => e.EnvironmentName == "Staging");
        var result = AdventTestOverride.FromConfiguration(ConfigWithUnlockAllDoors(true), environment);
        Assert.True(result.UnlockAllDoors);
    }

    /// <summary>
    /// AC: the env var set but <see cref="IWebHostEnvironment.IsProduction"/> true (simulating the
    /// var being set on the production Fly app by mistake) is ignored — the override computes
    /// false exactly as if the var were never set.
    /// </summary>
    [Fact]
    public void FromConfiguration_EnvVarSet_Production_UnlockAllDoorsStaysFalse()
    {
        var environment = Mock.Of<IWebHostEnvironment>(e => e.EnvironmentName == "Production");
        var result = AdventTestOverride.FromConfiguration(ConfigWithUnlockAllDoors(true), environment);
        Assert.False(result.UnlockAllDoors);
    }

    // ── GetAdventQuestionQuery: day-lock boundary ──────────────────────────────

    [Fact]
    public async Task GetAdventQuestion_BeforeUnlockDate_ReturnsNull()
    {
        var handler = new GetAdventQuestionQueryHandler(BeforeDay10, NoOverride);
        var result = await handler.Handle(new GetAdventQuestionQuery(10), CancellationToken.None);
        Assert.Null(result);
    }

    [Fact]
    public async Task GetAdventQuestion_OnUnlockDate_ReturnsQuestionWithoutCorrectIndex()
    {
        var handler = new GetAdventQuestionQueryHandler(OnDay10, NoOverride);
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
        var handler = new GetAdventQuestionQueryHandler(AfterDay10, NoOverride);
        var result = await handler.Handle(new GetAdventQuestionQuery(10), CancellationToken.None);
        Assert.NotNull(result);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(25)]
    [InlineData(-1)]
    public async Task GetAdventQuestion_DayOutsideRange_ReturnsNull(int day)
    {
        var handler = new GetAdventQuestionQueryHandler(OnDay10, NoOverride);
        var result = await handler.Handle(new GetAdventQuestionQuery(day), CancellationToken.None);
        Assert.Null(result);
    }

    // ── #1885: staging-only AdventTestOverride, wired through both handlers ───

    /// <summary>
    /// With the override absent (the production default), a day before its unlock date is still
    /// locked — proves the override parameter changes nothing when <c>UnlockAllDoors</c> is false,
    /// i.e. current production behavior is unchanged.
    /// </summary>
    [Fact]
    public async Task GetAdventQuestion_NoOverride_BeforeUnlockDate_StillReturnsNull()
    {
        var handler = new GetAdventQuestionQueryHandler(BeforeDay10, NoOverride);
        var result = await handler.Handle(new GetAdventQuestionQuery(10), CancellationToken.None);
        Assert.Null(result);
    }

    /// <summary>
    /// With the override's <c>UnlockAllDoors</c> true, a day whose real unlock date hasn't arrived
    /// yet still returns its question — proves the singleton is actually read by the handler and
    /// passed through to <see cref="AdventCalendar.IsDayUnlocked"/>, not just constructed and ignored.
    /// </summary>
    [Fact]
    public async Task GetAdventQuestion_UnlockAllDoorsOverride_BeforeUnlockDate_StillReturnsQuestion()
    {
        var handler = new GetAdventQuestionQueryHandler(BeforeDay10, UnlockAll);
        var result = await handler.Handle(new GetAdventQuestionQuery(10), CancellationToken.None);
        Assert.NotNull(result);
        Assert.Equal(10, result!.Day);
    }

    /// <summary>Even with the override on, out-of-range days are still rejected.</summary>
    [Theory]
    [InlineData(0)]
    [InlineData(25)]
    public async Task GetAdventQuestion_UnlockAllDoorsOverride_DayOutsideRange_StillReturnsNull(int day)
    {
        var handler = new GetAdventQuestionQueryHandler(BeforeDay10, UnlockAll);
        var result = await handler.Handle(new GetAdventQuestionQuery(day), CancellationToken.None);
        Assert.Null(result);
    }

    /// <summary>
    /// Same proof as above for the answer-submission handler: with <c>UnlockAllDoors</c> true, a
    /// correct answer for a day not yet unlocked by the real clock still wins a ticket.
    /// </summary>
    [Fact]
    public async Task SubmitAnswer_UnlockAllDoorsOverride_DayNotYetUnlocked_StillAccepted()
    {
        var handlerMock = MockHandlerReturning(HttpStatusCode.Created, "{}");
        var handler = CreateAnswerHandler(BeforeDay10, handlerMock, UnlockAll);
        var correctIndex = AdventQuestions.ForDay(10)!.CorrectIndex;

        var outcome = await handler.Handle(
            new SubmitAdventAnswerCommand(10, correctIndex, "runner@example.com"), CancellationToken.None);

        Assert.Equal(SubmitAdventAnswerOutcome.Correct, outcome);
        using var db = _factory.CreateContext();
        Assert.Single(db.AdventEntries);
    }

    /// <summary>
    /// With the override absent, the answer handler's day-lock behavior for a not-yet-unlocked day
    /// is unchanged from current production behavior — same assertion as
    /// <see cref="SubmitAnswer_DayNotYetUnlocked_ReturnsDayLocked_NoRowNoMailerLiteCall"/>, stated
    /// here explicitly against <see cref="NoOverride"/> rather than relying on the default parameter.
    /// </summary>
    [Fact]
    public async Task SubmitAnswer_NoOverride_DayNotYetUnlocked_StillReturnsDayLocked()
    {
        var handlerMock = MockHandlerReturning(HttpStatusCode.Created, "{}");
        var handler = CreateAnswerHandler(BeforeDay10, handlerMock, NoOverride);
        var correctIndex = AdventQuestions.ForDay(10)!.CorrectIndex;

        var outcome = await handler.Handle(
            new SubmitAdventAnswerCommand(10, correctIndex, "runner@example.com"), CancellationToken.None);

        Assert.Equal(SubmitAdventAnswerOutcome.DayLocked, outcome);
        using var db = _factory.CreateContext();
        Assert.Empty(db.AdventEntries);
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

    /// <summary>
    /// #1880: a repeat win for a ticket already held must not re-fire MailerLite's confirmation
    /// email on every re-submission — only the call that actually wrote the row subscribes.
    /// </summary>
    [Fact]
    public async Task SubmitAnswer_CorrectAgainForAlreadyWonDay_DoesNotCallMailerLiteAgain()
    {
        var handlerMock = MockHandlerReturning(HttpStatusCode.Created, "{}");
        var correctIndex = AdventQuestions.ForDay(10)!.CorrectIndex;

        var firstHandler = CreateAnswerHandler(OnDay10, handlerMock);
        await firstHandler.Handle(new SubmitAdventAnswerCommand(10, correctIndex, "runner@example.com"), CancellationToken.None);

        var secondHandler = CreateAnswerHandler(OnDay10, handlerMock);
        await secondHandler.Handle(new SubmitAdventAnswerCommand(10, correctIndex, "runner@example.com"), CancellationToken.None);

        // One MailerLite call total — the first (row-writing) submission only, not the repeat.
        VerifySubscribeCallCount(handlerMock, 1);
    }

    /// <summary>
    /// The endpoint's <c>new MailAddress(req.Email)</c> validation accepts an RFC 5322 display-name
    /// wrapper (#1880) — the handler must still key both forms to the same mailbox, or the same
    /// entrant ends up with two rows and two tickets.
    /// </summary>
    [Fact]
    public async Task SubmitAnswer_EmailWithDisplayNameWrapper_NormalizesToSameKeyAsPlainAddress()
    {
        var handlerMock = MockHandlerReturning(HttpStatusCode.Created, "{}");
        var correctIndex = AdventQuestions.ForDay(10)!.CorrectIndex;

        var firstHandler = CreateAnswerHandler(OnDay10, handlerMock);
        await firstHandler.Handle(new SubmitAdventAnswerCommand(10, correctIndex, "runner@example.com"), CancellationToken.None);

        var secondHandler = CreateAnswerHandler(OnDay10, handlerMock);
        var outcome = await secondHandler.Handle(
            new SubmitAdventAnswerCommand(10, correctIndex, "Runner Example <Runner@Example.com>"), CancellationToken.None);

        Assert.Equal(SubmitAdventAnswerOutcome.Correct, outcome);
        using var db = _factory.CreateContext();
        var rows = db.AdventEntries.ToList();
        Assert.Single(rows); // same mailbox — not a second entrant
        Assert.Equal("runner@example.com", rows[0].Email);
        VerifySubscribeCallCount(handlerMock, 1); // second call is the idempotent-repeat path
    }

    // ── GrantAdventShareBonusCommand: no-answer rejection + idempotency ────────

    [Fact]
    public async Task Share_NoPriorAnswerForDay_ReturnsNoPriorAnswer_CreatesNoRow()
    {
        using var db = _factory.CreateContext();
        var handler = new GrantAdventShareBonusCommandHandler(db, OnDay10);

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
        var handler = new GrantAdventShareBonusCommandHandler(db, OnDay10);
        var outcome = await handler.Handle(new GrantAdventShareBonusCommand(10, "runner@example.com"), CancellationToken.None);

        Assert.Equal(GrantAdventShareBonusOutcome.Granted, outcome);
        var shareRows = db.AdventEntries.Where(e => e.Source == AdventEntrySource.Share).ToList();
        Assert.Single(shareRows);
    }

    /// <summary>
    /// #1879: the handler must write the persisted row's <c>CreatedAt</c> from the injected
    /// <see cref="TimeProvider"/>, not <c>DateTime.UtcNow</c> — pin the clock to a known instant and
    /// assert the row's <c>CreatedAt</c> equals it exactly.
    /// </summary>
    [Fact]
    public async Task Share_UsesInjectedTimeProvider_ForCreatedAt()
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
        var handler = new GrantAdventShareBonusCommandHandler(db, OnDay10);
        await handler.Handle(new GrantAdventShareBonusCommand(10, "runner@example.com"), CancellationToken.None);

        var shareRow = db.AdventEntries.Single(e => e.Source == AdventEntrySource.Share);
        Assert.Equal(OnDay10.GetUtcNow().UtcDateTime, shareRow.CreatedAt);
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
            var handler1 = new GrantAdventShareBonusCommandHandler(db1, OnDay10);
            await handler1.Handle(new GrantAdventShareBonusCommand(10, "runner@example.com"), CancellationToken.None);
        }

        using (var db2 = _factory.CreateContext())
        {
            var handler2 = new GrantAdventShareBonusCommandHandler(db2, OnDay10);
            var outcome = await handler2.Handle(new GrantAdventShareBonusCommand(10, "runner@example.com"), CancellationToken.None);
            Assert.Equal(GrantAdventShareBonusOutcome.Granted, outcome);
        }

        using var verify = _factory.CreateContext();
        var shareRows = verify.AdventEntries.Where(e => e.Source == AdventEntrySource.Share).ToList();
        Assert.Single(shareRows);
    }

    /// <summary>
    /// Same display-name-wrapper collision as the answer handler (#1880): the share bonus is
    /// gated on a prior Answer row for the *same* email key, so the two forms of the same mailbox
    /// must resolve to one key here too, or a legitimate share can wrongly miss its prior answer.
    /// </summary>
    [Fact]
    public async Task Share_EmailWithDisplayNameWrapper_MatchesPriorAnswerByPlainAddress()
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
        var handler = new GrantAdventShareBonusCommandHandler(db, OnDay10);
        var outcome = await handler.Handle(
            new GrantAdventShareBonusCommand(10, "Runner Example <Runner@Example.com>"), CancellationToken.None);

        Assert.Equal(GrantAdventShareBonusOutcome.Granted, outcome);
        var shareRows = db.AdventEntries.Where(e => e.Source == AdventEntrySource.Share).ToList();
        Assert.Single(shareRows);
        Assert.Equal("runner@example.com", shareRows[0].Email);
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

    // ── GetAdventEntrySummariesQuery: per-email aggregation (#1887) ────────────

    private async Task SeedSummaryFixture()
    {
        using var db = _factory.CreateContext();
        db.AdventEntries.AddRange(
            // a@example.com: 3 Answer rows (days 1,2,3) + 2 Share rows (days 1,2) = 5 tickets, LastDay 3.
            new AdventEntry { Id = Guid.NewGuid(), Email = "a@example.com", Day = 1, Source = AdventEntrySource.Answer, CreatedAt = new DateTime(2026, 12, 1) },
            new AdventEntry { Id = Guid.NewGuid(), Email = "a@example.com", Day = 2, Source = AdventEntrySource.Answer, CreatedAt = new DateTime(2026, 12, 2) },
            new AdventEntry { Id = Guid.NewGuid(), Email = "a@example.com", Day = 3, Source = AdventEntrySource.Answer, CreatedAt = new DateTime(2026, 12, 3) },
            new AdventEntry { Id = Guid.NewGuid(), Email = "a@example.com", Day = 1, Source = AdventEntrySource.Share, CreatedAt = new DateTime(2026, 12, 1, 1, 0, 0) },
            new AdventEntry { Id = Guid.NewGuid(), Email = "a@example.com", Day = 2, Source = AdventEntrySource.Share, CreatedAt = new DateTime(2026, 12, 2, 1, 0, 0) },
            // b@example.com: 1 Answer row, day 5 — fewer tickets than a@example.com.
            new AdventEntry { Id = Guid.NewGuid(), Email = "b@example.com", Day = 5, Source = AdventEntrySource.Answer, CreatedAt = new DateTime(2026, 12, 5) },
            // c@example.com: 2 Answer rows, days 6 and 10 (10 is the higher Day, including a Share-only day in between is not needed here) — 2 tickets.
            new AdventEntry { Id = Guid.NewGuid(), Email = "c@example.com", Day = 6, Source = AdventEntrySource.Answer, CreatedAt = new DateTime(2026, 12, 6) },
            new AdventEntry { Id = Guid.NewGuid(), Email = "c@example.com", Day = 10, Source = AdventEntrySource.Answer, CreatedAt = new DateTime(2026, 12, 10) });
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task GetSummaries_GroupsByEmail_CountsBothSourcesTowardTicketCount()
    {
        await SeedSummaryFixture();
        var handler = new GetAdventEntrySummariesQueryHandler(_factory.CreateContext());

        var result = await handler.Handle(new GetAdventEntrySummariesQuery(1, 25), CancellationToken.None);

        var a = result.Items.Single(i => i.Email == "a@example.com");
        Assert.Equal(5, a.TicketCount); // 3 Answer + 2 Share rows
    }

    [Fact]
    public async Task GetSummaries_LastDay_ReflectsHighestDayAcrossBothSources()
    {
        await SeedSummaryFixture();
        var handler = new GetAdventEntrySummariesQueryHandler(_factory.CreateContext());

        var result = await handler.Handle(new GetAdventEntrySummariesQuery(1, 25), CancellationToken.None);

        var a = result.Items.Single(i => i.Email == "a@example.com");
        Assert.Equal(3, a.LastDay);
    }

    [Fact]
    public async Task GetSummaries_LastAnsweredAt_ReflectsMaxCreatedAtAcrossBothSources()
    {
        await SeedSummaryFixture();
        var handler = new GetAdventEntrySummariesQueryHandler(_factory.CreateContext());

        var result = await handler.Handle(new GetAdventEntrySummariesQuery(1, 25), CancellationToken.None);

        // a's Answer rows top out at 2026-12-03 (day 3); its Share rows are earlier with a time
        // component (2026-12-01 01:00, 2026-12-02 01:00) — max is still the day-3 Answer row.
        var a = result.Items.Single(i => i.Email == "a@example.com");
        Assert.Equal(new DateTime(2026, 12, 3), a.LastAnsweredAt);
    }

    [Fact]
    public async Task GetSummaries_NoSortBy_DefaultsTo_TicketCountDescending()
    {
        await SeedSummaryFixture();
        var handler = new GetAdventEntrySummariesQueryHandler(_factory.CreateContext());

        var result = await handler.Handle(new GetAdventEntrySummariesQuery(1, 25), CancellationToken.None);

        // a: 5 tickets, c: 2 tickets, b: 1 ticket.
        Assert.Equal(["a@example.com", "c@example.com", "b@example.com"], result.Items.Select(i => i.Email));
    }

    [Fact]
    public async Task GetSummaries_Total_CountsDistinctEmails_NotRows()
    {
        await SeedSummaryFixture();
        var handler = new GetAdventEntrySummariesQueryHandler(_factory.CreateContext());

        var result = await handler.Handle(new GetAdventEntrySummariesQuery(1, 25), CancellationToken.None);

        Assert.Equal(3, result.Total); // 3 distinct emails, despite 8 AdventEntry rows
    }

    [Fact]
    public async Task GetSummaries_Paginates_ToExactPageSlice()
    {
        await SeedSummaryFixture();
        var handler = new GetAdventEntrySummariesQueryHandler(_factory.CreateContext());

        var page1 = await handler.Handle(new GetAdventEntrySummariesQuery(1, 2), CancellationToken.None);
        var page2 = await handler.Handle(new GetAdventEntrySummariesQuery(2, 2), CancellationToken.None);

        Assert.Equal(3, page1.Total);
        Assert.Equal(2, page1.Items.Count);
        Assert.Single(page2.Items);
        // Default sort (TicketCount desc): a (5), c (2) on page 1; b (1) on page 2.
        Assert.Equal("b@example.com", page2.Items[0].Email);
    }

    /// <summary>
    /// #1888 review finding: TicketCount ties had no secondary sort key, so the DB/EF provider's
    /// ordering among tied rows wasn't guaranteed stable across separate query executions — a row
    /// could shift between pages and end up duplicated or skipped. Four emails tied at 1 ticket each,
    /// paged two-at-a-time: every email must appear exactly once across all pages, in the same
    /// Email-ascending tiebreak order every time.
    /// </summary>
    [Fact]
    public async Task GetSummaries_TicketCountTie_IsStableAndNonOverlapping_AcrossPages()
    {
        using var db = _factory.CreateContext();
        db.AdventEntries.AddRange(
            new AdventEntry { Id = Guid.NewGuid(), Email = "d@example.com", Day = 1, Source = AdventEntrySource.Answer, CreatedAt = new DateTime(2026, 12, 1) },
            new AdventEntry { Id = Guid.NewGuid(), Email = "c@example.com", Day = 1, Source = AdventEntrySource.Answer, CreatedAt = new DateTime(2026, 12, 1) },
            new AdventEntry { Id = Guid.NewGuid(), Email = "b@example.com", Day = 1, Source = AdventEntrySource.Answer, CreatedAt = new DateTime(2026, 12, 1) },
            new AdventEntry { Id = Guid.NewGuid(), Email = "a@example.com", Day = 1, Source = AdventEntrySource.Answer, CreatedAt = new DateTime(2026, 12, 1) });
        await db.SaveChangesAsync();

        var page1 = await new GetAdventEntrySummariesQueryHandler(_factory.CreateContext())
            .Handle(new GetAdventEntrySummariesQuery(1, 2), CancellationToken.None);
        var page2 = await new GetAdventEntrySummariesQueryHandler(_factory.CreateContext())
            .Handle(new GetAdventEntrySummariesQuery(2, 2), CancellationToken.None);

        // All four are tied on TicketCount (1) — the Email-ascending tiebreak must put them in a
        // fixed order: a, b on page 1, c, d on page 2. No email duplicated or missing across pages.
        Assert.Equal(["a@example.com", "b@example.com"], page1.Items.Select(i => i.Email));
        Assert.Equal(["c@example.com", "d@example.com"], page2.Items.Select(i => i.Email));
        var allEmails = page1.Items.Concat(page2.Items).Select(i => i.Email).ToList();
        Assert.Equal(allEmails.Distinct().Count(), allEmails.Count); // no duplicates across pages
        Assert.Equal(4, page1.Total);
    }

    [Fact]
    public async Task GetSummaries_SortByEmail_Ascending()
    {
        await SeedSummaryFixture();
        var handler = new GetAdventEntrySummariesQueryHandler(_factory.CreateContext());

        var result = await handler.Handle(
            new GetAdventEntrySummariesQuery(1, 25, SortBy: "email", SortDir: "asc"), CancellationToken.None);

        Assert.Equal(["a@example.com", "b@example.com", "c@example.com"], result.Items.Select(i => i.Email));
    }

    [Fact]
    public async Task GetSummaries_SortByLastDay_Ascending()
    {
        await SeedSummaryFixture();
        var handler = new GetAdventEntrySummariesQueryHandler(_factory.CreateContext());

        var result = await handler.Handle(
            new GetAdventEntrySummariesQuery(1, 25, SortBy: "lastDay", SortDir: "asc"), CancellationToken.None);

        // LastDay: a=3, b=5, c=10.
        Assert.Equal(["a@example.com", "b@example.com", "c@example.com"], result.Items.Select(i => i.Email));
    }

    [Fact]
    public async Task GetSummaries_NoEntries_ReturnsEmptyItemsAndZeroTotal()
    {
        var handler = new GetAdventEntrySummariesQueryHandler(_factory.CreateContext());

        var result = await handler.Handle(new GetAdventEntrySummariesQuery(1, 25), CancellationToken.None);

        Assert.Empty(result.Items);
        Assert.Equal(0, result.Total);
    }

    /// <summary>
    /// #1889: a caller-supplied pageSize above the 100 max must clamp to a 100-row page, not an
    /// unbounded one — seed more than 100 distinct emails so an unclamped Take would prove the gap.
    /// </summary>
    [Fact]
    public async Task GetSummaries_PageSizeAboveMax_ClampsTo100()
    {
        using (var db = _factory.CreateContext())
        {
            for (var i = 0; i < 150; i++)
            {
                db.AdventEntries.Add(new AdventEntry
                {
                    Id = Guid.NewGuid(), Email = $"user{i:D3}@example.com", Day = 1,
                    Source = AdventEntrySource.Answer, CreatedAt = new DateTime(2026, 12, 1),
                });
            }
            await db.SaveChangesAsync();
        }

        var handler = new GetAdventEntrySummariesQueryHandler(_factory.CreateContext());
        var result = await handler.Handle(new GetAdventEntrySummariesQuery(1, 500), CancellationToken.None);

        Assert.Equal(150, result.Total); // Total is unaffected by the clamp
        Assert.Equal(100, result.Items.Count); // but the page itself is capped at 100
    }

    /// <summary>#1889: page/pageSize <= 0 must behave as if they were 1, not throw or return empty.</summary>
    [Theory]
    [InlineData(0, 0)]
    [InlineData(-1, -5)]
    public async Task GetSummaries_PageOrPageSizeZeroOrNegative_ClampsToOne(int page, int pageSize)
    {
        await SeedSummaryFixture();
        var handler = new GetAdventEntrySummariesQueryHandler(_factory.CreateContext());

        var result = await handler.Handle(new GetAdventEntrySummariesQuery(page, pageSize), CancellationToken.None);

        // page=1, pageSize=1 → exactly the first row of the default sort (ticketCount desc): a@example.com.
        Assert.Single(result.Items);
        Assert.Equal("a@example.com", result.Items[0].Email);
    }

    // ── GetAdventStatsQuery: KPI rollup + per-day grouping (#1894) ─────────────

    [Fact]
    public async Task GetStats_SameEmailAcrossMultipleDays_CountsTowardTotalParticipantsOnce()
    {
        using (var db = _factory.CreateContext())
        {
            db.AdventEntries.AddRange(
                new AdventEntry { Id = Guid.NewGuid(), Email = "a@example.com", Day = 1, Source = AdventEntrySource.Answer, CreatedAt = new DateTime(2026, 12, 1) },
                new AdventEntry { Id = Guid.NewGuid(), Email = "a@example.com", Day = 2, Source = AdventEntrySource.Answer, CreatedAt = new DateTime(2026, 12, 2) },
                new AdventEntry { Id = Guid.NewGuid(), Email = "a@example.com", Day = 3, Source = AdventEntrySource.Answer, CreatedAt = new DateTime(2026, 12, 3) });
            await db.SaveChangesAsync();
        }

        var handler = new GetAdventStatsQueryHandler(_factory.CreateContext());
        var result = await handler.Handle(new GetAdventStatsQuery(), CancellationToken.None);

        Assert.Equal(1, result.TotalParticipants); // one email, 3 days
    }

    [Fact]
    public async Task GetStats_FiveAnswersTwoShares_RollsUpTicketAndSourceTotals()
    {
        using (var db = _factory.CreateContext())
        {
            // Days spread out so the (Email, Day, Source) unique index never collides.
            db.AdventEntries.AddRange(
                new AdventEntry { Id = Guid.NewGuid(), Email = "a@example.com", Day = 1, Source = AdventEntrySource.Answer, CreatedAt = new DateTime(2026, 12, 1) },
                new AdventEntry { Id = Guid.NewGuid(), Email = "a@example.com", Day = 2, Source = AdventEntrySource.Answer, CreatedAt = new DateTime(2026, 12, 2) },
                new AdventEntry { Id = Guid.NewGuid(), Email = "b@example.com", Day = 3, Source = AdventEntrySource.Answer, CreatedAt = new DateTime(2026, 12, 3) },
                new AdventEntry { Id = Guid.NewGuid(), Email = "c@example.com", Day = 4, Source = AdventEntrySource.Answer, CreatedAt = new DateTime(2026, 12, 4) },
                new AdventEntry { Id = Guid.NewGuid(), Email = "d@example.com", Day = 5, Source = AdventEntrySource.Answer, CreatedAt = new DateTime(2026, 12, 5) },
                new AdventEntry { Id = Guid.NewGuid(), Email = "a@example.com", Day = 1, Source = AdventEntrySource.Share, CreatedAt = new DateTime(2026, 12, 1, 1, 0, 0) },
                new AdventEntry { Id = Guid.NewGuid(), Email = "b@example.com", Day = 3, Source = AdventEntrySource.Share, CreatedAt = new DateTime(2026, 12, 3, 1, 0, 0) });
            await db.SaveChangesAsync();
        }

        var handler = new GetAdventStatsQueryHandler(_factory.CreateContext());
        var result = await handler.Handle(new GetAdventStatsQuery(), CancellationToken.None);

        Assert.Equal(7, result.TotalTickets);
        Assert.Equal(5, result.TotalAnswers);
        Assert.Equal(2, result.TotalShares);
    }

    /// <summary>
    /// Day 3: 4 distinct emails answer, one of them (b@example.com) also shares that same day —
    /// 5 rows total but only 4 distinct entrants, proving ParticipantCount and TicketCount diverge
    /// per day exactly as they do for the site-wide totals.
    /// </summary>
    [Fact]
    public async Task GetStats_DailyStats_ParticipantCountIsDistinctEmails_TicketCountIsRowCount()
    {
        using (var db = _factory.CreateContext())
        {
            db.AdventEntries.AddRange(
                new AdventEntry { Id = Guid.NewGuid(), Email = "a@example.com", Day = 3, Source = AdventEntrySource.Answer, CreatedAt = new DateTime(2026, 12, 3) },
                new AdventEntry { Id = Guid.NewGuid(), Email = "b@example.com", Day = 3, Source = AdventEntrySource.Answer, CreatedAt = new DateTime(2026, 12, 3) },
                new AdventEntry { Id = Guid.NewGuid(), Email = "c@example.com", Day = 3, Source = AdventEntrySource.Answer, CreatedAt = new DateTime(2026, 12, 3) },
                new AdventEntry { Id = Guid.NewGuid(), Email = "d@example.com", Day = 3, Source = AdventEntrySource.Answer, CreatedAt = new DateTime(2026, 12, 3) },
                new AdventEntry { Id = Guid.NewGuid(), Email = "b@example.com", Day = 3, Source = AdventEntrySource.Share, CreatedAt = new DateTime(2026, 12, 3, 1, 0, 0) });
            await db.SaveChangesAsync();
        }

        var handler = new GetAdventStatsQueryHandler(_factory.CreateContext());
        var result = await handler.Handle(new GetAdventStatsQuery(), CancellationToken.None);

        var day3 = result.DailyStats.Single(d => d.Day == 3);
        Assert.Equal(4, day3.ParticipantCount);
        Assert.Equal(5, day3.TicketCount);
    }

    /// <summary>
    /// AC: sparse, not zero-filled — a day with zero <see cref="AdventEntry"/> rows must not
    /// appear in <see cref="AdventStatsDto.DailyStats"/> at all, even though day 2 sits between
    /// two days that do have entries.
    /// </summary>
    [Fact]
    public async Task GetStats_DailyStats_OmitsDaysWithZeroEntries()
    {
        using (var db = _factory.CreateContext())
        {
            db.AdventEntries.AddRange(
                new AdventEntry { Id = Guid.NewGuid(), Email = "a@example.com", Day = 1, Source = AdventEntrySource.Answer, CreatedAt = new DateTime(2026, 12, 1) },
                new AdventEntry { Id = Guid.NewGuid(), Email = "b@example.com", Day = 3, Source = AdventEntrySource.Answer, CreatedAt = new DateTime(2026, 12, 3) });
            await db.SaveChangesAsync();
        }

        var handler = new GetAdventStatsQueryHandler(_factory.CreateContext());
        var result = await handler.Handle(new GetAdventStatsQuery(), CancellationToken.None);

        Assert.Equal([1, 3], result.DailyStats.Select(d => d.Day));
        Assert.DoesNotContain(result.DailyStats, d => d.Day == 2);
    }

    [Fact]
    public async Task GetStats_NoEntries_ReturnsZeroedTotalsAndEmptyDailyStats()
    {
        var handler = new GetAdventStatsQueryHandler(_factory.CreateContext());

        var result = await handler.Handle(new GetAdventStatsQuery(), CancellationToken.None);

        Assert.Equal(0, result.TotalParticipants);
        Assert.Equal(0, result.TotalTickets);
        Assert.Equal(0, result.TotalAnswers);
        Assert.Equal(0, result.TotalShares);
        Assert.Empty(result.DailyStats);
    }

    /// <summary>
    /// Counts every DbCommand the handler sends against the AdventEntries table — #1897's whole
    /// point is collapsing 5 round trips into at most 2 (one grouped-by-day query covering
    /// DailyStats plus the Total{Tickets,Answers,Shares} rollups, one distinct-Email query for
    /// TotalParticipants). Matches on CommandText rather than a fixed count-of-all-commands so an
    /// unrelated EF housekeeping command (if any) can't produce a false pass.
    /// </summary>
    private sealed class AdventEntriesCommandCounter : DbCommandInterceptor
    {
        public int Count { get; private set; }

        private void Track(DbCommand command)
        {
            if (command.CommandText.Contains("AdventEntries", StringComparison.OrdinalIgnoreCase))
                Count++;
        }

        public override InterceptionResult<DbDataReader> ReaderExecuting(
            DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result)
        {
            Track(command);
            return base.ReaderExecuting(command, eventData, result);
        }

        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
            DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result,
            CancellationToken cancellationToken = default)
        {
            Track(command);
            return base.ReaderExecutingAsync(command, eventData, result, cancellationToken);
        }

        public override InterceptionResult<object> ScalarExecuting(
            DbCommand command, CommandEventData eventData, InterceptionResult<object> result)
        {
            Track(command);
            return base.ScalarExecuting(command, eventData, result);
        }

        public override ValueTask<InterceptionResult<object>> ScalarExecutingAsync(
            DbCommand command, CommandEventData eventData, InterceptionResult<object> result,
            CancellationToken cancellationToken = default)
        {
            Track(command);
            return base.ScalarExecutingAsync(command, eventData, result, cancellationToken);
        }
    }

    [Fact]
    public async Task GetStats_IssuesAtMostTwoQueriesAgainstAdventEntries()
    {
        using (var db = _factory.CreateContext())
        {
            db.AdventEntries.AddRange(
                new AdventEntry { Id = Guid.NewGuid(), Email = "a@example.com", Day = 1, Source = AdventEntrySource.Answer, CreatedAt = new DateTime(2026, 12, 1) },
                new AdventEntry { Id = Guid.NewGuid(), Email = "b@example.com", Day = 2, Source = AdventEntrySource.Share, CreatedAt = new DateTime(2026, 12, 2) });
            await db.SaveChangesAsync();
        }

        var counter = new AdventEntriesCommandCounter();
        using var countedDb = _factory.CreateContext(counter);
        var handler = new GetAdventStatsQueryHandler(countedDb);

        await handler.Handle(new GetAdventStatsQuery(), CancellationToken.None);

        Assert.True(counter.Count <= 2, $"expected at most 2 queries against AdventEntries, saw {counter.Count}");
    }
}
