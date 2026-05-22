using Moq;
using Microsoft.Extensions.Caching.Memory;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Application.Events.Commands.CreateEvent;
using Utanvega.Backend.Application.Events.Commands.UpdateEvent;
using Utanvega.Backend.Application.Events.Commands.DeleteEvent;
using Utanvega.Backend.Application.Events.Commands.CreateEdition;
using Utanvega.Backend.Application.Events.Commands.UpdateEdition;
using Utanvega.Backend.Application.Events.Commands.DeleteEdition;
using Utanvega.Backend.Application.Events.Commands.CreateRace;
using Utanvega.Backend.Application.Events.Commands.UpdateRace;
using Utanvega.Backend.Application.Events.Commands.DeleteRace;
using Utanvega.Backend.Application.Events.Commands.GenerateEditionsForSeason;
using Utanvega.Backend.Application.Events.Queries.GetEvents;
using Utanvega.Backend.Application.Events.Queries.GetEvent;
using Utanvega.Backend.Application.Events.Queries.GetEventCalendar;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Core.Services;

namespace Utanvega.Backend.Tests.Handlers;

public class EventHandlerTests : IDisposable
{
    private readonly TestDbContextFactory _factory;
    private readonly IScheduleRuleEngine _scheduleEngine = new ScheduleRuleEngine();
    private readonly ICacheInvalidator _cacheInvalidator = new Mock<ICacheInvalidator>().Object;
    private readonly IMemoryCache _memoryCache;

    public EventHandlerTests()
    {
        _factory = new TestDbContextFactory();
        _memoryCache = new MemoryCache(new MemoryCacheOptions());
    }

    public void Dispose()
    {
        _factory.Dispose();
        _memoryCache.Dispose();
    }

    private Event CreateTestEvent(string name = "Test Event")
    {
        return new Event
        {
            Id = Guid.NewGuid(),
            Name = name,
            Slug = name.ToLower().Replace(" ", "-"),
            Type = EventType.Race,
            Status = EventStatus.Confirmed,
            OrganizerName = "Test Org",
            ScheduleRule = new ScheduleRule
            {
                Type = ScheduleType.Yearly,
                Month = 7,
                WeekOfMonth = 2,
                DayOfWeek = DayOfWeek.Saturday,
            },
        };
    }

    private EventEdition CreateTestEdition(Guid eventId, int year = 2025)
    {
        return new EventEdition
        {
            Id = Guid.NewGuid(),
            EventId = eventId,
            Year = year,
            Date = new DateOnly(year, 7, 12),
            Title = $"{year} Edition",
            RegistrationStatus = RegistrationStatus.Open,
        };
    }

    private Trail CreateTestTrail(string name = "Test Trail")
    {
        return new Trail
        {
            Id = Guid.NewGuid(),
            Name = name,
            Slug = name.ToLower().Replace(" ", "-"),
            Length = 55000,
            ElevationGain = 2500,
            ElevationLoss = 2300,
            ActivityTypeId = ActivityType.TrailRunning,
            Status = TrailStatus.Published,
            Type = TrailType.PointToPoint,
            Difficulty = Difficulty.Expert,
            Visibility = Visibility.Public,
        };
    }

    // ─── CreateEventCommand ───

