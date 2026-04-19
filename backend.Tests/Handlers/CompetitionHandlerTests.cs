using Moq;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Application.Competitions.Commands.CreateCompetition;
using Utanvega.Backend.Application.Competitions.Commands.UpdateCompetition;
using Utanvega.Backend.Application.Competitions.Commands.DeleteCompetition;
using Utanvega.Backend.Application.Competitions.Commands.CreateRace;
using Utanvega.Backend.Application.Competitions.Commands.UpdateRace;
using Utanvega.Backend.Application.Competitions.Commands.DeleteRace;
using Utanvega.Backend.Application.Competitions.Queries.GetCompetitions;
using Utanvega.Backend.Application.Competitions.Queries.GetCompetition;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Core.Services;

namespace Utanvega.Backend.Tests.Handlers;

public class CompetitionHandlerTests : IDisposable
{
    private readonly TestDbContextFactory _factory;
    private readonly IScheduleRuleEngine _scheduleEngine = new ScheduleRuleEngine();
    private readonly ICacheInvalidator _cacheInvalidator = new Mock<ICacheInvalidator>().Object;

    public CompetitionHandlerTests()
    {
        _factory = new TestDbContextFactory();
    }

    public void Dispose() => _factory.Dispose();

    private Competition CreateTestCompetition(string name = "Test Competition")
    {
        return new Competition
        {
            Id = Guid.NewGuid(),
            Name = name,
            Slug = name.ToLower().Replace(" ", "-"),
            Status = CompetitionStatus.Active,
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

    // ─── CreateCompetitionCommand ───

    [Fact]
    public async Task Create_Competition_Succeeds()
    {
        using var ctx = _factory.CreateContext();
        var handler = new CreateCompetitionCommandHandler(ctx, _cacheInvalidator);

        var id = await handler.Handle(new CreateCompetitionCommand(
            Name: "Laugavegur Ultra",
            Slug: "laugavegur-ultra",
            Description: "55K ultra through the highlands",
            OrganizerName: "ÍSÍ",
            OrganizerWebsite: "https://marathon.is",
            RegistrationUrl: "https://marathon.is/register",
            AlertMessage: null,
            AlertSeverity: null,
            LocationId: null,
            Status: "Active",
            ScheduleRule: new ScheduleRule { Type = ScheduleType.Yearly, Month = 7, WeekOfMonth = 2, DayOfWeek = DayOfWeek.Saturday }
        ), CancellationToken.None);

        Assert.NotEqual(Guid.Empty, id);

        using var verifyCtx = _factory.CreateContext();
        var comp = verifyCtx.Competitions.Find(id);
        Assert.NotNull(comp);
        Assert.Equal("Laugavegur Ultra", comp!.Name);
        Assert.Equal("laugavegur-ultra", comp.Slug);
        Assert.Equal(CompetitionStatus.Active, comp.Status);
    }

    [Fact]
    public async Task Create_Competition_GeneratesSlug_WhenNotProvided()
    {
        using var ctx = _factory.CreateContext();
        var handler = new CreateCompetitionCommandHandler(ctx, _cacheInvalidator);

        var id = await handler.Handle(new CreateCompetitionCommand(
            Name: "Reykjavík Marathon",
            Slug: null,
            Description: null,
            OrganizerName: null,
            OrganizerWebsite: null,
            RegistrationUrl: null,
            AlertMessage: null,
            AlertSeverity: null,
            LocationId: null,
            Status: "Active",
            ScheduleRule: null
        ), CancellationToken.None);

        using var verifyCtx = _factory.CreateContext();
        var comp = verifyCtx.Competitions.Find(id);
        Assert.NotNull(comp);
        Assert.NotEmpty(comp!.Slug);
        Assert.DoesNotContain(" ", comp.Slug);
    }

    // ─── UpdateCompetitionCommand ───

    [Fact]
    public async Task Update_ExistingCompetition_Succeeds()
    {
        var competition = CreateTestCompetition();
        using (var ctx = _factory.CreateContext())
        {
            ctx.Competitions.Add(competition);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new UpdateCompetitionCommandHandler(ctx, _cacheInvalidator);
            var result = await handler.Handle(new UpdateCompetitionCommand(
                Id: competition.Id,
                Name: "Updated Name",
                Description: "Updated desc",
                OrganizerName: "New Org",
                OrganizerWebsite: "https://new.is",
                RegistrationUrl: null,
                AlertMessage: null,
                AlertSeverity: null,
                LocationId: null,
                Status: "Cancelled",
                ScheduleRule: null
            ), CancellationToken.None);

            Assert.True(result);
        }

        using (var ctx = _factory.CreateContext())
        {
            var comp = ctx.Competitions.Find(competition.Id);
            Assert.Equal("Updated Name", comp!.Name);
            Assert.Equal(CompetitionStatus.Cancelled, comp.Status);
            Assert.NotNull(comp.UpdatedAt);
        }
    }

    [Fact]
    public async Task Update_NonExistentCompetition_ReturnsFalse()
    {
        using var ctx = _factory.CreateContext();
        var handler = new UpdateCompetitionCommandHandler(ctx, _cacheInvalidator);
        var result = await handler.Handle(new UpdateCompetitionCommand(
            Id: Guid.NewGuid(),
            Name: "Nothing",
            Description: null,
            OrganizerName: null,
            OrganizerWebsite: null,
            RegistrationUrl: null,
            AlertMessage: null,
            AlertSeverity: null,
            LocationId: null,
            Status: "Active",
            ScheduleRule: null
        ), CancellationToken.None);

        Assert.False(result);
    }

    // ─── DeleteCompetitionCommand ───

    [Fact]
    public async Task Delete_ExistingCompetition_Succeeds()
    {
        var competition = CreateTestCompetition();
        using (var ctx = _factory.CreateContext())
        {
            ctx.Competitions.Add(competition);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new DeleteCompetitionCommandHandler(ctx, _cacheInvalidator);
            var result = await handler.Handle(
                new DeleteCompetitionCommand(competition.Id), CancellationToken.None);
            Assert.True(result);
        }

        using (var ctx = _factory.CreateContext())
        {
            Assert.Null(ctx.Competitions.Find(competition.Id));
        }
    }

    [Fact]
    public async Task Delete_NonExistentCompetition_ReturnsFalse()
    {
        using var ctx = _factory.CreateContext();
        var handler = new DeleteCompetitionCommandHandler(ctx, _cacheInvalidator);
        var result = await handler.Handle(
            new DeleteCompetitionCommand(Guid.NewGuid()), CancellationToken.None);
        Assert.False(result);
    }

    [Fact]
    public async Task Delete_Competition_CascadesDeleteToRaces()
    {
        var competition = CreateTestCompetition();
        var race = new Race
        {
            Id = Guid.NewGuid(),
            CompetitionId = competition.Id,
            Name = "55K Ultra",
            DistanceLabel = "55 km",
            SortOrder = 0,
        };

        using (var ctx = _factory.CreateContext())
        {
            ctx.Competitions.Add(competition);
            ctx.Races.Add(race);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new DeleteCompetitionCommandHandler(ctx, _cacheInvalidator);
            await handler.Handle(new DeleteCompetitionCommand(competition.Id), CancellationToken.None);
        }

        using (var ctx = _factory.CreateContext())
        {
            Assert.Null(ctx.Races.Find(race.Id));
        }
    }

    // ─── CreateRaceCommand ───

    [Fact]
    public async Task Create_Race_Succeeds()
    {
        var competition = CreateTestCompetition();
        using (var ctx = _factory.CreateContext())
        {
            ctx.Competitions.Add(competition);
            await ctx.SaveChangesAsync();
        }

        using var raceCtx = _factory.CreateContext();
        var handler = new CreateRaceCommandHandler(raceCtx, _cacheInvalidator);
        var id = await handler.Handle(new CreateRaceCommand(
            CompetitionId: competition.Id,
            TrailId: null,
            Name: "55K Ultra",
            DistanceLabel: "55 km",
            CutoffMinutes: 720,
            Description: "The main event",
            Status: "Active",
            SortOrder: 0
        ), CancellationToken.None);

        Assert.NotEqual(Guid.Empty, id);

        using var verifyCtx = _factory.CreateContext();
        var race = verifyCtx.Races.Find(id);
        Assert.NotNull(race);
        Assert.Equal("55K Ultra", race!.Name);
        Assert.Equal(720, race.CutoffMinutes);
    }

    // ─── UpdateRaceCommand ───

    [Fact]
    public async Task Update_ExistingRace_Succeeds()
    {
        var competition = CreateTestCompetition();
        var race = new Race
        {
            Id = Guid.NewGuid(),
            CompetitionId = competition.Id,
            Name = "10K Fun Run",
            SortOrder = 1,
        };

        using (var ctx = _factory.CreateContext())
        {
            ctx.Competitions.Add(competition);
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
                SortOrder: 2
            ), CancellationToken.None);

            Assert.True(result);
        }

        using (var ctx = _factory.CreateContext())
        {
            var updated = ctx.Races.Find(race.Id);
            Assert.Equal("10K Competitive", updated!.Name);
            Assert.Equal(120, updated.CutoffMinutes);
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
            SortOrder: 0
        ), CancellationToken.None);

