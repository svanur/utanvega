using Utanvega.Backend.Application.Trails.Queries.GetTrails;
using Utanvega.Backend.Application.Trails.Queries.GetTrailBySlug;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Core.Services;

namespace Utanvega.Backend.Tests.Handlers;

public class TrailQueryHandlerTests : IDisposable
{
    private readonly TestDbContextFactory _factory;
    private readonly IScheduleRuleEngine _scheduleEngine = new ScheduleRuleEngine();

    public TrailQueryHandlerTests()
    {
        _factory = new TestDbContextFactory();
    }

    public void Dispose() => _factory.Dispose();

    private Trail CreateTrail(string name, TrailStatus status = TrailStatus.Published, ActivityType activity = ActivityType.Hiking)
    {
        return new Trail
        {
            Id = Guid.NewGuid(),
            Name = name,
            Slug = name.ToLower().Replace(" ", "-"),
            Length = 5000,
            ElevationGain = 200,
            ElevationLoss = 180,
            ActivityTypeId = activity,
            Status = status,
            Type = TrailType.Loop,
            Difficulty = Difficulty.Easy,
            Visibility = Visibility.Public,
        };
    }

    [Fact]
    public async Task GetTrails_ExcludesDeletedByDefault()
    {
        using (var ctx = _factory.CreateContext())
        {
            ctx.Trails.Add(CreateTrail("Active Trail", TrailStatus.Published));
            ctx.Trails.Add(CreateTrail("Deleted Trail", TrailStatus.Archived));
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new GetTrailsQueryHandler(ctx);
            var result = await handler.Handle(new GetTrailsQuery(), CancellationToken.None);
            Assert.Single(result);
            Assert.Equal("Active Trail", result[0].Name);
        }
    }

    [Fact]
    public async Task GetTrails_IncludeDeleted_ReturnsAll()
    {
        using (var ctx = _factory.CreateContext())
        {
            ctx.Trails.Add(CreateTrail("Active", TrailStatus.Published));
            ctx.Trails.Add(CreateTrail("Deleted", TrailStatus.Archived));
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new GetTrailsQueryHandler(ctx);
            var result = await handler.Handle(new GetTrailsQuery(IncludeArchived: true), CancellationToken.None);
            Assert.Equal(2, result.Count);
        }
    }

    [Fact]
    public async Task GetTrails_PublishedOnly_FiltersDrafts()
    {
        using (var ctx = _factory.CreateContext())
        {
            ctx.Trails.Add(CreateTrail("Published", TrailStatus.Published));
            ctx.Trails.Add(CreateTrail("Draft", TrailStatus.Draft));
            ctx.Trails.Add(CreateTrail("Flagged", TrailStatus.Flagged));
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new GetTrailsQueryHandler(ctx);
            var result = await handler.Handle(new GetTrailsQuery(PublishedOnly: true), CancellationToken.None);
            Assert.Single(result);
            Assert.Equal("Published", result[0].Name);
        }
    }

    [Fact]
    public async Task GetTrails_PublishedOnly_NeedsReviewFalseEvenWhenFlagged()
    {
        // Public path (PublishedOnly: true) must never leak the internal admin bookmark flag,
        // regardless of the underlying trail value.
        var trail = CreateTrail("Flagged Trail", TrailStatus.Published);
        trail.NeedsReview = true;

        using (var ctx = _factory.CreateContext())
        {
            ctx.Trails.Add(trail);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new GetTrailsQueryHandler(ctx);
            var result = await handler.Handle(new GetTrailsQuery(PublishedOnly: true), CancellationToken.None);
            var dto = Assert.Single(result);
            Assert.False(dto.NeedsReview);
        }
    }

    [Fact]
    public async Task GetTrails_AdminPath_NeedsReviewTrueWhenFlagged()
    {
        // Admin path (PublishedOnly: false) must still return the real value.
        var trail = CreateTrail("Flagged Trail", TrailStatus.Published);
        trail.NeedsReview = true;

        using (var ctx = _factory.CreateContext())
        {
            ctx.Trails.Add(trail);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new GetTrailsQueryHandler(ctx);
            var result = await handler.Handle(new GetTrailsQuery(PublishedOnly: false), CancellationToken.None);
            var dto = Assert.Single(result);
            Assert.True(dto.NeedsReview);
        }
    }

