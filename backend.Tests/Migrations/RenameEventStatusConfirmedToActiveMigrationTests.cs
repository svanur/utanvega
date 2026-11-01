using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Migrations;

namespace Utanvega.Backend.Tests.Migrations;

/// <summary>
/// #792: EventStatus.Confirmed was renamed to EventStatus.Active. Status is a plain string
/// column (JsonStringEnumConverter on the wire, HasConversion&lt;string&gt;() in EF) — there's no
/// wire-format compatibility shim, so every pre-existing 'Confirmed' row depends on this
/// migration's data-only UPDATE to read back correctly. These tests run the migration's actual
/// Up()/Down() SQL (pulled from Migration.UpOperations/DownOperations, not a hand-copied string)
/// against a real Event row, rather than merely asserting the SQL text looks right.
/// </summary>
public class RenameEventStatusConfirmedToActiveMigrationTests : IDisposable
{
    private readonly TestDbContextFactory _factory = new();

    public void Dispose() => _factory.Dispose();

    private static string ExtractSql(IReadOnlyList<MigrationOperation> operations)
        => Assert.IsType<SqlOperation>(Assert.Single(operations)).Sql;

    [Fact]
    public async Task Up_ConvertsLegacyConfirmedRows_ToActive()
    {
        using var ctx = _factory.CreateContext();
        var ev = new Event
        {
            Id = Guid.NewGuid(),
            Name = "Legacy Confirmed Event",
            Slug = "legacy-confirmed-event",
            Type = EventType.Race,
            Status = EventStatus.Active, // overwritten below by raw SQL to simulate a pre-migration row
        };
        ctx.Events.Add(ev);
        await ctx.SaveChangesAsync();

        // EventStatus.Confirmed no longer exists, so EF's HasConversion<string>() can't write
        // "Confirmed" through the enum property any more — the raw SQL below is the only way to
        // put a pre-migration row back into the column for this test.
        await ctx.Database.ExecuteSqlRawAsync(
            "UPDATE \"Events\" SET \"Status\" = 'Confirmed' WHERE \"Id\" = {0}", ev.Id);

        var migration = new RenameEventStatusConfirmedToActive();
        await ctx.Database.ExecuteSqlRawAsync(ExtractSql(migration.UpOperations));

        using var verify = _factory.CreateContext();
        Assert.Equal(EventStatus.Active, verify.Events.Find(ev.Id)!.Status);
    }

    [Fact]
    public async Task Up_LeavesOtherStatuses_Untouched()
    {
        using var ctx = _factory.CreateContext();
        var ev = new Event
        {
            Id = Guid.NewGuid(),
            Name = "Cancelled Event",
            Slug = "cancelled-event",
            Type = EventType.Race,
            Status = EventStatus.Cancelled,
        };
        ctx.Events.Add(ev);
        await ctx.SaveChangesAsync();

        var migration = new RenameEventStatusConfirmedToActive();
        await ctx.Database.ExecuteSqlRawAsync(ExtractSql(migration.UpOperations));

        using var verify = _factory.CreateContext();
        Assert.Equal(EventStatus.Cancelled, verify.Events.Find(ev.Id)!.Status);
    }

    [Fact]
    public async Task Down_RevertsActiveRows_ToConfirmed()
    {
        using var ctx = _factory.CreateContext();
        var ev = new Event
        {
            Id = Guid.NewGuid(),
            Name = "Active Event",
            Slug = "active-event",
            Type = EventType.Race,
            Status = EventStatus.Active,
        };
        ctx.Events.Add(ev);
        await ctx.SaveChangesAsync();

        var migration = new RenameEventStatusConfirmedToActive();
        await ctx.Database.ExecuteSqlRawAsync(ExtractSql(migration.DownOperations));

        // Read back with raw SQL rather than through the enum property — EventStatus has no
        // Confirmed member any more, so EF's HasConversion<string>() can't deserialize the
        // reverted literal back into the enum.
        using var verify = _factory.CreateContext();
        var status = await verify.Database
            .SqlQueryRaw<string>("SELECT \"Status\" AS \"Value\" FROM \"Events\" WHERE \"Id\" = {0}", ev.Id)
            .SingleAsync();
        Assert.Equal("Confirmed", status);
    }
}
