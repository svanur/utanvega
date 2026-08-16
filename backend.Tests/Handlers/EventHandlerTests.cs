using Moq;
using Microsoft.Extensions.Caching.Memory;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Application.Events.Commands.CreateEvent;
using Utanvega.Backend.Application.Events.Commands.UpdateEvent;
using Utanvega.Backend.Application.Events.Commands.DeleteEvent;
using Utanvega.Backend.Application.Events.Commands.CreateEdition;
using Utanvega.Backend.Application.Events.Commands.UpdateEdition;
using Utanvega.Backend.Application.Events.Commands.DeleteEdition;
using Utanvega.Backend.Application.Events.Commands.CancelEdition;
using Utanvega.Backend.Application.Events.Commands.CreateRace;
using Utanvega.Backend.Application.Events.Commands.UpdateRace;
using Utanvega.Backend.Application.Events.Commands.DeleteRace;
using Utanvega.Backend.Application.Events.Commands.GenerateEditionsForSeason;
using Utanvega.Backend.Application.Events.Queries.GetEvents;
using Utanvega.Backend.Application.Events.Queries.GetEvent;
using Utanvega.Backend.Application.Events.Queries.GetEventCalendar;
using Utanvega.Backend.Application.Events.Queries.GetAllEventDetails;
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
            OrganizerId: null,
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
            OrganizerId: null,
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
                Slug: null, // null leaves the existing slug untouched
                Description: "Updated desc",
                Type: "Festival",
                ActivityType: "Canicross",
                Status: "Cancelled",
                OrganizerName: "New Org",
                OrganizerWebsite: "https://new.is",
                OrganizerId: null,
                AlertMessage: null,
                AlertSeverity: null,
                LocationId: null,
                ScheduleRule: null,
                SocialLinks: null,
                GpxPointLat: null,
                GpxPointLng: null
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
            Slug: null,
            Description: null,
            Type: "Race",
            ActivityType: "TrailRunning",
            Status: "Confirmed",
            OrganizerName: null,
            OrganizerWebsite: null,
            OrganizerId: null,
            AlertMessage: null,
            AlertSeverity: null,
            LocationId: null,
            ScheduleRule: null,
            SocialLinks: null,
            GpxPointLat: null,
            GpxPointLng: null
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
            EndDate: null,
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
                EndDate: null,
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
            ResultType: "Time",
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
                ResultType: "Time",
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
            ResultType: "Time",
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

    [Fact]
    public async Task Create_Race_WithActivityType_SavesCorrectly()
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
            Name: "1km Swim",
            DistanceLabel: "1 km",
            CutoffMinutes: null,
            Description: null,
            Status: "Active",
            SortOrder: 0,
            TicketStatus: "Available",
            ResultType: "Time",
            MaxParticipants: null,
            ItraPoints: null,
            CertifiedBy: null,
            PrizeMoney: 0,
            ChampionshipCategory: null,
            DateOfRace: null,
            StartTime: null,
            ActivityType: "Swim"
        ), CancellationToken.None);

        using var verifyCtx = _factory.CreateContext();
        var race = verifyCtx.Races.Find(id);
        Assert.NotNull(race);
        Assert.Equal(ActivityType.Swim, race!.ActivityType);
    }

    [Fact]
    public async Task Update_Race_ActivityType_SavesCorrectly()
    {
        var ev = CreateTestEvent();
        var edition = CreateTestEdition(ev.Id);
        var race = new Race
        {
            Id = Guid.NewGuid(),
            EventEditionId = edition.Id,
            Name = "1km Swim",
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
            var handler = new UpdateRaceCommandHandler(ctx, _cacheInvalidator);
            var result = await handler.Handle(new UpdateRaceCommand(
                Id: race.Id,
                TrailId: null,
                Name: "1km Swim",
                DistanceLabel: "1 km",
                CutoffMinutes: null,
                Description: null,
                Status: "Active",
                SortOrder: 0,
                TicketStatus: "Available",
                ResultType: "Time",
                MaxParticipants: null,
                ItraPoints: null,
                CertifiedBy: null,
                PrizeMoney: 0,
                ChampionshipCategory: null,
                DateOfRace: null,
                StartTime: null,
                ActivityType: "Swim"
            ), CancellationToken.None);

            Assert.True(result);
        }

        using (var ctx = _factory.CreateContext())
        {
            var updated = ctx.Races.Find(race.Id);
            Assert.Equal(ActivityType.Swim, updated!.ActivityType);
        }
    }

    [Fact]
    public async Task Create_Race_WithResultType_SavesCorrectly()
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
            Name: "24 Hour Run",
            DistanceLabel: "How far can you go",
            CutoffMinutes: 1440,
            Description: null,
            Status: "Active",
            SortOrder: 0,
            TicketStatus: "Available",
            ResultType: "Distance",
            MaxParticipants: null,
            ItraPoints: null,
            CertifiedBy: null,
            PrizeMoney: 0,
            ChampionshipCategory: null,
            DateOfRace: null,
            StartTime: null
        ), CancellationToken.None);

        using var verifyCtx = _factory.CreateContext();
        var race = verifyCtx.Races.Find(id);
        Assert.NotNull(race);
        Assert.Equal(ResultType.Distance, race!.ResultType);
    }

    [Fact]
    public async Task Update_Race_ResultType_SavesCorrectly()
    {
        var ev = CreateTestEvent();
        var edition = CreateTestEdition(ev.Id);
        var race = new Race
        {
            Id = Guid.NewGuid(),
            EventEditionId = edition.Id,
            Name = "Backyard Ultra",
            SortOrder = 0,
            ResultType = ResultType.Time,
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
                Name: "Backyard Ultra",
                DistanceLabel: "Last man standing",
                CutoffMinutes: null,
                Description: null,
                Status: "Active",
                SortOrder: 0,
                TicketStatus: "Available",
                ResultType: "Laps",
                MaxParticipants: null,
                ItraPoints: null,
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
            Assert.Equal(ResultType.Laps, updated!.ResultType);
        }
    }

    [Fact]
    public async Task Update_Race_ActivityType_ClearsWhenNull()
    {
        var ev = CreateTestEvent();
        var edition = CreateTestEdition(ev.Id);
        var race = new Race
        {
            Id = Guid.NewGuid(),
            EventEditionId = edition.Id,
            Name = "Swim Leg",
            SortOrder = 0,
            ActivityType = ActivityType.Swim,
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
            await handler.Handle(new UpdateRaceCommand(
                Id: race.Id,
                TrailId: null,
                Name: "Swim Leg",
                DistanceLabel: null,
                CutoffMinutes: null,
                Description: null,
                Status: "Active",
                SortOrder: 0,
                TicketStatus: "Available",
                ResultType: "Time",
                MaxParticipants: null,
                ItraPoints: null,
                CertifiedBy: null,
                PrizeMoney: 0,
                ChampionshipCategory: null,
                DateOfRace: null,
                StartTime: null,
                ActivityType: null   // explicitly cleared
            ), CancellationToken.None);
        }

        using (var ctx = _factory.CreateContext())
        {
            var updated = ctx.Races.Find(race.Id);
            Assert.Null(updated!.ActivityType);
        }
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
        var result = await handler.Handle(new GenerateEditionsForSeasonCommand(
            EventId: ev.Id,
            From: new DateOnly(2025, 10, 1),
            To: new DateOnly(2025, 12, 31)
        ), CancellationToken.None);

        Assert.NotEmpty(result.EditionIds);

        using var verifyCtx = _factory.CreateContext();
        var editions = verifyCtx.EventEditions.Where(e => e.EventId == ev.Id).ToList();
        Assert.Equal(result.EditionIds.Count, editions.Count);
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
        var result = await handler.Handle(new GenerateEditionsForSeasonCommand(
            EventId: ev.Id,
            From: new DateOnly(2025, 1, 1),
            To: new DateOnly(2025, 12, 31)
        ), CancellationToken.None);

        Assert.Empty(result.EditionIds);
        Assert.Equal(0, result.RacesCreated);
    }

    [Fact]
    public async Task GenerateEditions_Series_GroupsBySeasonAndCreatesRaces()
    {
        var ev = CreateTestEvent("Powerade vetrarhlaup");
        ev.Type = EventType.Series;
        ev.ScheduleRule = new ScheduleRule
        {
            Type = ScheduleType.Seasonal,
            DayOfWeek = DayOfWeek.Thursday,
            WeekOfMonth = 2,
            MonthStart = 10,
            MonthEnd = 3,
        };

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            await ctx.SaveChangesAsync();
        }

        using var genCtx = _factory.CreateContext();
        var handler = new GenerateEditionsForSeasonCommandHandler(genCtx, _scheduleEngine, _cacheInvalidator);
        var result = await handler.Handle(new GenerateEditionsForSeasonCommand(
            EventId: ev.Id,
            From: new DateOnly(2025, 10, 1),
            To: new DateOnly(2026, 3, 31),
            SeasonStartMonth: 10
        ), CancellationToken.None);

        // Should create 1 edition (season 2025–2026) with 6 races (Oct–Mar)
        Assert.Single(result.EditionIds);
        Assert.Equal(6, result.RacesCreated);

        using var verifyCtx = _factory.CreateContext();
        var edition = verifyCtx.EventEditions
            .Where(e => e.EventId == ev.Id)
            .Single();
        Assert.Equal(2025, edition.Year);
        Assert.Contains("2025", edition.Title!);

        var races = verifyCtx.Races.Where(r => r.EventEditionId == edition.Id).OrderBy(r => r.SortOrder).ToList();
        Assert.Equal(6, races.Count);
        Assert.All(races, r => Assert.NotNull(r.DateOfRace));
        // First race should be in October, last in March
        Assert.Equal(10, races[0].DateOfRace!.Value.Month);
        Assert.Equal(3, races[^1].DateOfRace!.Value.Month);
    }

    [Fact]
    public async Task GenerateEditions_Series_IsIdempotent()
    {
        var ev = CreateTestEvent("Winter Series");
        ev.Type = EventType.Series;
        ev.ScheduleRule = new ScheduleRule
        {
            Type = ScheduleType.Seasonal,
            DayOfWeek = DayOfWeek.Thursday,
            WeekOfMonth = 2,
            MonthStart = 10,
            MonthEnd = 12,
        };

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            await ctx.SaveChangesAsync();
        }

        // First run
        using (var genCtx = _factory.CreateContext())
        {
            var handler = new GenerateEditionsForSeasonCommandHandler(genCtx, _scheduleEngine, _cacheInvalidator);
            var result = await handler.Handle(new GenerateEditionsForSeasonCommand(
                EventId: ev.Id,
                From: new DateOnly(2025, 10, 1),
                To: new DateOnly(2025, 12, 31),
                SeasonStartMonth: 10
            ), CancellationToken.None);
            Assert.Single(result.EditionIds);
            Assert.True(result.RacesCreated > 0);
        }

        // Second run — should create nothing
        using (var genCtx = _factory.CreateContext())
        {
            var handler = new GenerateEditionsForSeasonCommandHandler(genCtx, _scheduleEngine, _cacheInvalidator);
            var result = await handler.Handle(new GenerateEditionsForSeasonCommand(
                EventId: ev.Id,
                From: new DateOnly(2025, 10, 1),
                To: new DateOnly(2025, 12, 31),
                SeasonStartMonth: 10
            ), CancellationToken.None);
            Assert.Empty(result.EditionIds);
            Assert.Equal(0, result.RacesCreated);
        }

        // Verify still only 1 edition
        using var verifyCtx = _factory.CreateContext();
        var editions = verifyCtx.EventEditions.Where(e => e.EventId == ev.Id).ToList();
        Assert.Single(editions);
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

    // ─── Recently Completed (DaysUntil negative) ───

    [Fact]
    public async Task GetEvents_RecentlyCompleted_ReturnsNegativeDaysUntil()
    {
        var ev = CreateTestEvent("Yesterday Race");
        ev.Slug = "yesterday-race";
        ev.ScheduleRule = null;
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var pastDate = today.AddDays(-1);
        var edition = new EventEdition
        {
            Id = Guid.NewGuid(),
            EventId = ev.Id,
            Year = pastDate.Year,
            Date = pastDate,
            RegistrationStatus = RegistrationStatus.Closed,
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

        var dto = Assert.Single(result);
        Assert.Equal(-1, dto.DaysUntil);
        Assert.Equal(pastDate, dto.DisplayDate);
    }

    [Fact]
    public async Task GetEvents_RecentlyCompleted_3DayBoundary()
    {
        var ev = CreateTestEvent("Three Days Ago");
        ev.Slug = "three-days-ago";
        ev.ScheduleRule = null;
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var pastDate = today.AddDays(-3);
        var edition = new EventEdition
        {
            Id = Guid.NewGuid(),
            EventId = ev.Id,
            Year = pastDate.Year,
            Date = pastDate,
            RegistrationStatus = RegistrationStatus.Closed,
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

        var dto = Assert.Single(result);
        Assert.Equal(-3, dto.DaysUntil);
        Assert.Equal(pastDate, dto.DisplayDate);
    }

    [Fact]
    public async Task GetEvents_RecentlyCompleted_BeyondBoundary_ReturnsNull()
    {
        var ev = CreateTestEvent("Four Days Ago");
        ev.Slug = "four-days-ago";
        ev.ScheduleRule = null;
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var pastDate = today.AddDays(-4);
        var edition = new EventEdition
        {
            Id = Guid.NewGuid(),
            EventId = ev.Id,
            Year = pastDate.Year,
            Date = pastDate,
            RegistrationStatus = RegistrationStatus.Closed,
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

        var dto = Assert.Single(result);
        Assert.Null(dto.DaysUntil);
        Assert.Null(dto.DisplayDate);
    }

    [Fact]
    public async Task GetEvents_RecentlyCompleted_CancelledEvent_NotMarkedAsCompleted()
    {
        var ev = CreateTestEvent("Cancelled Yesterday");
        ev.Slug = "cancelled-yesterday";
        ev.Status = EventStatus.Cancelled;
        ev.ScheduleRule = null;
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var pastDate = today.AddDays(-1);
        var edition = new EventEdition
        {
            Id = Guid.NewGuid(),
            EventId = ev.Id,
            Year = pastDate.Year,
            Date = pastDate,
            RegistrationStatus = RegistrationStatus.Closed,
        };

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEventsQueryHandler(queryCtx, _scheduleEngine);
        var result = await handler.Handle(new GetEventsQuery(IncludeHidden: true), CancellationToken.None);

        var dto = Assert.Single(result);
        Assert.Null(dto.DaysUntil);
        Assert.Null(dto.DisplayDate);
    }

    [Fact]
    public async Task GetEvents_RecentlyCompleted_WithScheduleRule_StillShowsNegative()
    {
        var ev = CreateTestEvent("Annual Race");
        ev.Slug = "annual-race";
        // Has a schedule rule that would generate future dates
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var pastDate = today.AddDays(-1);
        var edition = new EventEdition
        {
            Id = Guid.NewGuid(),
            EventId = ev.Id,
            Year = pastDate.Year,
            Date = pastDate,
            RegistrationStatus = RegistrationStatus.Closed,
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

        var dto = Assert.Single(result);
        Assert.Equal(-1, dto.DaysUntil);
        Assert.Equal(pastDate, dto.DisplayDate);
        // NextEditionDate should still be a future date (from schedule rule)
        Assert.NotNull(dto.NextEditionDate);
        Assert.True(dto.NextEditionDate > pastDate);
    }

    // ─── Multi-day event: EndDate logic ───

    [Fact]
    public async Task GetEvents_OngoingMultiDay_ReturnsDaysUntilZero()
    {
        var ev = CreateTestEvent("Multi Day Race");
        ev.Slug = "multi-day-race";
        ev.ScheduleRule = null;
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var edition = new EventEdition
        {
            Id = Guid.NewGuid(),
            EventId = ev.Id,
            Year = today.Year,
            Date = today.AddDays(-1),    // started yesterday
            EndDate = today.AddDays(1),  // ends tomorrow
            RegistrationStatus = RegistrationStatus.Closed,
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

        var dto = Assert.Single(result);
        Assert.Equal(0, dto.DaysUntil);
        Assert.Equal(edition.Date, dto.DisplayDate);
        Assert.True(dto.HasFutureEdition);
    }

    [Fact]
    public async Task GetEvents_OngoingMultiDay_LastDay_ReturnsDaysUntilZero()
    {
        var ev = CreateTestEvent("Last Day Race");
        ev.Slug = "last-day-race";
        ev.ScheduleRule = null;
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var edition = new EventEdition
        {
            Id = Guid.NewGuid(),
            EventId = ev.Id,
            Year = today.Year,
            Date = today.AddDays(-2),  // started 2 days ago
            EndDate = today,           // ends today
            RegistrationStatus = RegistrationStatus.Closed,
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

        var dto = Assert.Single(result);
        Assert.Equal(0, dto.DaysUntil);
        Assert.Equal(edition.Date, dto.DisplayDate);
        Assert.True(dto.HasFutureEdition);
    }

    [Fact]
    public async Task GetEvents_MultiDay_RecentlyCompleted_UsesDaysSinceEndDate()
    {
        var ev = CreateTestEvent("Just Finished Race");
        ev.Slug = "just-finished-race";
        ev.ScheduleRule = null;
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var edition = new EventEdition
        {
            Id = Guid.NewGuid(),
            EventId = ev.Id,
            Year = today.Year,
            Date = today.AddDays(-3),   // started 3 days ago
            EndDate = today.AddDays(-1), // ended yesterday
            RegistrationStatus = RegistrationStatus.Closed,
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

        var dto = Assert.Single(result);
        Assert.Equal(-1, dto.DaysUntil);                    // days since EndDate
        Assert.Equal(edition.Date, dto.DisplayDate);         // displayDate = start date, not end
        Assert.Equal(edition.EndDate, dto.EndDisplayDate);
    }

    [Fact]
    public async Task GetEvents_MultiDay_EndedTooLongAgo_NullDaysUntil()
    {
        var ev = CreateTestEvent("Old Multi Day");
        ev.Slug = "old-multi-day";
        ev.ScheduleRule = null;
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var edition = new EventEdition
        {
            Id = Guid.NewGuid(),
            EventId = ev.Id,
            Year = today.Year,
            Date = today.AddDays(-7),
            EndDate = today.AddDays(-4),  // ended 4 days ago — beyond 3-day window
            RegistrationStatus = RegistrationStatus.Closed,
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

        var dto = Assert.Single(result);
        Assert.Null(dto.DaysUntil);
        Assert.Null(dto.DisplayDate);
    }

    [Fact]
    public async Task GetEvents_HasFutureEdition_TrueForDatelessEditionInCurrentYear()
    {
        var ev = CreateTestEvent("Dateless Edition");
        ev.Slug = "dateless-edition";
        ev.ScheduleRule = null;
        var edition = new EventEdition
        {
            Id = Guid.NewGuid(),
            EventId = ev.Id,
            Year = DateOnly.FromDateTime(DateTime.UtcNow).Year,
            Date = null,   // no date set yet
            EndDate = null,
            RegistrationStatus = RegistrationStatus.NotStarted,
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

        var dto = Assert.Single(result);
        Assert.True(dto.HasFutureEdition);
    }

    [Fact]
    public async Task GetEvents_HasFutureEdition_FalseForDatelessEditionInPastYear()
    {
        var ev = CreateTestEvent("Old Dateless");
        ev.Slug = "old-dateless";
        ev.ScheduleRule = null;
        var edition = new EventEdition
        {
            Id = Guid.NewGuid(),
            EventId = ev.Id,
            Year = DateOnly.FromDateTime(DateTime.UtcNow).Year - 1,
            Date = null,
            EndDate = null,
            RegistrationStatus = RegistrationStatus.NotStarted,
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

        var dto = Assert.Single(result);
        Assert.False(dto.HasFutureEdition);
    }

    [Fact]
    public async Task CreateEdition_StoresEndDate()
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
            Year: 2026,
            Date: new DateOnly(2026, 8, 1),
            EndDate: new DateOnly(2026, 8, 3),
            Title: "2026 Edition",
            RegistrationUrl: null,
            ResultsUrl: null,
            Notes: null,
            RegistrationStatus: "Open",
            TrailId: null
        ), CancellationToken.None);

        using var verifyCtx = _factory.CreateContext();
        var edition = verifyCtx.EventEditions.Find(id);
        Assert.NotNull(edition);
        Assert.Equal(new DateOnly(2026, 8, 1), edition!.Date);
        Assert.Equal(new DateOnly(2026, 8, 3), edition.EndDate);
    }

    [Fact]
    public async Task UpdateEdition_StoresEndDate()
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
            await handler.Handle(new UpdateEditionCommand(
                Id: edition.Id,
                Year: 2026,
                Date: new DateOnly(2026, 8, 1),
                EndDate: new DateOnly(2026, 8, 3),
                Title: "2026 Multi-Day",
                RegistrationUrl: null,
                ResultsUrl: null,
                Notes: null,
                RegistrationStatus: "Open",
                TrailId: null
            ), CancellationToken.None);
        }

        using var verifyCtx = _factory.CreateContext();
        var updated = verifyCtx.EventEditions.Find(edition.Id);
        Assert.Equal(new DateOnly(2026, 8, 3), updated!.EndDate);
    }

    [Fact]
    public async Task UpdateEdition_ClearsEndDate_WhenSetToNull()
    {
        var ev = CreateTestEvent();
        var edition = CreateTestEdition(ev.Id);
        edition.EndDate = new DateOnly(2025, 7, 14);
        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new UpdateEditionCommandHandler(ctx, _cacheInvalidator);
            await handler.Handle(new UpdateEditionCommand(
                Id: edition.Id,
                Year: 2025,
                Date: new DateOnly(2025, 7, 12),
                EndDate: null,
                Title: "2025 Edition",
                RegistrationUrl: null,
                ResultsUrl: null,
                Notes: null,
                RegistrationStatus: "Open",
                TrailId: null
            ), CancellationToken.None);
        }

        using var verifyCtx = _factory.CreateContext();
        var updated = verifyCtx.EventEditions.Find(edition.Id);
        Assert.Null(updated!.EndDate);
    }

    [Fact]
    public async Task GetEventCalendar_MultiDay_AppearsOnEachDay()
    {
        var ev = CreateTestEvent("3-Day Festival");
        ev.Slug = "3-day-festival";
        var edition = new EventEdition
        {
            Id = Guid.NewGuid(),
            EventId = ev.Id,
            Year = 2025,
            Date = new DateOnly(2025, 8, 1),
            EndDate = new DateOnly(2025, 8, 3),
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
            new GetEventCalendarQuery(new DateOnly(2025, 8, 1), new DateOnly(2025, 8, 31)),
            CancellationToken.None);

        Assert.Equal(3, result.Count);
        Assert.Contains(result, d => d.Date == new DateOnly(2025, 8, 1));
        Assert.Contains(result, d => d.Date == new DateOnly(2025, 8, 2));
        Assert.Contains(result, d => d.Date == new DateOnly(2025, 8, 3));
        Assert.All(result, d => Assert.Single(d.Events));
    }

    [Fact]
    public async Task GetEventCalendar_MultiDay_ClipsToRequestRange()
    {
        var ev = CreateTestEvent("Cross-Month Race");
        ev.Slug = "cross-month-race";
        var edition = new EventEdition
        {
            Id = Guid.NewGuid(),
            EventId = ev.Id,
            Year = 2025,
            Date = new DateOnly(2025, 7, 30),
            EndDate = new DateOnly(2025, 8, 2),
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

        // Query only August — should see Aug 1 and Aug 2, not Jul 30/31
        var result = await handler.Handle(
            new GetEventCalendarQuery(new DateOnly(2025, 8, 1), new DateOnly(2025, 8, 31)),
            CancellationToken.None);

        Assert.Equal(2, result.Count);
        Assert.Contains(result, d => d.Date == new DateOnly(2025, 8, 1));
        Assert.Contains(result, d => d.Date == new DateOnly(2025, 8, 2));
        Assert.DoesNotContain(result, d => d.Date.Month == 7);
    }

    [Fact]
    public async Task GetEvent_OngoingMultiDay_ReturnsDaysUntilZero()
    {
        var ev = CreateTestEvent("Ongoing Multi Day");
        ev.Slug = "ongoing-multi-day";
        ev.ScheduleRule = null;
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var edition = new EventEdition
        {
            Id = Guid.NewGuid(),
            EventId = ev.Id,
            Year = today.Year,
            Date = today.AddDays(-1),
            EndDate = today.AddDays(1),
            RegistrationStatus = RegistrationStatus.Closed,
        };

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEventQueryHandler(queryCtx, _scheduleEngine);
        var result = await handler.Handle(new GetEventQuery("ongoing-multi-day"), CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(0, result!.DaysUntil);
        Assert.Equal(edition.Date, result.DisplayDate);
    }

    [Fact]
    public async Task GetEvent_MultiDay_RecentlyCompleted_UsesDaysSinceEndDate()
    {
        var ev = CreateTestEvent("Finished Multi Day");
        ev.Slug = "finished-multi-day";
        ev.ScheduleRule = null;
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var edition = new EventEdition
        {
            Id = Guid.NewGuid(),
            EventId = ev.Id,
            Year = today.Year,
            Date = today.AddDays(-3),
            EndDate = today.AddDays(-1),
            RegistrationStatus = RegistrationStatus.Closed,
        };

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEventQueryHandler(queryCtx, _scheduleEngine);
        var result = await handler.Handle(new GetEventQuery("finished-multi-day"), CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(-1, result!.DaysUntil);
        Assert.Equal(edition.Date, result.DisplayDate);
    }

    // ─── ActivityTypes derived from races ───

    [Fact]
    public async Task GetEvents_ActivityTypes_DerivedFromRaceActivityType()
    {
        var ev = CreateTestEvent("Triathlon");
        ev.Slug = "triathlon";
        var edition = CreateTestEdition(ev.Id);
        var swimRace = new Race
        {
            Id = Guid.NewGuid(),
            EventEditionId = edition.Id,
            Name = "1km Swim",
            SortOrder = 0,
            ActivityType = ActivityType.Swim,
        };
        var runRace = new Race
        {
            Id = Guid.NewGuid(),
            EventEditionId = edition.Id,
            Name = "10km Run",
            SortOrder = 1,
            ActivityType = ActivityType.Running,
        };

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            ctx.Races.AddRange(swimRace, runRace);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEventsQueryHandler(queryCtx, _scheduleEngine);
        var result = await handler.Handle(new GetEventsQuery(IncludeHidden: true), CancellationToken.None);

        var dto = Assert.Single(result);
        Assert.NotNull(dto.ActivityTypes);
        Assert.Equal(2, dto.ActivityTypes!.Count);
        Assert.Contains("Running", dto.ActivityTypes);
        Assert.Contains("Swim", dto.ActivityTypes);
    }

    [Fact]
    public async Task GetEvents_ActivityTypes_ExcludesCancelledRaces()
    {
        var ev = CreateTestEvent("Mixed Event");
        ev.Slug = "mixed-event";
        var edition = CreateTestEdition(ev.Id);
        var activeRace = new Race
        {
            Id = Guid.NewGuid(),
            EventEditionId = edition.Id,
            Name = "Trail Run",
            SortOrder = 0,
            ActivityType = ActivityType.TrailRunning,
        };
        var cancelledRace = new Race
        {
            Id = Guid.NewGuid(),
            EventEditionId = edition.Id,
            Name = "Cancelled Swim",
            SortOrder = 1,
            ActivityType = ActivityType.Swim,
            Status = RaceStatus.Cancelled,
        };

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            ctx.Races.AddRange(activeRace, cancelledRace);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEventsQueryHandler(queryCtx, _scheduleEngine);
        var result = await handler.Handle(new GetEventsQuery(IncludeHidden: true), CancellationToken.None);

        var dto = Assert.Single(result);
        Assert.NotNull(dto.ActivityTypes);
        Assert.Single(dto.ActivityTypes!);
        Assert.Contains("TrailRunning", dto.ActivityTypes);
        Assert.DoesNotContain("Swim", dto.ActivityTypes);
    }

    [Fact]
    public async Task GetEvents_ActivityTypes_FallsBackToTrailActivityType()
    {
        var trail = CreateTestTrail();
        trail.ActivityTypeId = ActivityType.Cycling;
        var ev = CreateTestEvent("Cycling Event");
        ev.Slug = "cycling-event";
        var edition = CreateTestEdition(ev.Id);
        var race = new Race
        {
            Id = Guid.NewGuid(),
            EventEditionId = edition.Id,
            TrailId = trail.Id,
            Name = "Bike Race",
            SortOrder = 0,
            ActivityType = null,  // no explicit override — should fall back to trail
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
        var handler = new GetEventsQueryHandler(queryCtx, _scheduleEngine);
        var result = await handler.Handle(new GetEventsQuery(IncludeHidden: true), CancellationToken.None);

        var dto = Assert.Single(result);
        Assert.NotNull(dto.ActivityTypes);
        Assert.Single(dto.ActivityTypes!);
        Assert.Contains("Cycling", dto.ActivityTypes);
    }

    [Fact]
    public async Task GetEvents_ActivityTypes_Null_WhenNoRacesHaveType()
    {
        var ev = CreateTestEvent("No Type Event");
        ev.Slug = "no-type-event";
        var edition = CreateTestEdition(ev.Id);
        var race = new Race
        {
            Id = Guid.NewGuid(),
            EventEditionId = edition.Id,
            Name = "Mystery Race",
            SortOrder = 0,
            ActivityType = null,
            TrailId = null,
        };

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            ctx.Races.Add(race);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEventsQueryHandler(queryCtx, _scheduleEngine);
        var result = await handler.Handle(new GetEventsQuery(IncludeHidden: true), CancellationToken.None);

        var dto = Assert.Single(result);
        Assert.Null(dto.ActivityTypes);
    }

    [Fact]
    public async Task GetEvents_OngoingMultiDay_EndDisplayDate_IsSet()
    {
        var ev = CreateTestEvent("Ongoing With EndDate");
        ev.Slug = "ongoing-with-enddate";
        ev.ScheduleRule = null;
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var endDate = today.AddDays(2);
        var edition = new EventEdition
        {
            Id = Guid.NewGuid(),
            EventId = ev.Id,
            Year = today.Year,
            Date = today.AddDays(-1),
            EndDate = endDate,
            RegistrationStatus = RegistrationStatus.Closed,
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

        var dto = Assert.Single(result);
        Assert.Equal(0, dto.DaysUntil);
        Assert.Equal(endDate, dto.EndDisplayDate);
    }

    // ─── CancelEditionCommand ───

    [Fact]
    public async Task CancelEdition_CascadesToRacesAndClosesRegistration()
    {
        var ev = CreateTestEvent();
        var edition = CreateTestEdition(ev.Id);
        edition.RegistrationStatus = RegistrationStatus.Open;
        var race = new Race { Id = Guid.NewGuid(), EventEditionId = edition.Id, Name = "10K", SortOrder = 0, Status = RaceStatus.Active, TicketStatus = TicketStatus.Available };

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            ctx.Races.Add(race);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new CancelEditionCommandHandler(ctx, _cacheInvalidator);
            var result = await handler.Handle(new CancelEditionCommand(edition.Id), CancellationToken.None);
            Assert.True(result);
        }

        using (var ctx = _factory.CreateContext())
        {
            var updatedEdition = ctx.EventEditions.Find(edition.Id);
            var updatedRace = ctx.Races.Find(race.Id);
            Assert.Equal(EditionStatus.Cancelled, updatedEdition!.Status);
            Assert.Equal(RegistrationStatus.Closed, updatedEdition.RegistrationStatus);
            Assert.Equal(RaceStatus.Cancelled, updatedRace!.Status);
            Assert.Equal(TicketStatus.Closed, updatedRace.TicketStatus);
        }
    }

    [Fact]
    public async Task CancelEdition_NonExistentEdition_ReturnsFalse()
    {
        using var ctx = _factory.CreateContext();
        var handler = new CancelEditionCommandHandler(ctx, _cacheInvalidator);
        var result = await handler.Handle(new CancelEditionCommand(Guid.NewGuid()), CancellationToken.None);
        Assert.False(result);
    }

    [Fact]
    public async Task CancelEdition_LeavesAlreadyCancelledRaceUntouched()
    {
        var ev = CreateTestEvent();
        var edition = CreateTestEdition(ev.Id);
        var race = new Race { Id = Guid.NewGuid(), EventEditionId = edition.Id, Name = "10K", SortOrder = 0, Status = RaceStatus.Cancelled, TicketStatus = TicketStatus.NotStarted };

        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            ctx.Races.Add(race);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new CancelEditionCommandHandler(ctx, _cacheInvalidator);
            await handler.Handle(new CancelEditionCommand(edition.Id), CancellationToken.None);
        }

        using (var ctx = _factory.CreateContext())
        {
            var updatedRace = ctx.Races.Find(race.Id);
            Assert.Equal(TicketStatus.NotStarted, updatedRace!.TicketStatus);
        }
    }

    // ─── UpdateEditionCommand — Status field ───

    private UpdateEditionCommand BuildUpdateEditionCommand(EventEdition edition, string? status) => new(
        Id: edition.Id,
        Year: edition.Year,
        Date: edition.Date,
        EndDate: edition.EndDate,
        Title: edition.Title,
        RegistrationUrl: edition.RegistrationUrl,
        ResultsUrl: edition.ResultsUrl,
        Notes: edition.Notes,
        RegistrationStatus: edition.RegistrationStatus.ToString(),
        TrailId: edition.TrailId,
        Status: status
    );

    [Fact]
    public async Task UpdateEdition_OmittingStatus_LeavesStatusUnchanged()
    {
        var ev = CreateTestEvent();
        var edition = CreateTestEdition(ev.Id);
        edition.Status = EditionStatus.Hidden;
        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new UpdateEditionCommandHandler(ctx, _cacheInvalidator);
            await handler.Handle(BuildUpdateEditionCommand(edition, status: null), CancellationToken.None);
        }

        using var verifyCtx = _factory.CreateContext();
        Assert.Equal(EditionStatus.Hidden, verifyCtx.EventEditions.Find(edition.Id)!.Status);
    }

    [Fact]
    public async Task UpdateEdition_SettingStatusToCancelled_CascadesToRaces()
    {
        var ev = CreateTestEvent();
        var edition = CreateTestEdition(ev.Id);
        edition.RegistrationStatus = RegistrationStatus.Open;
        var race = new Race { Id = Guid.NewGuid(), EventEditionId = edition.Id, Name = "10K", SortOrder = 0, Status = RaceStatus.Active, TicketStatus = TicketStatus.Available };
        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            ctx.Races.Add(race);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new UpdateEditionCommandHandler(ctx, _cacheInvalidator);
            await handler.Handle(BuildUpdateEditionCommand(edition, status: "Cancelled"), CancellationToken.None);
        }

        using var verifyCtx = _factory.CreateContext();
        Assert.Equal(EditionStatus.Cancelled, verifyCtx.EventEditions.Find(edition.Id)!.Status);
        Assert.Equal(RegistrationStatus.Closed, verifyCtx.EventEditions.Find(edition.Id)!.RegistrationStatus);
        Assert.Equal(RaceStatus.Cancelled, verifyCtx.Races.Find(race.Id)!.Status);
    }

    [Fact]
    public async Task UpdateEdition_SettingStatusToHidden_DoesNotCascadeRaces()
    {
        var ev = CreateTestEvent();
        var edition = CreateTestEdition(ev.Id);
        var race = new Race { Id = Guid.NewGuid(), EventEditionId = edition.Id, Name = "10K", SortOrder = 0, Status = RaceStatus.Active, TicketStatus = TicketStatus.Available };
        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            ctx.Races.Add(race);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new UpdateEditionCommandHandler(ctx, _cacheInvalidator);
            await handler.Handle(BuildUpdateEditionCommand(edition, status: "Hidden"), CancellationToken.None);
        }

        using var verifyCtx = _factory.CreateContext();
        Assert.Equal(EditionStatus.Hidden, verifyCtx.EventEditions.Find(edition.Id)!.Status);
        Assert.Equal(RaceStatus.Active, verifyCtx.Races.Find(race.Id)!.Status);
    }

    [Fact]
    public async Task UpdateEdition_ReactivatingCancelled_DoesNotReactivateRaces()
    {
        var ev = CreateTestEvent();
        var edition = CreateTestEdition(ev.Id);
        edition.Status = EditionStatus.Cancelled;
        edition.RegistrationStatus = RegistrationStatus.Closed;
        var race = new Race { Id = Guid.NewGuid(), EventEditionId = edition.Id, Name = "10K", SortOrder = 0, Status = RaceStatus.Cancelled, TicketStatus = TicketStatus.Closed };
        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            ctx.Races.Add(race);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new UpdateEditionCommandHandler(ctx, _cacheInvalidator);
            await handler.Handle(BuildUpdateEditionCommand(edition, status: "Active"), CancellationToken.None);
        }

        using var verifyCtx = _factory.CreateContext();
        Assert.Equal(EditionStatus.Active, verifyCtx.EventEditions.Find(edition.Id)!.Status);
        Assert.Equal(RaceStatus.Cancelled, verifyCtx.Races.Find(race.Id)!.Status);
    }

    // ─── UpdateRaceCommand — TicketStatus forced on Cancelled ───

    [Fact]
    public async Task UpdateRace_SettingStatusToCancelled_ForcesTicketStatusClosed()
    {
        var ev = CreateTestEvent();
        var edition = CreateTestEdition(ev.Id);
        var race = new Race { Id = Guid.NewGuid(), EventEditionId = edition.Id, Name = "10K", SortOrder = 0, Status = RaceStatus.Active, TicketStatus = TicketStatus.Available };
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
            await handler.Handle(new UpdateRaceCommand(
                Id: race.Id, TrailId: null, Name: race.Name, DistanceLabel: null, CutoffMinutes: null,
                Description: null, Status: "Cancelled", SortOrder: 0, TicketStatus: "SoldOut", ResultType: "Time",
                MaxParticipants: null, ItraPoints: null, CertifiedBy: null, PrizeMoney: 0,
                ChampionshipCategory: null, DateOfRace: null, StartTime: null
            ), CancellationToken.None);
        }

        using var verifyCtx = _factory.CreateContext();
        var updated = verifyCtx.Races.Find(race.Id);
        Assert.Equal(RaceStatus.Cancelled, updated!.Status);
        Assert.Equal(TicketStatus.Closed, updated.TicketStatus);
    }

    [Fact]
    public async Task UpdateRace_NonCancelledStatus_RespectsSubmittedTicketStatus()
    {
        var ev = CreateTestEvent();
        var edition = CreateTestEdition(ev.Id);
        var race = new Race { Id = Guid.NewGuid(), EventEditionId = edition.Id, Name = "10K", SortOrder = 0, Status = RaceStatus.Active, TicketStatus = TicketStatus.Available };
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
            await handler.Handle(new UpdateRaceCommand(
                Id: race.Id, TrailId: null, Name: race.Name, DistanceLabel: null, CutoffMinutes: null,
                Description: null, Status: "Active", SortOrder: 0, TicketStatus: "SoldOut", ResultType: "Time",
                MaxParticipants: null, ItraPoints: null, CertifiedBy: null, PrizeMoney: 0,
                ChampionshipCategory: null, DateOfRace: null, StartTime: null
            ), CancellationToken.None);
        }

        using var verifyCtx = _factory.CreateContext();
        Assert.Equal(TicketStatus.SoldOut, verifyCtx.Races.Find(race.Id)!.TicketStatus);
    }

    // ─── GetEventsQuery / GetEventQuery — Hidden edition exclusion + rollup fields ───

    [Fact]
    public async Task GetEvents_ExcludesHiddenEdition_WhenNotIncludeHidden()
    {
        var ev = CreateTestEvent("Public Event");
        ev.Slug = "public-event-heh";
        var edition = CreateTestEdition(ev.Id);
        edition.Status = EditionStatus.Hidden;
        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEventsQueryHandler(queryCtx, _scheduleEngine);
        var result = await handler.Handle(new GetEventsQuery(IncludeHidden: false), CancellationToken.None);

        var dto = Assert.Single(result);
        Assert.Null(dto.EditionStatus);
        Assert.False(dto.EditionEffectiveCancelled);
        Assert.Equal(0, dto.EditionCount);
    }

    [Fact]
    public async Task GetEvents_IncludesHiddenEdition_WhenIncludeHiddenTrue()
    {
        var ev = CreateTestEvent("Admin Event");
        ev.Slug = "admin-event-heh";
        var edition = CreateTestEdition(ev.Id);
        edition.Date = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(30);
        edition.Status = EditionStatus.Hidden;
        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEventsQueryHandler(queryCtx, _scheduleEngine);
        var result = await handler.Handle(new GetEventsQuery(IncludeHidden: true), CancellationToken.None);

        var dto = Assert.Single(result);
        Assert.Equal("Hidden", dto.EditionStatus);
        Assert.Equal(1, dto.EditionCount);
    }

    [Fact]
    public async Task GetEvents_EditionEffectiveCancelled_TrueWhenAllRacesCancelled()
    {
        var ev = CreateTestEvent("Attrition Event");
        ev.Slug = "attrition-event";
        var edition = CreateTestEdition(ev.Id);
        edition.Date = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(30);
        var race = new Race { Id = Guid.NewGuid(), EventEditionId = edition.Id, Name = "10K", SortOrder = 0, Status = RaceStatus.Cancelled, TicketStatus = TicketStatus.Closed };
        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            ctx.Races.Add(race);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEventsQueryHandler(queryCtx, _scheduleEngine);
        var result = await handler.Handle(new GetEventsQuery(), CancellationToken.None);

        var dto = Assert.Single(result);
        Assert.Equal("Active", dto.EditionStatus);
        Assert.True(dto.EditionEffectiveCancelled);
    }

    [Fact]
    public async Task GetEvent_BySlug_ExcludesHiddenEdition_FromEditionsList_WhenNotIncludeHidden()
    {
        var ev = CreateTestEvent("Multi Edition Event");
        ev.Slug = "multi-edition-event";
        var visibleEdition = CreateTestEdition(ev.Id, 2025);
        var hiddenEdition = CreateTestEdition(ev.Id, 2026);
        hiddenEdition.Id = Guid.NewGuid();
        hiddenEdition.Status = EditionStatus.Hidden;
        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.AddRange(visibleEdition, hiddenEdition);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEventQueryHandler(queryCtx, _scheduleEngine);
        var result = await handler.Handle(new GetEventQuery("multi-edition-event"), CancellationToken.None);

        var edition = Assert.Single(result!.Editions);
        Assert.Equal(visibleEdition.Id, edition.Id);
    }

    [Fact]
    public async Task GetEvent_BySlug_IncludesHiddenEdition_WhenIncludeHiddenTrue()
    {
        var ev = CreateTestEvent("Admin Multi Edition Event");
        ev.Slug = "admin-multi-edition-event";
        var visibleEdition = CreateTestEdition(ev.Id, 2025);
        var hiddenEdition = CreateTestEdition(ev.Id, 2026);
        hiddenEdition.Id = Guid.NewGuid();
        hiddenEdition.Status = EditionStatus.Hidden;
        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.AddRange(visibleEdition, hiddenEdition);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEventQueryHandler(queryCtx, _scheduleEngine);
        var result = await handler.Handle(new GetEventQuery("admin-multi-edition-event", IncludeHidden: true), CancellationToken.None);

        Assert.Equal(2, result!.Editions.Count);
    }

    [Fact]
    public async Task GetEvent_BySlug_TopLevelEditionStatus_ReflectsRelevantEdition()
    {
        // Regression test: the flattened EditionStatus/EditionEffectiveCancelled fields on
        // EventDetailDto must be populated — this was previously only wired up on the list
        // endpoint (GetEventsQuery), leaving the single-event admin edit page unable to see them.
        var ev = CreateTestEvent("Cancelled Detail Event");
        ev.Slug = "cancelled-detail-event";
        var edition = CreateTestEdition(ev.Id);
        edition.Date = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(30);
        edition.Status = EditionStatus.Cancelled;
        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEventQueryHandler(queryCtx, _scheduleEngine);
        var result = await handler.Handle(new GetEventQuery("cancelled-detail-event"), CancellationToken.None);

        Assert.Equal("Cancelled", result!.EditionStatus);
        Assert.True(result.EditionEffectiveCancelled);
    }

    [Fact]
    public async Task GetEvent_BySlug_EditionDto_EffectiveCancelled_TrueWhenAllRacesCancelled()
    {
        var ev = CreateTestEvent("Race Attrition Detail Event");
        ev.Slug = "race-attrition-detail-event";
        var edition = CreateTestEdition(ev.Id);
        var race = new Race { Id = Guid.NewGuid(), EventEditionId = edition.Id, Name = "10K", SortOrder = 0, Status = RaceStatus.Cancelled, TicketStatus = TicketStatus.Closed };
        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            ctx.Races.Add(race);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEventQueryHandler(queryCtx, _scheduleEngine);
        var result = await handler.Handle(new GetEventQuery("race-attrition-detail-event"), CancellationToken.None);

        var editionDto = Assert.Single(result!.Editions);
        Assert.Equal("Active", editionDto.Status);
        Assert.True(editionDto.EffectiveCancelled);
    }

    [Fact]
    public async Task GetEvent_BySlug_RaceDto_ResultType_SurfacesFromEntity()
    {
        var ev = CreateTestEvent("Backyard Ultra Detail Event");
        ev.Slug = "backyard-ultra-detail-event";
        var edition = CreateTestEdition(ev.Id);
        var race = new Race { Id = Guid.NewGuid(), EventEditionId = edition.Id, Name = "Backyard Ultra", SortOrder = 0, ResultType = ResultType.Laps };
        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            ctx.Races.Add(race);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetEventQueryHandler(queryCtx, _scheduleEngine);
        var result = await handler.Handle(new GetEventQuery("backyard-ultra-detail-event"), CancellationToken.None);

        var raceDto = Assert.Single(Assert.Single(result!.Editions).Races);
        Assert.Equal("Laps", raceDto.ResultType);
    }

    [Fact]
    public async Task GetAllEventDetails_RaceDto_ResultType_SurfacesFromEntity()
    {
        var ev = CreateTestEvent("Distance Race Admin Detail Event");
        ev.Slug = "distance-race-admin-detail-event";
        var edition = CreateTestEdition(ev.Id);
        var race = new Race { Id = Guid.NewGuid(), EventEditionId = edition.Id, Name = "24 Hour Run", SortOrder = 0, ResultType = ResultType.Distance };
        using (var ctx = _factory.CreateContext())
        {
            ctx.Events.Add(ev);
            ctx.EventEditions.Add(edition);
            ctx.Races.Add(race);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetAllEventDetailsQueryHandler(queryCtx);
        var result = await handler.Handle(new GetAllEventDetailsQuery(), CancellationToken.None);

        var eventDetail = Assert.Single(result);
        var raceDto = Assert.Single(Assert.Single(eventDetail.Editions).Races);
        Assert.Equal("Distance", raceDto.ResultType);
    }

    // ─── Race trail links vs trail visibility ───
    //
    // Archiving or hiding a trail does not unlink the races that use it, but the public trail
    // page only serves Published/EventOnly. Handing out the slug anyway would render a
    // "View trail" link that 404s, so the public projection must withhold it.

    private async Task<RaceDto> GetRaceDtoForTrail(TrailStatus trailStatus, string slug, bool includeHidden = false)
    {
        var trail = new Trail
        {
            Id = Guid.NewGuid(),
            Name = "Linked Trail",
            Slug = $"linked-trail-{Guid.NewGuid():N}",
            Length = 21000,
            ElevationGain = 500,
            ElevationLoss = 500,
            ActivityTypeId = ActivityType.TrailRunning,
            Status = trailStatus,
            Type = TrailType.PointToPoint,
            Difficulty = Difficulty.Hard,
            Visibility = Visibility.Public,
        };
        var ev = CreateTestEvent($"Trail Link Event {slug}");
        ev.Slug = slug;
        var edition = CreateTestEdition(ev.Id);
        var race = new Race
        {
            Id = Guid.NewGuid(),
            EventEditionId = edition.Id,
            TrailId = trail.Id,
            Name = "Linked Race",
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
        var result = await handler.Handle(new GetEventQuery(slug, IncludeHidden: includeHidden), CancellationToken.None);
        return Assert.Single(Assert.Single(result!.Editions).Races);
    }

    [Theory]
    [InlineData(TrailStatus.Published)]
    [InlineData(TrailStatus.EventOnly)]
    public async Task GetEvent_BySlug_RaceDto_ExposesTrailSlug_WhenTrailIsPubliclyVisible(TrailStatus status)
    {
        var raceDto = await GetRaceDtoForTrail(status, $"trail-link-visible-{status}".ToLowerInvariant());
        Assert.NotNull(raceDto.TrailSlug);
    }

    [Theory]
    [InlineData(TrailStatus.Draft)]
    [InlineData(TrailStatus.Archived)]
    [InlineData(TrailStatus.Flagged)]
    public async Task GetEvent_BySlug_RaceDto_WithholdsTrailSlug_WhenTrailIsNotPubliclyVisible(TrailStatus status)
    {
        var raceDto = await GetRaceDtoForTrail(status, $"trail-link-hidden-{status}".ToLowerInvariant());
        Assert.Null(raceDto.TrailSlug);
    }

    [Fact]
    public async Task GetEvent_BySlug_RaceDto_KeepsTrailNameAndDistance_WhenTrailIsArchived()
    {
        // Only the link is withheld — the race's own descriptive data stays accurate.
        var raceDto = await GetRaceDtoForTrail(TrailStatus.Archived, "trail-link-archived-keeps-data");
        Assert.Null(raceDto.TrailSlug);
        Assert.Equal("Linked Trail", raceDto.TrailName);
        Assert.Equal(21000, raceDto.TrailDistanceMeters);
    }

    [Fact]
    public async Task GetEvent_BySlug_RaceDto_ExposesTrailSlug_ForAdmin_EvenWhenArchived()
    {
        // Admin (IncludeHidden) still needs the link to navigate to the trail.
        var raceDto = await GetRaceDtoForTrail(TrailStatus.Archived, "trail-link-archived-admin", includeHidden: true);
        Assert.NotNull(raceDto.TrailSlug);
    }

    [Fact]
    public async Task GetEvent_BySlug_EditionDto_Year_FallsBackToDateYear_WhenYearFieldIsNull()
    {
        // Regression: admins can set Date without filling in the separate Year field. The
        // /events/:slug/history/:year route matches editions by this Year, so it must never be
        // null when a Date is present — this previously caused "Edition not found" for such editions.
        var ev = CreateTestEvent("No Explicit Year Detail Event");
        ev.Slug = "no-explicit-year-detail-event";
        var edition = new EventEdition
        {
            Id = Guid.NewGuid(),
            EventId = ev.Id,
            Date = new DateOnly(2025, 6, 1),
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
        var handler = new GetEventQueryHandler(queryCtx, _scheduleEngine);
        var result = await handler.Handle(new GetEventQuery("no-explicit-year-detail-event"), CancellationToken.None);

        var editionDto = Assert.Single(result!.Editions);
        Assert.Equal(2025, editionDto.Year);
    }
}
