using NetTopologySuite.Geometries;
using Utanvega.Backend.Application.Trails.Commands.BackfillElevationProfiles;
using Utanvega.Backend.Core.Entities;

namespace Utanvega.Backend.Tests.Handlers;

public class BackfillElevationProfilesCommandHandlerTests : IDisposable
{
    private static readonly GeometryFactory Factory = new(new PrecisionModel(), 4326);

    private readonly TestDbContextFactory _factory;

    public BackfillElevationProfilesCommandHandlerTests()
    {
        _factory = new TestDbContextFactory();
    }

    public void Dispose() => _factory.Dispose();

    private static Trail CreateTestTrail(string name, Geometry? gpxData)
    {
        return new Trail
        {
            Id = Guid.NewGuid(),
            Name = name,
            Slug = name.ToLower().Replace(" ", "-"),
            Length = 5000,
            ActivityTypeId = ActivityType.Hiking,
            Type = TrailType.Loop,
            Difficulty = Difficulty.Easy,
            Visibility = Visibility.Public,
            GpxData = gpxData,
        };
    }

    private static LineString VaryingElevationLine() => Factory.CreateLineString(new[]
    {
        new CoordinateZ(-21.90, 64.13, 10),
        new CoordinateZ(-21.89, 64.14, 45),
        new CoordinateZ(-21.88, 64.15, 30),
        new CoordinateZ(-21.87, 64.16, 60),
    });

    private static LineString DegenerateElevationLine() => Factory.CreateLineString(new[]
    {
        new CoordinateZ(-21.90, 64.13, 100),
        new CoordinateZ(-21.89, 64.14, 100),
        new CoordinateZ(-21.88, 64.15, 100),
    });

    private static LineString TooFewElevationPointsLine() => Factory.CreateLineString(new[]
    {
        new CoordinateZ(-21.90, 64.13, double.NaN),
        new CoordinateZ(-21.89, 64.14, 45),
        new CoordinateZ(-21.88, 64.15, double.NaN),
    });

    // ─── Happy path ───

    [Fact]
    public async Task Handle_ValidGeometry_SetsElevationProfileAndCountsUpdated()
    {
        var trail = CreateTestTrail("Valid Trail", VaryingElevationLine());
        using (var ctx = _factory.CreateContext())
        {
            ctx.Trails.Add(trail);
            await ctx.SaveChangesAsync();
        }

        BackfillElevationProfilesResult result;
        using (var ctx = _factory.CreateContext())
        {
            var handler = new BackfillElevationProfilesCommandHandler(ctx);
            result = await handler.Handle(new BackfillElevationProfilesCommand(), CancellationToken.None);
        }

        Assert.Equal(1, result.Updated);
        Assert.Equal(0, result.Skipped);

        using (var ctx = _factory.CreateContext())
        {
            var updated = ctx.Trails.Single(t => t.Id == trail.Id);
            Assert.NotNull(updated.ElevationProfile);
            Assert.True(updated.ElevationProfile!.Length >= 2);
        }
    }

    // ─── Skip reasons ───

    [Fact]
    public async Task Handle_NonLineStringGeometry_SkippedWithReason()
    {
        var point = Factory.CreatePoint(new Coordinate(-21.90, 64.13));
        var trail = CreateTestTrail("Point Trail", point);
        using (var ctx = _factory.CreateContext())
        {
            ctx.Trails.Add(trail);
            await ctx.SaveChangesAsync();
        }

        using var ctx2 = _factory.CreateContext();
        var handler = new BackfillElevationProfilesCommandHandler(ctx2);
        var result = await handler.Handle(new BackfillElevationProfilesCommand(), CancellationToken.None);

        Assert.Equal(0, result.Updated);
        Assert.Equal(1, result.Skipped);
        Assert.Equal(1, result.SkipReasons[BackfillElevationProfilesCommandHandler.ReasonNotLineString]);
    }

    [Fact]
    public async Task Handle_FewerThanTwoElevationPoints_SkippedWithReason()
    {
        var trail = CreateTestTrail("Sparse Elevation Trail", TooFewElevationPointsLine());
        using (var ctx = _factory.CreateContext())
        {
            ctx.Trails.Add(trail);
            await ctx.SaveChangesAsync();
        }

        using var ctx2 = _factory.CreateContext();
        var handler = new BackfillElevationProfilesCommandHandler(ctx2);
        var result = await handler.Handle(new BackfillElevationProfilesCommand(), CancellationToken.None);

        Assert.Equal(0, result.Updated);
        Assert.Equal(1, result.Skipped);
        Assert.Equal(1, result.SkipReasons[BackfillElevationProfilesCommandHandler.ReasonTooFewElevationPoints]);
    }

