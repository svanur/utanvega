using Microsoft.Extensions.Caching.Memory;
using Utanvega.Backend.Application.Events.Queries.GetEditionsHistory;
using Utanvega.Backend.Core.Entities;

namespace Utanvega.Backend.Tests.Handlers;

public class EditionsHistoryHandlerTests : IDisposable
{
    private readonly TestDbContextFactory _factory;
    private readonly IMemoryCache _memoryCache;

    public EditionsHistoryHandlerTests()
    {
        _factory = new TestDbContextFactory();
        _memoryCache = new MemoryCache(new MemoryCacheOptions());
    }

    public void Dispose()
    {
        _factory.Dispose();
        _memoryCache.Dispose();
    }

    private static Event CreateTestEvent(string name, EventType type = EventType.Race, EventStatus status = EventStatus.Confirmed)
    {
        return new Event
        {
            Id = Guid.NewGuid(),
            Name = name,
            Slug = name.ToLowerInvariant().Replace(" ", "-"),
            Type = type,
            Status = status,
        };
    }

    private static EventEdition CreateEdition(Guid eventId, DateOnly? date, int? year = null, EditionStatus status = EditionStatus.Active)
    {
        return new EventEdition
        {
            Id = Guid.NewGuid(),
            EventId = eventId,
            Date = date,
            Year = year ?? date?.Year,
            Status = status,
            RegistrationStatus = RegistrationStatus.Closed,
        };
    }

    private static Race CreateRace(Guid editionId, string name, RaceStatus status = RaceStatus.Completed, DateOnly? dateOfRace = null, string? distanceLabel = "10K")
    {
        return new Race
        {
            Id = Guid.NewGuid(),
            EventEditionId = editionId,
            Name = name,
            SortOrder = 0,
            Status = status,
            TicketStatus = TicketStatus.Closed,
            DateOfRace = dateOfRace,
            DistanceLabel = distanceLabel,
        };
    }

    // ─── Year filtering / past cutoff ───

    [Fact]
    public async Task History_ReturnsOnlyEditionsInRequestedYear()
    {
        var pastYear = DateOnly.FromDateTime(DateTime.UtcNow).Year - 2;
        var ev = CreateTestEvent("Past Race");
        var editionInYear = CreateEdition(ev.Id, new DateOnly(pastYear, 6, 1));
        var editionOtherYear = CreateEdition(ev.Id, new DateOnly(pastYear - 1, 6, 1));

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.AddRange(editionInYear, editionOtherYear);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEditionsHistoryQueryHandler(queryCtx, _memoryCache);
        var result = await handler.Handle(new GetEditionsHistoryQuery(pastYear), CancellationToken.None);

        var row = Assert.Single(result);
        Assert.Equal(editionInYear.Id, row.EditionId);
    }

    [Fact]
    public async Task History_ExcludesEditionsNotYetPast()
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var tomorrow = today.AddDays(1); // never past, regardless of calendar rollover
        var ev = CreateTestEvent("Not Yet Raced");
        var edition = CreateEdition(ev.Id, tomorrow);

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEditionsHistoryQueryHandler(queryCtx, _memoryCache);
        var result = await handler.Handle(new GetEditionsHistoryQuery(tomorrow.Year), CancellationToken.None);

