using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Tests.Services;

// SaveChangesWithAuditAsync (#813) generically populates CreatedBy/UpdatedBy for any tracked
// entity that exposes those properties, instead of leaving each handler to set them manually.
public class DbContextExtensionsTests : IDisposable
{
    private readonly TestDbContextFactory _factory = new();

    public void Dispose() => _factory.Dispose();

    [Fact]
    public async Task SaveChangesWithAuditAsync_NewTrail_SetsCreatedBy()
    {
        var trail = new Trail
        {
            Name = "Esjan",
            Slug = "esjan",
        };

        using var ctx = _factory.CreateContext();
        ctx.Trails.Add(trail);
        await ctx.SaveChangesWithAuditAsync("user-123");

        Assert.Equal("user-123", trail.CreatedBy);
        Assert.Null(trail.UpdatedBy);
    }

    [Fact]
    public async Task SaveChangesWithAuditAsync_UpdatedTrail_SetsUpdatedBy()
    {
        var trail = new Trail
        {
            Name = "Esjan",
            Slug = "esjan",
        };

        using (var seedCtx = _factory.CreateContext())
        {
            seedCtx.Trails.Add(trail);
            await seedCtx.SaveChangesWithAuditAsync("creator-id");
        }

        using var ctx = _factory.CreateContext();
        var tracked = await ctx.Trails.FindAsync(trail.Id);
        Assert.NotNull(tracked);
        tracked!.Name = "Esjan (updated)";

        await ctx.SaveChangesWithAuditAsync("updater-id");

        Assert.Equal("updater-id", tracked.UpdatedBy);
        // CreatedBy set on the original insert must survive an unrelated update.
        Assert.Equal("creator-id", tracked.CreatedBy);
    }

    [Fact]
    public async Task SaveChangesWithAuditAsync_ChangeLogEntity_PassesThroughWithoutError()
    {
        // ChangeLog has neither CreatedBy nor UpdatedBy — this must not throw when the generic
        // audit-property lookup finds no matching property on the tracked entity.
        var changeLog = new ChangeLog
        {
            EntityName = "Trail",
            EntityId = "some-id",
            Action = "Create",
            TimestampUtc = DateTime.UtcNow,
        };

        using var ctx = _factory.CreateContext();
        ctx.ChangeLogs.Add(changeLog);

        var exception = await Record.ExceptionAsync(() => ctx.SaveChangesWithAuditAsync("user-123"));

        Assert.Null(exception);
    }
}