    [Fact]
    public async Task Create_Event_Succeeds()
    {
        using var ctx = _factory.CreateContext();
        var handler = new CreateEventCommandHandler(ctx, _cacheInvalidator);

        var id = await handler.Handle(new CreateEventCommand(
            Name: "Laugavegur Ultra",
            Slug: "laugavegur-ultra",
            Description: "55K ultra through the highlands",
            Type: "Race",
            ActivityType: "TrailRunning",
            Status: "Confirmed",
            OrganizerName: "ÍSÍ",
            OrganizerWebsite: "https://marathon.is",
            AlertMessage: null,
            AlertSeverity: null,
            LocationId: null,
            ScheduleRule: new ScheduleRule { Type = ScheduleType.Yearly, Month = 7, WeekOfMonth = 2, DayOfWeek = DayOfWeek.Saturday },
            SocialLinks: null
        ), CancellationToken.None);

        Assert.NotEqual(Guid.Empty, id);

        using var verifyCtx = _factory.CreateContext();
        var ev = verifyCtx.Events.Find(id);
        Assert.NotNull(ev);
        Assert.Equal("Laugavegur Ultra", ev!.Name);
        Assert.Equal("laugavegur-ultra", ev.Slug);
        Assert.Equal(EventStatus.Confirmed, ev.Status);
        Assert.Equal(EventType.Race, ev.Type);
    }

    [Fact]
    public async Task Create_Event_GeneratesSlug_WhenNotProvided()
    {
        using var ctx = _factory.CreateContext();
        var handler = new CreateEventCommandHandler(ctx, _cacheInvalidator);

        var id = await handler.Handle(new CreateEventCommand(
            Name: "Reykjavík Marathon",
            Slug: null,
            Description: null,
            Type: "Race",
            ActivityType: "Running",
            Status: "Confirmed",
            OrganizerName: null,
            OrganizerWebsite: null,
            AlertMessage: null,
            AlertSeverity: null,
            LocationId: null,
            ScheduleRule: null,
            SocialLinks: null
        ), CancellationToken.None);

        using var verifyCtx = _factory.CreateContext();
        var ev = verifyCtx.Events.Find(id);
        Assert.NotNull(ev);
        Assert.NotEmpty(ev!.Slug);
        Assert.DoesNotContain(" ", ev.Slug);
    }

    // ─── UpdateEventCommand ───

    [Fact]
    public async Task Update_ExistingEvent_Succeeds()
    {
        var ev = CreateTestEvent();
        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new UpdateEventCommandHandler(ctx, _cacheInvalidator);
            var result = await handler.Handle(new UpdateEventCommand(
                Id: ev.Id,
                Name: "Updated Name",
                Description: "Updated desc",
                Type: "Festival",
                ActivityType: "Social",
                Status: "Cancelled",
                OrganizerName: "New Org",
                OrganizerWebsite: "https://new.is",
                AlertMessage: null,
                AlertSeverity: null,
                LocationId: null,
                ScheduleRule: null,
                SocialLinks: null
            ), CancellationToken.None);

            Assert.True(result);
        }