        Assert.Empty(result);
    }

    [Fact]
    public async Task History_DatelessEdition_IncludedOnlyForFullyPastYear()
    {
        var pastYear = DateOnly.FromDateTime(DateTime.UtcNow).Year - 3;
        var currentYear = DateOnly.FromDateTime(DateTime.UtcNow).Year;
        var pastEv = CreateTestEvent("Dateless Past Trail Event");
        var pastDateless = CreateEdition(pastEv.Id, date: null, year: pastYear);
        var currentEv = CreateTestEvent("Dateless Current Trail Event");
        var currentDateless = CreateEdition(currentEv.Id, date: null, year: currentYear);

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.AddRange(pastEv, currentEv);
            ctx.EventEditions.AddRange(pastDateless, currentDateless);
            await ctx.SaveChangesAsync();
        }

        using (var queryCtx = _factory.CreateContext())
        {
            var handler = new GetEditionsHistoryQueryHandler(queryCtx, _memoryCache);
            var pastResult = await handler.Handle(new GetEditionsHistoryQuery(pastYear), CancellationToken.None);
            Assert.Single(pastResult);
        }

        using (var queryCtx = _factory.CreateContext())
        {
            var handler = new GetEditionsHistoryQueryHandler(queryCtx, _memoryCache);
            var currentResult = await handler.Handle(new GetEditionsHistoryQuery(currentYear), CancellationToken.None);
            Assert.DoesNotContain(currentResult, r => r.EditionId == currentDateless.Id);
        }
    }

    // ─── Cancelled toggle ───

    [Fact]
    public async Task History_IncludeCancelled_True_ReturnsCancelledEdition()
    {
        var pastYear = DateOnly.FromDateTime(DateTime.UtcNow).Year - 1;
        var ev = CreateTestEvent("Cancelled Past Race");
        var edition = CreateEdition(ev.Id, new DateOnly(pastYear, 3, 1), status: EditionStatus.Cancelled);

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEditionsHistoryQueryHandler(queryCtx, _memoryCache);
        var result = await handler.Handle(new GetEditionsHistoryQuery(pastYear, IncludeCancelled: true), CancellationToken.None);

        var row = Assert.Single(result);
        Assert.True(row.EffectiveCancelled);
    }

    [Fact]
    public async Task History_IncludeCancelled_False_ExcludesCancelledEdition()
    {
        var pastYear = DateOnly.FromDateTime(DateTime.UtcNow).Year - 1;
        var ev = CreateTestEvent("Cancelled Past Race 2");
        var edition = CreateEdition(ev.Id, new DateOnly(pastYear, 3, 1), status: EditionStatus.Cancelled);

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEditionsHistoryQueryHandler(queryCtx, _memoryCache);
        var result = await handler.Handle(new GetEditionsHistoryQuery(pastYear, IncludeCancelled: false), CancellationToken.None);

        Assert.Empty(result);
    }

    // ─── Hidden exclusion ───

    [Fact]
    public async Task History_ExcludesHiddenEdition()
    {
        var pastYear = DateOnly.FromDateTime(DateTime.UtcNow).Year - 1;
        var ev = CreateTestEvent("Hidden Edition Event");
        var edition = CreateEdition(ev.Id, new DateOnly(pastYear, 3, 1), status: EditionStatus.Hidden);

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEditionsHistoryQueryHandler(queryCtx, _memoryCache);
        var result = await handler.Handle(new GetEditionsHistoryQuery(pastYear), CancellationToken.None);

        Assert.Empty(result);
    }

    [Fact]
    public async Task History_ExcludesHiddenRace_FromDistanceAggregation()
    {
        var pastYear = DateOnly.FromDateTime(DateTime.UtcNow).Year - 1;
        var ev = CreateTestEvent("Multi Race Event");
        var edition = CreateEdition(ev.Id, new DateOnly(pastYear, 3, 1));
        var visible = CreateRace(edition.Id, "10K", distanceLabel: "10K");
        var hidden = CreateRace(edition.Id, "Hidden 5K", status: RaceStatus.Hidden, distanceLabel: "5K");

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            ctx.Races.AddRange(visible, hidden);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEditionsHistoryQueryHandler(queryCtx, _memoryCache);
        var result = await handler.Handle(new GetEditionsHistoryQuery(pastYear), CancellationToken.None);

        var row = Assert.Single(result);
        var distance = Assert.Single(row.Distances);
        Assert.Equal("10K", distance.Label);
    }

    // ─── Multi-race, non-series → one row ───

    [Fact]
    public async Task History_NonSeriesMultiRaceEdition_ProducesOneRowWithAggregatedDistances()
    {
        var pastYear = DateOnly.FromDateTime(DateTime.UtcNow).Year - 1;
        var ev = CreateTestEvent("Multi Distance Race");
        var edition = CreateEdition(ev.Id, new DateOnly(pastYear, 5, 10));
        var race10k = CreateRace(edition.Id, "10K", distanceLabel: "10K");
        var race21k = CreateRace(edition.Id, "21K", distanceLabel: "21K");

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            ctx.Races.AddRange(race10k, race21k);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEditionsHistoryQueryHandler(queryCtx, _memoryCache);
        var result = await handler.Handle(new GetEditionsHistoryQuery(pastYear), CancellationToken.None);

        var row = Assert.Single(result);
        Assert.Equal(2, row.Distances.Count);
        Assert.Equal(edition.Date, row.RowDate);
    }

    // ─── Series → one row per race ───

    [Fact]
    public async Task History_SeriesEvent_ProducesOneRowPerRace()
    {
        var pastYear = DateOnly.FromDateTime(DateTime.UtcNow).Year - 1;
        var ev = CreateTestEvent("Winter Series", type: EventType.Series);
        var edition = CreateEdition(ev.Id, new DateOnly(pastYear, 10, 1)); // edition date is nominal; legs carry their own dates
        var leg1 = CreateRace(edition.Id, "Leg 1", dateOfRace: new DateOnly(pastYear, 10, 8), distanceLabel: "10K");
        var leg2 = CreateRace(edition.Id, "Leg 2", dateOfRace: new DateOnly(pastYear, 11, 12), distanceLabel: "10K");

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            ctx.Races.AddRange(leg1, leg2);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEditionsHistoryQueryHandler(queryCtx, _memoryCache);
        var result = await handler.Handle(new GetEditionsHistoryQuery(pastYear), CancellationToken.None);

        Assert.Equal(2, result.Count);
        Assert.Contains(result, r => r.RowDate == leg1.DateOfRace);
        Assert.Contains(result, r => r.RowDate == leg2.DateOfRace);
    }

    [Fact]
    public async Task History_SeriesEvent_IndividualLegCancelledStateIsPerRace_NotEditionWide()
    {
        var pastYear = DateOnly.FromDateTime(DateTime.UtcNow).Year - 1;
        var ev = CreateTestEvent("Partially Cancelled Series", type: EventType.Series);
        var edition = CreateEdition(ev.Id, new DateOnly(pastYear, 10, 1));
        var cancelledLeg = CreateRace(edition.Id, "Cancelled Leg", status: RaceStatus.Cancelled, dateOfRace: new DateOnly(pastYear, 10, 8));
        var completedLeg = CreateRace(edition.Id, "Completed Leg", status: RaceStatus.Completed, dateOfRace: new DateOnly(pastYear, 11, 12));

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            ctx.Races.AddRange(cancelledLeg, completedLeg);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEditionsHistoryQueryHandler(queryCtx, _memoryCache);
        var result = await handler.Handle(new GetEditionsHistoryQuery(pastYear, IncludeCancelled: true), CancellationToken.None);

        Assert.Equal(2, result.Count);
        Assert.True(result.Single(r => r.RowDate == cancelledLeg.DateOfRace).EffectiveCancelled);
        Assert.False(result.Single(r => r.RowDate == completedLeg.DateOfRace).EffectiveCancelled);
    }

    // ─── Years list ───

    [Fact]
    public async Task Years_ReturnsDistinctPastYears_ExcludingCurrentAndFuture()
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var pastYear1 = today.Year - 1;
        var pastYear2 = today.Year - 3;

        var ev1 = CreateTestEvent("Years Test 1");
        var ev2 = CreateTestEvent("Years Test 2");
        var ev3 = CreateTestEvent("Years Test Future");
        var editionPast1 = CreateEdition(ev1.Id, new DateOnly(pastYear1, 6, 1));
        var editionPast2 = CreateEdition(ev2.Id, new DateOnly(pastYear2, 6, 1));
        var editionFuture = CreateEdition(ev3.Id, today.AddDays(30));

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.AddRange(ev1, ev2, ev3);
            ctx.EventEditions.AddRange(editionPast1, editionPast2, editionFuture);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEditionsHistoryYearsQueryHandler(queryCtx);
        var result = await handler.Handle(new GetEditionsHistoryYearsQuery(), CancellationToken.None);

        Assert.Contains(pastYear1, result);
        Assert.Contains(pastYear2, result);
        Assert.DoesNotContain(editionFuture.Date!.Value.Year, result);
        // Descending order
        Assert.Equal(result.OrderDescending(), result);
    }
}