    [Fact]
    public async Task GetTrails_ReturnsCorrectDtoFields()
    {
        var trail = CreateTrail("Mountain Loop", TrailStatus.Published, ActivityType.TrailRunning);
        trail.Description = "A scenic trail";
        trail.Length = 12500;
        trail.ElevationGain = 450;
        trail.ElevationLoss = 430;
        trail.Type = TrailType.Loop;
        trail.Difficulty = Difficulty.Moderate;
        trail.CreatedAt = new DateTime(2026, 1, 15, 0, 0, 0, DateTimeKind.Utc);

        using (var ctx = _factory.CreateContext())
        {
            ctx.Trails.Add(trail);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new GetTrailsQueryHandler(ctx);
            var result = await handler.Handle(new GetTrailsQuery(), CancellationToken.None);
            var dto = result.Single();

            Assert.Equal("Mountain Loop", dto.Name);
            Assert.Equal("mountain-loop", dto.Slug);
            Assert.Equal("A scenic trail", dto.Description);
            Assert.Equal(12500, dto.Length);
            Assert.Equal(450, dto.ElevationGain);
            Assert.Equal(430, dto.ElevationLoss);
            Assert.Equal("Published", dto.Status);
            Assert.Equal("TrailRunning", dto.ActivityType);
            Assert.Equal("Loop", dto.TrailType);
            Assert.Equal("Moderate", dto.Difficulty);
            Assert.Equal(trail.CreatedAt, dto.CreatedAt);
            Assert.Null(dto.UpdatedAt);
        }
    }

    [Fact]
    public async Task GetTrails_IncludesLocationsAndTags()
    {
        var trail = CreateTrail("Tagged Trail");
        var location = new Location { Id = Guid.NewGuid(), Name = "Öskjuhlíð", Slug = "oskjuhlid", Type = LocationType.Area };
        var tag = new Tag { Id = Guid.NewGuid(), Name = "Scenic", Slug = "scenic", Color = "#4caf50" };

        using (var ctx = _factory.CreateContext())
        {
            ctx.Trails.Add(trail);
            ctx.Locations.Add(location);
            ctx.Tags.Add(tag);
            await ctx.SaveChangesAsync();

            ctx.TrailLocations.Add(new TrailLocation
            {
                TrailId = trail.Id,
                LocationId = location.Id,
                Role = TrailLocationRole.BelongsTo,
                Order = 0
            });
            ctx.TrailTags.Add(new TrailTag { TrailId = trail.Id, TagId = tag.Id });
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new GetTrailsQueryHandler(ctx);
            var result = await handler.Handle(new GetTrailsQuery(), CancellationToken.None);
            var dto = result.Single();

            Assert.Single(dto.Locations);
            Assert.Equal("Öskjuhlíð", dto.Locations[0].Name);
            Assert.Equal("oskjuhlid", dto.Locations[0].Slug);

            Assert.Single(dto.Tags);
            Assert.Equal("Scenic", dto.Tags[0].Name);
            Assert.Equal("#4caf50", dto.Tags[0].Color);
        }
    }

    [Fact]
    public async Task GetTrails_EmptyDatabase_ReturnsEmptyList()
    {
        using var ctx = _factory.CreateContext();
        var handler = new GetTrailsQueryHandler(ctx);
        var result = await handler.Handle(new GetTrailsQuery(), CancellationToken.None);
        Assert.Empty(result);
    }

    // --- GetTrailBySlug tests ---

    [Fact]
    public async Task GetTrailBySlug_ReturnsActualCreatedAt_NotClrDefault()
    {
        var trail = CreateTrail("River Loop", TrailStatus.Published, ActivityType.Hiking);
        trail.CreatedAt = new DateTime(2025, 6, 1, 0, 0, 0, DateTimeKind.Utc);

        using (var ctx = _factory.CreateContext())
        {
            ctx.Trails.Add(trail);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new GetTrailBySlugQueryHandler(ctx, _scheduleEngine);
            var dto = await handler.Handle(new GetTrailBySlugQuery("river-loop"), CancellationToken.None);

            Assert.NotNull(dto);
            Assert.Equal(trail.CreatedAt, dto!.CreatedAt);
            Assert.NotEqual(default, dto.CreatedAt);
        }
    }

