using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Retention;
using Xunit;

namespace Utanvega.Backend.Tests.Handlers;

/// <summary>
/// The retention sweep clears IP hashes past the window while keeping the views
/// themselves, so counts survive and only visitor identity is dropped.
/// </summary>
public class TrailViewAnonymizerTests : IDisposable
{
    private readonly TestDbContextFactory _factory = new();
    private readonly DateTime _now = new(2026, 8, 25, 12, 0, 0, DateTimeKind.Utc);
    private static readonly Guid TrailId = Guid.NewGuid();

    public void Dispose() => _factory.Dispose();

    private void Seed(params (double DaysAgo, string? IpHash)[] views)
    {
        using var context = _factory.CreateContext();
        context.Trails.Add(new Trail
        {
            Id = TrailId, Name = "Esja", Slug = "esja",
            Status = TrailStatus.Published, Length = 10_000, ElevationGain = 500,
        });
        foreach (var (daysAgo, ipHash) in views)
        {
            context.TrailViews.Add(new TrailView
            {
                Id = Guid.NewGuid(), TrailId = TrailId,
                ViewedAtUtc = _now.AddDays(-daysAgo), IpHash = ipHash,
            });
        }
        context.SaveChanges();
    }

    private async Task<int> Sweep(int retentionDays = 90)
    {
        await using var context = _factory.CreateContext();
        return await TrailViewAnonymizer.AnonymizeAsync(
            context, TimeSpan.FromDays(retentionDays), _now);
    }

    [Fact]
    public async Task ClearsHashesPastTheWindow()
    {
        Seed((100, "old"), (91, "old2"));
        Assert.Equal(2, await Sweep());

        await using var context = _factory.CreateContext();
        Assert.All(await context.TrailViews.ToListAsync(), v => Assert.Null(v.IpHash));
    }

    [Fact]
    public async Task LeavesHashesInsideTheWindowAlone()
    {
        Seed((89, "recent"), (1, "today"));
        Assert.Equal(0, await Sweep());

        await using var context = _factory.CreateContext();
        Assert.Equal(2, await context.TrailViews.CountAsync(v => v.IpHash != null));
    }

    [Fact]
    public async Task KeepsTheViewsThemselves_SoCountsAreUnaffected()
    {
        // The whole point of nulling rather than deleting: view counts, per-trail
        // popularity and the hourly and daily distributions must survive intact.
        Seed((200, "a"), (100, "b"), (10, "c"));
        await Sweep();

        await using var context = _factory.CreateContext();
        Assert.Equal(3, await context.TrailViews.CountAsync());
        Assert.Equal(3, await context.TrailViews.CountAsync(v => v.TrailId == TrailId));
    }

    [Fact]
    public async Task IsIdempotent()
    {
        // The sweep runs on a timer with no coordination, so a second run must
        // be a no-op rather than double-counting or erroring.
        Seed((100, "old"));
        Assert.Equal(1, await Sweep());
        Assert.Equal(0, await Sweep());
    }

    [Fact]
    public async Task IgnoresRowsAlreadyCleared()
    {
        Seed((100, null), (100, "old"));
        Assert.Equal(1, await Sweep());
    }

    [Fact]
    public async Task RespectsAConfiguredWindow()
    {
        Seed((45, "a"), (20, "b"));
        Assert.Equal(1, await Sweep(retentionDays: 30));

        await using var context = _factory.CreateContext();
        Assert.Equal(1, await context.TrailViews.CountAsync(v => v.IpHash != null));
    }
}