        Assert.False(result);
    }

    // ─── DeleteRaceCommand ───

    [Fact]
    public async Task Delete_ExistingRace_Succeeds()
    {
        var competition = CreateTestCompetition();
        var race = new Race
        {
            Id = Guid.NewGuid(),
            CompetitionId = competition.Id,
            Name = "Half Marathon",
            SortOrder = 0,
        };

        using (var ctx = _factory.CreateContext())
        {
            ctx.Competitions.Add(competition);
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

    // ─── GetCompetitionsQuery ───

    [Fact]
    public async Task GetCompetitions_ReturnsAllActive()
    {
        var active = CreateTestCompetition("Active Comp");
        var hidden = CreateTestCompetition("Hidden Comp");
        hidden.Status = CompetitionStatus.Hidden;

        using (var ctx = _factory.CreateContext())
        {
            ctx.Competitions.AddRange(active, hidden);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetCompetitionsQueryHandler(queryCtx, _scheduleEngine);
        var result = await handler.Handle(new GetCompetitionsQuery(IncludeHidden: false), CancellationToken.None);

        Assert.Single(result);
        Assert.Equal("Active Comp", result[0].Name);
    }

    [Fact]
    public async Task GetCompetitions_IncludesHidden_WhenRequested()
    {
        var active = CreateTestCompetition("Active Comp");
        var hidden = CreateTestCompetition("Hidden Comp");
        hidden.Slug = "hidden-comp";
        hidden.Status = CompetitionStatus.Hidden;

        using (var ctx = _factory.CreateContext())
        {
            ctx.Competitions.AddRange(active, hidden);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetCompetitionsQueryHandler(queryCtx, _scheduleEngine);
        var result = await handler.Handle(new GetCompetitionsQuery(IncludeHidden: true), CancellationToken.None);

        Assert.Equal(2, result.Count);
    }

    [Fact]
    public async Task GetCompetitions_ComputesNextDate()
    {
        var comp = CreateTestCompetition();
        comp.ScheduleRule = new ScheduleRule
        {
            Type = ScheduleType.Yearly,
            Month = 7,
            WeekOfMonth = 2,
            DayOfWeek = DayOfWeek.Saturday,
        };

        using (var ctx = _factory.CreateContext())
        {
            ctx.Competitions.Add(comp);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetCompetitionsQueryHandler(queryCtx, _scheduleEngine);
        var result = await handler.Handle(new GetCompetitionsQuery(), CancellationToken.None);

        Assert.Single(result);
        Assert.NotNull(result[0].NextDate);
        Assert.NotNull(result[0].DaysUntil);
    }

    // ─── GetCompetitionQuery (by slug) ───

    [Fact]
    public async Task GetCompetition_BySlug_ReturnsWithRaces()
    {
        var competition = CreateTestCompetition("Laugavegur Ultra");
        competition.Slug = "laugavegur-ultra";

        var trail = CreateTestTrail();
        var race = new Race
        {
            Id = Guid.NewGuid(),
            CompetitionId = competition.Id,
            TrailId = trail.Id,
            Name = "55K Ultra",
            DistanceLabel = "55 km",
            SortOrder = 0,
        };

        using (var ctx = _factory.CreateContext())
        {
            ctx.Trails.Add(trail);
            ctx.Competitions.Add(competition);
            ctx.Races.Add(race);
            await ctx.SaveChangesAsync();
        }

        using var queryCtx = _factory.CreateContext();
        var handler = new GetCompetitionQueryHandler(queryCtx, _scheduleEngine);
        var result = await handler.Handle(
            new GetCompetitionQuery("laugavegur-ultra"), CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal("Laugavegur Ultra", result!.Name);
        Assert.Single(result.Races);
        Assert.Equal("55K Ultra", result.Races[0].Name);
        Assert.Equal(trail.Name, result.Races[0].TrailName);
    }

    [Fact]
    public async Task GetCompetition_NonExistentSlug_ReturnsNull()
    {
        using var ctx = _factory.CreateContext();
        var handler = new GetCompetitionQueryHandler(ctx, _scheduleEngine);
        var result = await handler.Handle(
            new GetCompetitionQuery("does-not-exist"), CancellationToken.None);
        Assert.Null(result);
    }
}