    [Fact]
    public async Task GetTrailBySlug_ReturnsActualUpdatedAt_WhenSet()
    {
        var trail = CreateTrail("Fjord Trail", TrailStatus.Published, ActivityType.Hiking);
        trail.UpdatedAt = new DateTime(2025, 7, 2, 0, 0, 0, DateTimeKind.Utc);

        using (var ctx = _factory.CreateContext())
        {
            ctx.Trails.Add(trail);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new GetTrailBySlugQueryHandler(ctx, _scheduleEngine);
            var dto = await handler.Handle(new GetTrailBySlugQuery("fjord-trail"), CancellationToken.None);

            Assert.NotNull(dto);
            Assert.Equal(trail.UpdatedAt, dto!.UpdatedAt);
            Assert.NotEqual(trail.CreatedAt, dto.UpdatedAt);
        }
    }

    [Fact]
    public async Task GetTrailBySlug_ReturnsNullUpdatedAt_WhenNeverUpdated()
    {
        var trail = CreateTrail("Glacier Trail", TrailStatus.Published, ActivityType.Hiking);
        trail.UpdatedAt = null;

        using (var ctx = _factory.CreateContext())
        {
            ctx.Trails.Add(trail);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new GetTrailBySlugQueryHandler(ctx, _scheduleEngine);
            var dto = await handler.Handle(new GetTrailBySlugQuery("glacier-trail"), CancellationToken.None);

            Assert.NotNull(dto);
            Assert.Null(dto!.UpdatedAt);
        }
    }

    // --- GetTrailBySlug LinkedRaces effective ticket status (#979) ---

    private (Event Event, EventEdition Edition, Race Race) CreateLinkedRace(
        Guid trailId,
        RaceStatus raceStatus = RaceStatus.Active,
        TicketStatus storedTicketStatus = TicketStatus.Available,
        EditionStatus editionStatus = EditionStatus.Active,
        RegistrationStatus storedRegistrationStatus = RegistrationStatus.Open,
        DateTime? registrationOpens = null,
        DateTime? registrationCloses = null)
    {
        var ev = new Event
        {
            Id = Guid.NewGuid(),
            Name = "Test Event",
            Slug = $"test-event-{Guid.NewGuid():N}",
            Status = EventStatus.Confirmed,
        };
        var edition = new EventEdition
        {
            Id = Guid.NewGuid(),
            EventId = ev.Id,
            Status = editionStatus,
            RegistrationStatus = storedRegistrationStatus,
            RegistrationOpens = registrationOpens,
            RegistrationCloses = registrationCloses,
        };
        var race = new Race
        {
            Id = Guid.NewGuid(),
            EventEditionId = edition.Id,
            TrailId = trailId,
            Name = "10K",
            SortOrder = 0,
            Status = raceStatus,
            TicketStatus = storedTicketStatus,
        };
        return (ev, edition, race);
    }

    [Fact]
    public async Task GetTrailBySlug_LinkedRace_RegistrationNotStarted_TicketStatusReadsNotStarted()
    {
        // A race created while its edition's registration window hasn't opened yet still has
        // TicketStatus stored as Available (CreateRaceCommand's default) — this must derive live
        // from the edition's effective RegistrationStatus, not surface the stale stored value.
        var trail = CreateTrail("Highland Race Trail", TrailStatus.Published);
        var (ev, edition, race) = CreateLinkedRace(
            trail.Id,
            storedTicketStatus: TicketStatus.Available,
            registrationOpens: DateTime.UtcNow.AddDays(10),
            registrationCloses: DateTime.UtcNow.AddDays(20));

        using (var ctx = _factory.CreateContext())
        {
            ctx.Trails.Add(trail);
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            ctx.Races.Add(race);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new GetTrailBySlugQueryHandler(ctx, _scheduleEngine);
            var dto = await handler.Handle(new GetTrailBySlugQuery(trail.Slug), CancellationToken.None);

            Assert.NotNull(dto);
            var linkedRace = Assert.Single(dto!.LinkedRaces!);
            Assert.Equal("NotStarted", linkedRace.TicketStatus);
        }
    }