        using (var ctx = _factory.CreateContext())
        {
            var updated = ctx.Events.Find(ev.Id);
            Assert.Equal("Updated Name", updated!.Name);
            Assert.Equal(EventStatus.Cancelled, updated.Status);
            Assert.Equal(EventType.Festival, updated.Type);
            Assert.NotNull(updated.UpdatedAt);
        }
    }

    [Fact]
    public async Task Update_NonExistentEvent_ReturnsFalse()
    {
        using var ctx = _factory.CreateContext();
        var handler = new UpdateEventCommandHandler(ctx, _cacheInvalidator);
        var result = await handler.Handle(new UpdateEventCommand(
            Id: Guid.NewGuid(),
            Name: "Nothing",
            Description: null,
            Type: "Race",
            ActivityType: "TrailRunning",
            Status: "Confirmed",
            OrganizerName: null,
            OrganizerWebsite: null,
            AlertMessage: null,
            AlertSeverity: null,
            LocationId: null,
            ScheduleRule: null,
            SocialLinks: null
        ), CancellationToken.None);

        Assert.False(result);
    }

    // ─── DeleteEventCommand ───

    [Fact]
    public async Task Delete_ExistingEvent_Succeeds()
    {
        var ev = CreateTestEvent();
        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new DeleteEventCommandHandler(ctx, _cacheInvalidator);
            var result = await handler.Handle(
                new DeleteEventCommand(ev.Id), CancellationToken.None);
            Assert.True(result);
        }

        using (var ctx = _factory.CreateContext())
        {
            Assert.Null(ctx.Events.Find(ev.Id));
        }
    }

    [Fact]
    public async Task Delete_NonExistentEvent_ReturnsFalse()
    {
        using var ctx = _factory.CreateContext();
        var handler = new DeleteEventCommandHandler(ctx, _cacheInvalidator);
        var result = await handler.Handle(
            new DeleteEventCommand(Guid.NewGuid()), CancellationToken.None);
        Assert.False(result);
    }

    [Fact]
    public async Task Delete_Event_CascadesDeleteToEditionsAndRaces()
    {
        var ev = CreateTestEvent();
        var edition = CreateTestEdition(ev.Id);
        var race = new Race
        {
            Id = Guid.NewGuid(),
            EventEditionId = edition.Id,
            Name = "55K Ultra",
            DistanceLabel = "55 km",
            SortOrder = 0,
        };

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            ctx.Races.Add(race);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new DeleteEventCommandHandler(ctx, _cacheInvalidator);
            await handler.Handle(new DeleteEventCommand(ev.Id), CancellationToken.None);
        }

        using (var ctx = _factory.CreateContext())
        {
            Assert.Null(ctx.EventEditions.Find(edition.Id));
            Assert.Null(ctx.Races.Find(race.Id));
        }
    }

    // ─── CreateEditionCommand ───

    [Fact]
    public async Task Create_Edition_Succeeds()
    {
        var ev = CreateTestEvent();
        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            await ctx.SaveChangesAsync();
        }

        using var edCtx = _factory.CreateContext();
        var handler = new CreateEditionCommandHandler(edCtx, _cacheInvalidator);
        var id = await handler.Handle(new CreateEditionCommand(
            EventId: ev.Id,
            Year: 2025,
            Date: new DateOnly(2025, 7, 12),
            Title: "2025 Edition",
            RegistrationUrl: "https://register.is",
            ResultsUrl: null,
            Notes: null,
            RegistrationStatus: "Open",
            TrailId: null
        ), CancellationToken.None);

        Assert.NotEqual(Guid.Empty, id);

        using var verifyCtx = _factory.CreateContext();
        var edition = verifyCtx.EventEditions.Find(id);
        Assert.NotNull(edition);
        Assert.Equal(2025, edition!.Year);
        Assert.Equal(new DateOnly(2025, 7, 12), edition.Date);
        Assert.Equal(RegistrationStatus.Open, edition.RegistrationStatus);
    }

    // ─── UpdateEditionCommand ───

    [Fact]
    public async Task Update_ExistingEdition_Succeeds()
    {
        var ev = CreateTestEvent();
        var edition = CreateTestEdition(ev.Id);
        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new UpdateEditionCommandHandler(ctx, _cacheInvalidator);
            var result = await handler.Handle(new UpdateEditionCommand(
                Id: edition.Id,
                Year: 2026,
                Date: new DateOnly(2026, 7, 11),
                Title: "2026 Edition",
                RegistrationUrl: "https://new-register.is",
                ResultsUrl: "https://results.is",
                Notes: "Updated notes",
                RegistrationStatus: "Closed",
                TrailId: null
            ), CancellationToken.None);

            Assert.True(result);
        }

        using (var ctx = _factory.CreateContext())
        {
            var updated = ctx.EventEditions.Find(edition.Id);
            Assert.Equal(2026, updated!.Year);
            Assert.Equal("2026 Edition", updated.Title);
            Assert.Equal(RegistrationStatus.Closed, updated.RegistrationStatus);
        }
    }

    // ─── DeleteEditionCommand ───

    [Fact]
    public async Task Delete_ExistingEdition_Succeeds()
    {
        var ev = CreateTestEvent();
        var edition = CreateTestEdition(ev.Id);
        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new DeleteEditionCommandHandler(ctx, _cacheInvalidator);
            var result = await handler.Handle(
                new DeleteEditionCommand(edition.Id), CancellationToken.None);
            Assert.True(result);
        }

        using (var ctx = _factory.CreateContext())
        {
            Assert.Null(ctx.EventEditions.Find(edition.Id));
        }
    }

    // ─── CreateRaceCommand ───

    [Fact]
    public async Task Create_Race_Succeeds()
    {
        var ev = CreateTestEvent();
        var edition = CreateTestEdition(ev.Id);
        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            await ctx.SaveChangesAsync();
        }

        using var raceCtx = _factory.CreateContext();
        var handler = new CreateRaceCommandHandler(raceCtx, _cacheInvalidator);
        var id = await handler.Handle(new CreateRaceCommand(
            EventEditionId: edition.Id,
            TrailId: null,
            Name: "55K Ultra",
            DistanceLabel: "55 km",
            CutoffMinutes: 720,
            Description: "The main event",
            Status: "Active",
            SortOrder: 0,
            TicketStatus: "Available",
            MaxParticipants: 200,
            ItraPoints: 4,
            CertifiedBy: "ITRA",
            PrizeMoney: 1000m,
            ChampionshipCategory: null,
            DateOfRace: new DateOnly(2025, 7, 12),
            StartTime: new TimeOnly(8, 0)
        ), CancellationToken.None);

        Assert.NotEqual(Guid.Empty, id);

        using var verifyCtx = _factory.CreateContext();
        var race = verifyCtx.Races.Find(id);
        Assert.NotNull(race);
        Assert.Equal("55K Ultra", race!.Name);
        Assert.Equal(720, race.CutoffMinutes);
        Assert.Equal(4, race.ItraPoints);
        Assert.Equal(200, race.MaxParticipants);
    }

    // ─── UpdateRaceCommand ───

    [Fact]
    public async Task Update_ExistingRace_Succeeds()
    {
        var ev = CreateTestEvent();
        var edition = CreateTestEdition(ev.Id);
        var race = new Race
        {
            Id = Guid.NewGuid(),
            EventEditionId = edition.Id,
            Name = "10K Fun Run",
            SortOrder = 1,
        };

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            ctx.Races.Add(race);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new UpdateRaceCommandHandler(ctx, _cacheInvalidator);
            var result = await handler.Handle(new UpdateRaceCommand(
                Id: race.Id,
                TrailId: null,
                Name: "10K Competitive",
                DistanceLabel: "10 km",
                CutoffMinutes: 120,
                Description: "Fast and fun",
                Status: "Active",
                SortOrder: 2,
                TicketStatus: "SoldOut",
                MaxParticipants: 100,
                ItraPoints: 1,
                CertifiedBy: null,
                PrizeMoney: 0,
                ChampionshipCategory: null,
                DateOfRace: null,
                StartTime: null
            ), CancellationToken.None);

            Assert.True(result);
        }

        using (var ctx = _factory.CreateContext())
        {
            var updated = ctx.Races.Find(race.Id);
            Assert.Equal("10K Competitive", updated!.Name);
            Assert.Equal(120, updated.CutoffMinutes);
            Assert.Equal(TicketStatus.SoldOut, updated.TicketStatus);
        }
    }

    [Fact]
    public async Task Update_NonExistentRace_ReturnsFalse()
    {
        using var ctx = _factory.CreateContext();
        var handler = new UpdateRaceCommandHandler(ctx, _cacheInvalidator);
        var result = await handler.Handle(new UpdateRaceCommand(
            Id: Guid.NewGuid(),
            TrailId: null,
            Name: "Nothing",
            DistanceLabel: null,
            CutoffMinutes: null,
            Description: null,
            Status: "Active",
            SortOrder: 0,
            TicketStatus: "Available",
            MaxParticipants: null,
            ItraPoints: 0,
            CertifiedBy: null,
            PrizeMoney: 0,
            ChampionshipCategory: null,
            DateOfRace: null,
            StartTime: null
        ), CancellationToken.None);

        Assert.False(result);
    }

    // ─── DeleteRaceCommand ───

    [Fact]
    public async Task Delete_ExistingRace_Succeeds()
    {
        var ev = CreateTestEvent();
        var edition = CreateTestEdition(ev.Id);
        var race = new Race
        {
            Id = Guid.NewGuid(),
            EventEditionId = edition.Id,
            Name = "Half Marathon",
            SortOrder = 0,
        };

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            ctx.Races.Add(race);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new DeleteRaceCommandHandler(ctx, _cacheInvalidator);
            var result = await handler.Handle(
                new DeleteRaceCommand(race.Id), CancellationToken.None);
            Assert.True(result);
        }

        using (var ctx = _factory.CreateContext())
        {
            Assert.Null(ctx.Races.Find(race.Id));
        }
    }

    // ─── GenerateEditionsForSeasonCommand ───

    [Fact]
    public async Task GenerateEditions_CreatesEditionsFromScheduleRule()
    {
        var ev = CreateTestEvent();
        ev.ScheduleRule = new ScheduleRule
        {
            Type = ScheduleType.Seasonal,
            DayOfWeek = DayOfWeek.Thursday,
            MonthStart = 10,
            MonthEnd = 12,
        };

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            await ctx.SaveChangesAsync();
        }

        using var genCtx = _factory.CreateContext();
        var handler = new GenerateEditionsForSeasonCommandHandler(genCtx, _scheduleEngine, _cacheInvalidator);
        var ids = await handler.Handle(new GenerateEditionsForSeasonCommand(
            EventId: ev.Id,
            From: new DateOnly(2025, 10, 1),
            To: new DateOnly(2025, 12, 31)
        ), CancellationToken.None);

        Assert.NotEmpty(ids);

        using var verifyCtx = _factory.CreateContext();
        var editions = verifyCtx.EventEditions.Where(e => e.EventId == ev.Id).ToList();
        Assert.Equal(ids.Count, editions.Count);
        Assert.All(editions, e => Assert.NotNull(e.Date));
    }

    [Fact]
    public async Task GenerateEditions_ReturnsEmpty_WhenNoScheduleRule()
    {
        var ev = CreateTestEvent();
        ev.ScheduleRule = null;

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            await ctx.SaveChangesAsync();
        }

        using var genCtx = _factory.CreateContext();
        var handler = new GenerateEditionsForSeasonCommandHandler(genCtx, _scheduleEngine, _cacheInvalidator);
        var ids = await handler.Handle(new GenerateEditionsForSeasonCommand(
            EventId: ev.Id,
            From: new DateOnly(2025, 1, 1),
            To: new DateOnly(2025, 12, 31)
        ), CancellationToken.None);

        Assert.Empty(ids);
    }

    // ─── GetEventsQuery ───

    [Fact]
    public async Task GetEvents_ReturnsAllConfirmed()
    {
        var confirmed = CreateTestEvent("Confirmed Event");
        var hidden = CreateTestEvent("Hidden Event");
        hidden.Slug = "hidden-event";
        hidden.Status = EventStatus.Hidden;

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.AddRange(confirmed, hidden);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEventsQueryHandler(queryCtx, _scheduleEngine);
        var result = await handler.Handle(new GetEventsQuery(IncludeHidden: false), CancellationToken.None);

        Assert.Single(result);
        Assert.Equal("Confirmed Event", result[0].Name);
    }

    [Fact]
    public async Task GetEvents_IncludesHidden_WhenRequested()
    {
        var confirmed = CreateTestEvent("Confirmed Event");
        var hidden = CreateTestEvent("Hidden Event");
        hidden.Slug = "hidden-event";
        hidden.Status = EventStatus.Hidden;

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.AddRange(confirmed, hidden);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEventsQueryHandler(queryCtx, _scheduleEngine);
        var result = await handler.Handle(new GetEventsQuery(IncludeHidden: true), CancellationToken.None);

        Assert.Equal(2, result.Count);
    }

    [Fact]
    public async Task GetEvents_ComputesNextDate_FromEdition()
    {
        var ev = CreateTestEvent();
        var futureDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30));
        var edition = new EventEdition
        {
            Id = Guid.NewGuid(),
            EventId = ev.Id,
            Year = futureDate.Year,
            Date = futureDate,
            RegistrationStatus = RegistrationStatus.Open,
        };

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEventsQueryHandler(queryCtx, _scheduleEngine);
        var result = await handler.Handle(new GetEventsQuery(), CancellationToken.None);

        Assert.Single(result);
        Assert.NotNull(result[0].NextEditionDate);
        Assert.NotNull(result[0].DaysUntil);
    }

    // ─── GetEventQuery (by slug) ───

    [Fact]
    public async Task GetEvent_BySlug_ReturnsWithEditionsAndRaces()
    {
        var ev = CreateTestEvent("Laugavegur Ultra");
        ev.Slug = "laugavegur-ultra";

        var trail = CreateTestTrail();
        var edition = CreateTestEdition(ev.Id);
        var race = new Race
        {
            Id = Guid.NewGuid(),
            EventEditionId = edition.Id,
            TrailId = trail.Id,
            Name = "55K Ultra",
            DistanceLabel = "55 km",
            SortOrder = 0,
        };

        using (var ctx = _factory.CreateContext())
        {
            ctx.Trails.Add(trail);
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            ctx.Races.Add(race);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEventQueryHandler(queryCtx, _scheduleEngine);
        var result = await handler.Handle(
            new GetEventQuery("laugavegur-ultra"), CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal("Laugavegur Ultra", result!.Name);
        Assert.Single(result.Editions);
        Assert.Single(result.Editions[0].Races);
        Assert.Equal("55K Ultra", result.Editions[0].Races[0].Name);
        Assert.Equal(trail.Name, result.Editions[0].Races[0].TrailName);
    }

    [Fact]
    public async Task GetEvent_NonExistentSlug_ReturnsNull()
    {
        using var ctx = _factory.CreateContext();
        var handler = new GetEventQueryHandler(ctx, _scheduleEngine);
        var result = await handler.Handle(
            new GetEventQuery("does-not-exist"), CancellationToken.None);
        Assert.Null(result);
    }

    // ─── GetEventCalendarQuery ───

    [Fact]
    public async Task GetEventCalendar_ReturnsEditionsInRange()
    {
        var ev = CreateTestEvent();
        var edition = new EventEdition
        {
            Id = Guid.NewGuid(),
            EventId = ev.Id,
            Year = 2025,
            Date = new DateOnly(2025, 7, 12),
            RegistrationStatus = RegistrationStatus.Open,
        };

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEventCalendarQueryHandler(queryCtx, _memoryCache);
        var result = await handler.Handle(
            new GetEventCalendarQuery(new DateOnly(2025, 7, 1), new DateOnly(2025, 7, 31)),
            CancellationToken.None);

        Assert.Single(result);
        Assert.Equal(new DateOnly(2025, 7, 12), result[0].Date);
        Assert.Single(result[0].Events);
    }

    [Fact]
    public async Task GetEventCalendar_ExcludesHiddenEvents()
    {
        var ev = CreateTestEvent();
        ev.Status = EventStatus.Hidden;
        var edition = new EventEdition
        {
            Id = Guid.NewGuid(),
            EventId = ev.Id,
            Year = 2025,
            Date = new DateOnly(2025, 7, 12),
            RegistrationStatus = RegistrationStatus.Open,
        };

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEventCalendarQueryHandler(queryCtx, _memoryCache);
        var result = await handler.Handle(
            new GetEventCalendarQuery(new DateOnly(2025, 7, 1), new DateOnly(2025, 7, 31)),
            CancellationToken.None);

        Assert.Empty(result);
    }
}
