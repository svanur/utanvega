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

    private static Race CreateRace(Guid editionId, string name, RaceStatus status = RaceStatus.Completed, DateOnly? dateOfRace = null, string? distanceLabel = "10K", Guid? trailId = null)
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
            TrailId = trailId,
        };
    }

    private static Trail CreateTestTrail(string name = "History Test Trail", double elevationGain = 1200, TerrainType? terrainType = TerrainType.Mountainous)
    {
        return new Trail
        {
            Id = Guid.NewGuid(),
            Name = name,
            Slug = name.ToLowerInvariant().Replace(" ", "-"),
            Length = 21000,
            ElevationGain = elevationGain,
            ActivityTypeId = ActivityType.TrailRunning,
            Status = TrailStatus.Published,
            TerrainType = terrainType,
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

    [Fact]
    public async Task History_CompletedEditionWithAllRacesCancelled_NotExcludedAsCancelled()
    {
        // CompleteWithRaces() leaves races that were already Cancelled as Cancelled, so a Completed
        // edition with every race Cancelled is a reachable state. It must still surface in history —
        // the edition ran to conclusion, it wasn't cancelled — even with IncludeCancelled: false.
        var pastYear = DateOnly.FromDateTime(DateTime.UtcNow).Year - 1;
        var ev = CreateTestEvent("Completed Despite Cancelled Races");
        var edition = CreateEdition(ev.Id, new DateOnly(pastYear, 3, 1), status: EditionStatus.Completed);
        var race = CreateRace(edition.Id, "Cancelled Race", status: RaceStatus.Cancelled);

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            ctx.Races.Add(race);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEditionsHistoryQueryHandler(queryCtx, _memoryCache);
        var result = await handler.Handle(new GetEditionsHistoryQuery(pastYear, IncludeCancelled: false), CancellationToken.None);

        var row = Assert.Single(result);
        Assert.False(row.EffectiveCancelled);
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
    public async Task History_SeriesEvent_RowCarriesTheLegRaceName()
    {
        // Series rows all share the event's name, so the leg's own race name (e.g. "Leg 2")
        // must come through separately to distinguish rows in the UI.
        var pastYear = DateOnly.FromDateTime(DateTime.UtcNow).Year - 1;
        var ev = CreateTestEvent("Named Legs Series", type: EventType.Series);
        var edition = CreateEdition(ev.Id, new DateOnly(pastYear, 10, 1));
        var leg = CreateRace(edition.Id, "Leg 2", dateOfRace: new DateOnly(pastYear, 11, 12));

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            ctx.Races.Add(leg);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEditionsHistoryQueryHandler(queryCtx, _memoryCache);
        var result = await handler.Handle(new GetEditionsHistoryQuery(pastYear), CancellationToken.None);

        var row = Assert.Single(result);
        Assert.Equal("Leg 2", row.RaceName);
    }

    [Fact]
    public async Task History_NonSeriesEdition_RaceNameIsNull()
    {
        // Non-series rows aggregate multiple races into one row — there is no single leg name to show.
        var pastYear = DateOnly.FromDateTime(DateTime.UtcNow).Year - 1;
        var ev = CreateTestEvent("Non Series Race Name Test");
        var edition = CreateEdition(ev.Id, new DateOnly(pastYear, 5, 10));
        var race = CreateRace(edition.Id, "10K");

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            ctx.Races.Add(race);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEditionsHistoryQueryHandler(queryCtx, _memoryCache);
        var result = await handler.Handle(new GetEditionsHistoryQuery(pastYear), CancellationToken.None);

        var row = Assert.Single(result);
        Assert.Null(row.RaceName);
    }

    [Fact]
    public async Task History_SeriesEvent_SameDateLegs_GetDistinctRaceIds()
    {
        // Regression: two legs on the same date (e.g. two distances of the same series round)
        // must remain distinguishable — the frontend keys rows by RaceId to avoid collisions
        // that editionId+date alone can't rule out.
        var pastYear = DateOnly.FromDateTime(DateTime.UtcNow).Year - 1;
        var ev = CreateTestEvent("Same Date Legs Series", type: EventType.Series);
        var edition = CreateEdition(ev.Id, new DateOnly(pastYear, 10, 1));
        var sameDate = new DateOnly(pastYear, 10, 8);
        var leg10k = CreateRace(edition.Id, "10K Leg", dateOfRace: sameDate, distanceLabel: "10K");
        var leg21k = CreateRace(edition.Id, "21K Leg", dateOfRace: sameDate, distanceLabel: "21K");

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            ctx.Races.AddRange(leg10k, leg21k);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEditionsHistoryQueryHandler(queryCtx, _memoryCache);
        var result = await handler.Handle(new GetEditionsHistoryQuery(pastYear), CancellationToken.None);

        Assert.Equal(2, result.Count);
        Assert.Equal(2, result.Select(r => r.RaceId).Distinct().Count());
        Assert.Contains(result, r => r.RaceId == leg10k.Id);
        Assert.Contains(result, r => r.RaceId == leg21k.Id);
    }

    [Fact]
    public async Task History_NonSeriesEdition_RaceIdIsNull()
    {
        var pastYear = DateOnly.FromDateTime(DateTime.UtcNow).Year - 1;
        var ev = CreateTestEvent("Non Series Race Id Test");
        var edition = CreateEdition(ev.Id, new DateOnly(pastYear, 5, 10));
        var race = CreateRace(edition.Id, "10K");

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            ctx.Races.Add(race);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEditionsHistoryQueryHandler(queryCtx, _memoryCache);
        var result = await handler.Handle(new GetEditionsHistoryQuery(pastYear), CancellationToken.None);

        var row = Assert.Single(result);
        Assert.Null(row.RaceId);
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

    // ─── DTO field derivation ───

    [Fact]
    public async Task History_EditionYear_FallsBackToDateYear_WhenYearFieldIsNull()
    {
        // Regression: admins can set Date without ever filling in the separate Year field.
        // EditionYear must still be populated (it feeds the /history/{year} URL match on
        // the event detail page), derived from Date rather than left null.
        var pastYear = DateOnly.FromDateTime(DateTime.UtcNow).Year - 1;
        var ev = CreateTestEvent("No Explicit Year Race");
        var edition = new EventEdition
        {
            Id = Guid.NewGuid(),
            EventId = ev.Id,
            Date = new DateOnly(pastYear, 6, 1),
            Year = null,
            Status = EditionStatus.Active,
            RegistrationStatus = RegistrationStatus.Closed,
        };

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEditionsHistoryQueryHandler(queryCtx, _memoryCache);
        var result = await handler.Handle(new GetEditionsHistoryQuery(pastYear), CancellationToken.None);

        var row = Assert.Single(result);
        Assert.Equal(pastYear, row.EditionYear);
    }

    [Fact]
    public async Task History_Row_IncludesEventActivityType()
    {
        // Regression: the row's icon fallback is the event's own ActivityType — races without
        // their own ActivityType/Trail link must not fall back to a generic "Other" icon.
        var pastYear = DateOnly.FromDateTime(DateTime.UtcNow).Year - 1;
        var ev = CreateTestEvent("Trail Running Race");
        ev.ActivityType = ActivityType.TrailRunning;
        var edition = CreateEdition(ev.Id, new DateOnly(pastYear, 6, 1));

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEditionsHistoryQueryHandler(queryCtx, _memoryCache);
        var result = await handler.Handle(new GetEditionsHistoryQuery(pastYear), CancellationToken.None);

        var row = Assert.Single(result);
        Assert.Equal("TrailRunning", row.EventActivityType);
    }

    [Fact]
    public async Task History_NonSeriesMultiDayEdition_RowEndDate_ReflectsEditionEndDate()
    {
        var pastYear = DateOnly.FromDateTime(DateTime.UtcNow).Year - 1;
        var ev = CreateTestEvent("Multi Day Trail Event");
        var edition = CreateEdition(ev.Id, new DateOnly(pastYear, 7, 30));
        edition.EndDate = new DateOnly(pastYear, 8, 2);

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEditionsHistoryQueryHandler(queryCtx, _memoryCache);
        var result = await handler.Handle(new GetEditionsHistoryQuery(pastYear), CancellationToken.None);

        var row = Assert.Single(result);
        Assert.Equal(edition.EndDate, row.RowEndDate);
    }

    [Fact]
    public async Task History_SeriesEvent_RowEndDate_IsNull()
    {
        // Series legs are single-day races with no independent end date of their own.
        var pastYear = DateOnly.FromDateTime(DateTime.UtcNow).Year - 1;
        var ev = CreateTestEvent("Series End Date Test", type: EventType.Series);
        var edition = CreateEdition(ev.Id, new DateOnly(pastYear, 10, 1));
        edition.EndDate = new DateOnly(pastYear, 10, 5);
        var leg = CreateRace(edition.Id, "Leg 1", dateOfRace: new DateOnly(pastYear, 10, 8));

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            ctx.Races.Add(leg);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEditionsHistoryQueryHandler(queryCtx, _memoryCache);
        var result = await handler.Handle(new GetEditionsHistoryQuery(pastYear), CancellationToken.None);

        var row = Assert.Single(result);
        Assert.Null(row.RowEndDate);
    }

    // ─── Trail-derived elevation/terrain (#545) ───

    [Fact]
    public async Task History_RaceWithTrail_DistanceCarriesElevationAndTerrain()
    {
        var pastYear = DateOnly.FromDateTime(DateTime.UtcNow).Year - 1;
        var ev = CreateTestEvent("Mountain Trail Race");
        var edition = CreateEdition(ev.Id, new DateOnly(pastYear, 6, 1));
        var trail = CreateTestTrail(elevationGain: 1850, terrainType: TerrainType.Mountainous);
        var race = CreateRace(edition.Id, "21K", distanceLabel: "21K", trailId: trail.Id);

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            ctx.Trails.Add(trail);
            ctx.Races.Add(race);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEditionsHistoryQueryHandler(queryCtx, _memoryCache);
        var result = await handler.Handle(new GetEditionsHistoryQuery(pastYear), CancellationToken.None);

        var row = Assert.Single(result);
        var distance = Assert.Single(row.Distances);
        Assert.Equal(1850, distance.ElevationGain);
        Assert.Equal("Mountainous", distance.TerrainType);
    }

    [Fact]
    public async Task History_RaceWithNoLinkedTrail_DistanceHasNoElevationOrTerrain()
    {
        var pastYear = DateOnly.FromDateTime(DateTime.UtcNow).Year - 1;
        var ev = CreateTestEvent("No Trail Race");
        var edition = CreateEdition(ev.Id, new DateOnly(pastYear, 6, 1));
        var race = CreateRace(edition.Id, "10K", distanceLabel: "10K", trailId: null);

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            ctx.Races.Add(race);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEditionsHistoryQueryHandler(queryCtx, _memoryCache);
        var result = await handler.Handle(new GetEditionsHistoryQuery(pastYear), CancellationToken.None);

        var row = Assert.Single(result);
        var distance = Assert.Single(row.Distances);
        Assert.Null(distance.ElevationGain);
        Assert.Null(distance.TerrainType);
    }

    [Fact]
    public async Task History_TrailWithNoElevationData_DistanceOmitsElevation_ButKeepsLabel()
    {
        // Trail.ElevationGain is a non-nullable double defaulting to 0 — that must read as "no data",
        // not a real zero-metre climb, so the field should be omitted rather than surfaced as 0.
        var pastYear = DateOnly.FromDateTime(DateTime.UtcNow).Year - 1;
        var ev = CreateTestEvent("Flat Data Gap Race");
        var edition = CreateEdition(ev.Id, new DateOnly(pastYear, 6, 1));
        var trail = CreateTestTrail(elevationGain: 0, terrainType: null);
        var race = CreateRace(edition.Id, "10K", distanceLabel: "10K", trailId: trail.Id);

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            ctx.Trails.Add(trail);
            ctx.Races.Add(race);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEditionsHistoryQueryHandler(queryCtx, _memoryCache);
        var result = await handler.Handle(new GetEditionsHistoryQuery(pastYear), CancellationToken.None);

        var row = Assert.Single(result);
        var distance = Assert.Single(row.Distances);
        Assert.Equal("10K", distance.Label);
        Assert.Null(distance.ElevationGain);
        Assert.Null(distance.TerrainType);
    }

    // ─── Organizer (#545) ───

    [Fact]
    public async Task History_Row_LinkedOrganizer_TakesPrecedenceOverFreeTextName()
    {
        var pastYear = DateOnly.FromDateTime(DateTime.UtcNow).Year - 1;
        var organizer = new Organizer { Id = Guid.NewGuid(), Name = "Hlaupafélagið", Slug = "hlaupafelagid" };
        var ev = CreateTestEvent("Organized Race");
        ev.OrganizerName = "Legacy Free Text Name";
        ev.OrganizerId = organizer.Id;
        var edition = CreateEdition(ev.Id, new DateOnly(pastYear, 6, 1));

        using (var ctx = _factory.CreateContext())
        {
            ctx.Organizers.Add(organizer);
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEditionsHistoryQueryHandler(queryCtx, _memoryCache);
        var result = await handler.Handle(new GetEditionsHistoryQuery(pastYear), CancellationToken.None);

        var row = Assert.Single(result);
        Assert.Equal("Hlaupafélagið", row.OrganizerName);
        Assert.Equal("hlaupafelagid", row.OrganizerSlug);
    }

    [Fact]
    public async Task History_Row_NoOrganizer_OrganizerFieldsAreNull()
    {
        var pastYear = DateOnly.FromDateTime(DateTime.UtcNow).Year - 1;
        var ev = CreateTestEvent("Unorganized Race");
        var edition = CreateEdition(ev.Id, new DateOnly(pastYear, 6, 1));

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEditionsHistoryQueryHandler(queryCtx, _memoryCache);
        var result = await handler.Handle(new GetEditionsHistoryQuery(pastYear), CancellationToken.None);

        var row = Assert.Single(result);
        Assert.Null(row.OrganizerName);
        Assert.Null(row.OrganizerSlug);
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

    // ─── Galleries (#548) ───

    [Fact]
    public async Task History_Row_CarriesGalleries_OrderedBySortOrder()
    {
        var pastYear = DateOnly.FromDateTime(DateTime.UtcNow).Year - 1;
        var ev = CreateTestEvent("Gallery History Event");
        var edition = CreateEdition(ev.Id, new DateOnly(pastYear, 6, 1));
        var photographer = new Photographer { Id = Guid.NewGuid(), Name = "Jón Jónsson", Slug = "jon-jonsson-history" };
        var galleries = new[]
        {
            new PhotoGallery { Id = Guid.NewGuid(), EventEditionId = edition.Id, Url = "https://photos.example.com/third", SortOrder = 2 },
            new PhotoGallery { Id = Guid.NewGuid(), EventEditionId = edition.Id, Url = "https://photos.example.com/first", SortOrder = 0, PhotographerId = photographer.Id },
            new PhotoGallery { Id = Guid.NewGuid(), EventEditionId = edition.Id, Url = "https://photos.example.com/second", SortOrder = 1 },
        };

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            ctx.Photographers.Add(photographer);
            ctx.PhotoGalleries.AddRange(galleries);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEditionsHistoryQueryHandler(queryCtx, _memoryCache);
        var result = await handler.Handle(new GetEditionsHistoryQuery(pastYear), CancellationToken.None);

        var row = Assert.Single(result);
        Assert.Equal(
            new[] { "https://photos.example.com/first", "https://photos.example.com/second", "https://photos.example.com/third" },
            row.Galleries.Select(g => g.Url).ToArray());
        Assert.Equal("Jón Jónsson", row.Galleries[0].PhotographerName);
    }

    [Fact]
    public async Task History_Row_EditionWithoutGalleries_ReturnsEmptyList_NeverNull()
    {
        var pastYear = DateOnly.FromDateTime(DateTime.UtcNow).Year - 1;
        var ev = CreateTestEvent("No Gallery History Event");
        var edition = CreateEdition(ev.Id, new DateOnly(pastYear, 6, 1));

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEditionsHistoryQueryHandler(queryCtx, _memoryCache);
        var result = await handler.Handle(new GetEditionsHistoryQuery(pastYear), CancellationToken.None);

        var row = Assert.Single(result);
        Assert.NotNull(row.Galleries);
        Assert.Empty(row.Galleries);
    }
}
