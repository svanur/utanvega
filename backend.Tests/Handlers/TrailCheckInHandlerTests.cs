namespace Utanvega.Backend.Tests.Handlers;

using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Application.TrailCheckIns.Commands.CheckInToTrail;
using Utanvega.Backend.Application.TrailCheckIns.Commands.CheckOutFromTrail;
using Utanvega.Backend.Application.TrailCheckIns.Queries.GetTrailCheckIns;
using Utanvega.Backend.Core.Entities;
using Xunit;

public class TrailCheckInHandlerTests : IDisposable
{
    private readonly TestDbContextFactory _factory;

    public TrailCheckInHandlerTests() => _factory = new TestDbContextFactory();

    public void Dispose() => _factory.Dispose();

    [Fact]
    public async Task CheckInToTrail_CreatesOrRefreshesSingleCheckInPerUserTrail()
    {
        var userId = Guid.NewGuid();
        var trailId = await SeedTrailAsync("esja");

        await using (var context = _factory.CreateContext())
        {
            context.Profiles.Add(new Profile
            {
                UserId = userId,
                DisplayName = "Runner One",
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow,
            });
            await context.SaveChangesAsync();
        }

        TrailCheckInDto first;
        TrailCheckInDto second;
        await using (var context = _factory.CreateContext())
        {
            var handler = new CheckInToTrailHandler(context);
            first = await handler.Handle(new CheckInToTrailCommand(userId, "esja"), CancellationToken.None);
            second = await handler.Handle(new CheckInToTrailCommand(userId, "esja"), CancellationToken.None);
        }

        Assert.Equal(trailId, first.TrailId);
        Assert.Equal(first.Id, second.Id);
        Assert.True(second.ExpiresAt >= first.ExpiresAt);

        await using var verifyContext = _factory.CreateContext();
        var count = await verifyContext.TrailCheckIns.CountAsync(c => c.TrailId == trailId && c.UserId == userId);
        Assert.Equal(1, count);
    }

    [Fact]
    public async Task GetTrailCheckIns_ReturnsOnlyActiveCheckIns()
    {
        var trailId = await SeedTrailAsync("ulfljotsvatn");
        var activeUser = Guid.NewGuid();
        var expiredUser = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;

        await using (var context = _factory.CreateContext())
        {
            context.Profiles.AddRange(
                new Profile { UserId = activeUser, DisplayName = "Active Runner", CreatedAt = now, UpdatedAt = now },
                new Profile { UserId = expiredUser, DisplayName = "Expired Runner", CreatedAt = now, UpdatedAt = now }
            );
            context.TrailCheckIns.AddRange(
                new TrailCheckIn
                {
                    Id = Guid.NewGuid(),
                    TrailId = trailId,
                    UserId = activeUser,
                    CreatedAt = now.AddMinutes(-10),
                    UpdatedAt = now.AddMinutes(-10),
                    ExpiresAt = now.AddHours(1),
                },
                new TrailCheckIn
                {
                    Id = Guid.NewGuid(),
                    TrailId = trailId,
                    UserId = expiredUser,
                    CreatedAt = now.AddHours(-6),
                    UpdatedAt = now.AddHours(-6),
                    ExpiresAt = now.AddMinutes(-5),
                }
            );
            await context.SaveChangesAsync();
        }

        await using var readContext = _factory.CreateContext();
        var result = await new GetTrailCheckInsHandler(readContext)
            .Handle(new GetTrailCheckInsQuery("ulfljotsvatn"), CancellationToken.None);

        Assert.Equal(1, result.TotalActive);
        Assert.Single(result.Entries);
        Assert.Equal(activeUser, result.Entries[0].UserId);
    }

    [Fact]
    public async Task CheckOutFromTrail_ExpiresExistingCheckIn()
    {
        var userId = Guid.NewGuid();
        var trailId = await SeedTrailAsync("heidmork");
        var now = DateTimeOffset.UtcNow;
        var checkInId = Guid.NewGuid();

        await using (var context = _factory.CreateContext())
        {
            context.TrailCheckIns.Add(new TrailCheckIn
            {
                Id = checkInId,
                TrailId = trailId,
                UserId = userId,
                CreatedAt = now.AddMinutes(-15),
                UpdatedAt = now.AddMinutes(-15),
                ExpiresAt = now.AddHours(2),
            });
            await context.SaveChangesAsync();
        }

        await using (var context = _factory.CreateContext())
        {
            var changed = await new CheckOutFromTrailHandler(context)
                .Handle(new CheckOutFromTrailCommand(userId, "heidmork"), CancellationToken.None);
            Assert.True(changed);
        }

        await using var verifyContext = _factory.CreateContext();
        var updated = await verifyContext.TrailCheckIns.FindAsync(checkInId);
        Assert.NotNull(updated);
        Assert.True(updated!.ExpiresAt <= DateTimeOffset.UtcNow);
    }

    private async Task<Guid> SeedTrailAsync(string slug)
    {
        var trailId = Guid.NewGuid();
        await using var context = _factory.CreateContext();
        context.Trails.Add(new Trail
        {
            Id = trailId,
            Name = $"Trail {slug}",
            Slug = slug,
            ActivityTypeId = ActivityType.TrailRunning,
            Status = TrailStatus.Published,
            Type = TrailType.Loop,
            Difficulty = Difficulty.Moderate,
            Visibility = Visibility.Public,
            Length = 5000,
            ElevationGain = 200,
            ElevationLoss = 200,
            CreatedAt = DateTime.UtcNow,
        });
        await context.SaveChangesAsync();
        return trailId;
    }
}