    [Fact]
    public async Task Handle_DegenerateProfile_SkippedWithReason()
    {
        var trail = CreateTestTrail("Flat Trail", DegenerateElevationLine());
        using (var ctx = _factory.CreateContext())
        {
            ctx.Trails.Add(trail);
            await ctx.SaveChangesAsync();
        }

        using var ctx2 = _factory.CreateContext();
        var handler = new BackfillElevationProfilesCommandHandler(ctx2);
        var result = await handler.Handle(new BackfillElevationProfilesCommand(), CancellationToken.None);

        Assert.Equal(0, result.Updated);
        Assert.Equal(1, result.Skipped);
        Assert.Equal(1, result.SkipReasons[BackfillElevationProfilesCommandHandler.ReasonDegenerateProfile]);
    }

    [Fact]
    public async Task Handle_MixOfSkipReasons_CountsEachDistinctly()
    {
        using (var ctx = _factory.CreateContext())
        {
            ctx.Trails.Add(CreateTestTrail("Point Trail", Factory.CreatePoint(new Coordinate(-21.90, 64.13))));
            ctx.Trails.Add(CreateTestTrail("Sparse Trail", TooFewElevationPointsLine()));
            ctx.Trails.Add(CreateTestTrail("Flat Trail", DegenerateElevationLine()));
            ctx.Trails.Add(CreateTestTrail("Valid Trail", VaryingElevationLine()));
            await ctx.SaveChangesAsync();
        }

        using var ctx2 = _factory.CreateContext();
        var handler = new BackfillElevationProfilesCommandHandler(ctx2);
        var result = await handler.Handle(new BackfillElevationProfilesCommand(), CancellationToken.None);

        Assert.Equal(1, result.Updated);
        Assert.Equal(3, result.Skipped);
        Assert.Equal(1, result.SkipReasons[BackfillElevationProfilesCommandHandler.ReasonNotLineString]);
        Assert.Equal(1, result.SkipReasons[BackfillElevationProfilesCommandHandler.ReasonTooFewElevationPoints]);
        Assert.Equal(1, result.SkipReasons[BackfillElevationProfilesCommandHandler.ReasonDegenerateProfile]);
    }

    // ─── Batching ───

    [Fact]
    public async Task Handle_MoreCandidatesThanBatchSize_ProcessesAllInMultipleBatches()
    {
        const int candidateCount = 7;
        using (var ctx = _factory.CreateContext())
        {
            for (var i = 0; i < candidateCount; i++)
            {
                ctx.Trails.Add(CreateTestTrail($"Trail {i}", VaryingElevationLine()));
            }
            await ctx.SaveChangesAsync();
        }

        using var ctx2 = _factory.CreateContext();
        var handler = new BackfillElevationProfilesCommandHandler(ctx2);
        // BatchSize smaller than the candidate count forces multiple SaveChangesAsync round-trips.
        var result = await handler.Handle(new BackfillElevationProfilesCommand(BatchSize: 2), CancellationToken.None);

        Assert.Equal(candidateCount, result.Updated);
        Assert.Equal(0, result.Skipped);

        using var verifyCtx = _factory.CreateContext();
        Assert.Equal(candidateCount, verifyCtx.Trails.Count(t => t.ElevationProfile != null));
    }

    // ─── Idempotency ───

    [Fact]
    public async Task Handle_SecondRunAfterBackfill_UpdatesZero()
    {
        var trail = CreateTestTrail("Valid Trail", VaryingElevationLine());
        using (var ctx = _factory.CreateContext())
        {
            ctx.Trails.Add(trail);
            await ctx.SaveChangesAsync();
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new BackfillElevationProfilesCommandHandler(ctx);
            var firstRun = await handler.Handle(new BackfillElevationProfilesCommand(), CancellationToken.None);
            Assert.Equal(1, firstRun.Updated);
        }

        using (var ctx = _factory.CreateContext())
        {
            var handler = new BackfillElevationProfilesCommandHandler(ctx);
            var secondRun = await handler.Handle(new BackfillElevationProfilesCommand(), CancellationToken.None);

            // The Where clause filters ElevationProfile == null — once set, the trail is no
            // longer a candidate, so a re-run must be a true no-op.
            Assert.Equal(0, secondRun.Updated);
            Assert.Equal(0, secondRun.Skipped);
        }
    }
}