    [Theory]
    [InlineData(RegistrationStatus.Open, "Available")]
    [InlineData(RegistrationStatus.Closed, "Closed")]
    [InlineData(RegistrationStatus.NotRequired, "Free")]
    public async Task GetTrailBySlug_LinkedRace_RegistrationStatus_MapsToExpectedTicketStatus(
        RegistrationStatus storedRegistrationStatus, string expectedTicketStatus)
    {
        // No RegistrationOpens/Closes window set, so the stored RegistrationStatus is used as-is
        // (ComputeEffectiveRegistrationStatus falls back to it when there's no window to compute from).
        var trail = CreateTrail($"Trail For {storedRegistrationStatus}", TrailStatus.Published);
        var (ev, edition, race) = CreateLinkedRace(
            trail.Id,
            storedTicketStatus: TicketStatus.Available,
            storedRegistrationStatus: storedRegistrationStatus);

        using (var ctx = _factory.CreateContext())
        {
            ctx.Trails.Add(trail);
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            ctx.Races.Add(race);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new GetTrailBySlugQueryHandler(ctx, _scheduleEngine);
            var dto = await handler.Handle(new GetTrailBySlugQuery(trail.Slug), CancellationToken.None);

            Assert.NotNull(dto);
            var linkedRace = Assert.Single(dto!.LinkedRaces!);
            Assert.Equal(expectedTicketStatus, linkedRace.TicketStatus);
        }
    }

    [Theory]
    [InlineData(TicketStatus.SoldOut)]
    [InlineData(TicketStatus.AlmostSoldOut)]
    public async Task GetTrailBySlug_LinkedRace_ManualOverride_ReturnedUnchanged_RegardlessOfRegistrationWindow(
        TicketStatus storedTicketStatus)
    {
        // SoldOut/AlmostSoldOut are deliberate manual overrides and must not be clobbered by the
        // edition's registration window, even though registration hasn't opened yet.
        var trail = CreateTrail($"Trail For {storedTicketStatus}", TrailStatus.Published);
        var (ev, edition, race) = CreateLinkedRace(
            trail.Id,
            storedTicketStatus: storedTicketStatus,
            registrationOpens: DateTime.UtcNow.AddDays(10),
            registrationCloses: DateTime.UtcNow.AddDays(20));

        using (var ctx = _factory.CreateContext())
        {
            ctx.Trails.Add(trail);
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            ctx.Races.Add(race);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new GetTrailBySlugQueryHandler(ctx, _scheduleEngine);
            var dto = await handler.Handle(new GetTrailBySlugQuery(trail.Slug), CancellationToken.None);

            Assert.NotNull(dto);
            var linkedRace = Assert.Single(dto!.LinkedRaces!);
            Assert.Equal(storedTicketStatus.ToString(), linkedRace.TicketStatus);
        }
    }

    [Fact]
    public async Task GetTrailBySlug_LinkedRace_CompletedRaceStatus_ExcludedFromLinkedRaces()
    {
        // GetTrailBySlugQuery's linked-races filter only excludes Cancelled/Hidden race statuses,
        // so a Completed race is still expected to appear with its stored TicketStatus unchanged
        // (Completed is terminal per ComputeEffectiveTicketStatus).
        var trail = CreateTrail("Trail For Completed Race", TrailStatus.Published);
        var (ev, edition, race) = CreateLinkedRace(
            trail.Id,
            raceStatus: RaceStatus.Completed,
            storedTicketStatus: TicketStatus.Closed,
            registrationOpens: DateTime.UtcNow.AddDays(10),
            registrationCloses: DateTime.UtcNow.AddDays(20));

        using (var ctx = _factory.CreateContext())
        {
            ctx.Trails.Add(trail);
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            ctx.Races.Add(race);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new GetTrailBySlugQueryHandler(ctx, _scheduleEngine);
            var dto = await handler.Handle(new GetTrailBySlugQuery(trail.Slug), CancellationToken.None);

            Assert.NotNull(dto);
            var linkedRace = Assert.Single(dto!.LinkedRaces!);
            Assert.Equal("Closed", linkedRace.TicketStatus);
        }
    }

    [Fact]
    public async Task GetTrailBySlug_NeedsReviewAlwaysFalse_EvenWhenFlagged()
    {
        // GetTrailBySlugQuery is the public trail-detail path and never sets NeedsReview when
        // constructing TrailDto, so it defaults to false regardless of the underlying value —
        // this test locks in that already-public-safe behaviour.
        var trail = CreateTrail("Flagged Detail Trail", TrailStatus.Published);
        trail.NeedsReview = true;

        using (var ctx = _factory.CreateContext())
        {
            ctx.Trails.Add(trail);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new GetTrailBySlugQueryHandler(ctx, _scheduleEngine);
            var dto = await handler.Handle(new GetTrailBySlugQuery("flagged-detail-trail"), CancellationToken.None);

            Assert.NotNull(dto);
            Assert.False(dto!.NeedsReview);
        }
    }
}
