using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Migrations;

namespace Utanvega.Backend.Tests.Migrations;

/// <summary>
/// #1603: EditionStatus.Active was renamed to EditionStatus.Confirmed. Status is a plain string
/// column (JsonStringEnumConverter on the wire, HasConversion&lt;string&gt;() in EF) — there's no
/// wire-format compatibility shim, so every pre-existing 'Active' row depends on this migration's
/// data-only UPDATE to read back correctly. These tests run the migration's actual Up()/Down() SQL
/// (pulled from Migration.UpOperations/DownOperations, not a hand-copied string) against a real
/// EventEdition row, rather than merely asserting the SQL text looks right.
/// </summary>
public class RenameEditionStatusActiveToConfirmedMigrationTests : IDisposable
{
    private readonly TestDbContextFactory _factory = new();

    public void Dispose() => _factory.Dispose();

    private static string ExtractSql(IReadOnlyList<MigrationOperation> operations)
        => Assert.IsType<SqlOperation>(Assert.Single(operations)).Sql;

    private static Event NewEvent(string slug) => new()
    {
        Id = Guid.NewGuid(),
        Name = slug,
        Slug = slug,
        Type = EventType.Race,
    };

    [Fact]
    public async Task Up_ConvertsLegacyActiveRows_ToConfirmed()
    {
        using var ctx = _factory.CreateContext();
        var ev = NewEvent("legacy-active-event");
        var edition = new EventEdition
        {
            Id = Guid.NewGuid(),
            EventId = ev.Id,
            Event = ev,
            Status = EditionStatus.Confirmed, // overwritten below by raw SQL to simulate a pre-migration row
        };
        ctx.Events.Add(ev);
        ctx.EventEditions.Add(edition);
        await ctx.SaveChangesAsync();

        // EditionStatus.Active no longer exists, so EF's HasConversion<string>() can't write
        // "Active" through the enum property any more — the raw SQL below is the only way to put
        // a pre-migration row back into the column for this test.
        await ctx.Database.ExecuteSqlRawAsync(
            "UPDATE \"EventEditions\" SET \"Status\" = 'Active' WHERE \"Id\" = {0}", edition.Id);

        var migration = new RenameEditionStatusActiveToConfirmed();
        await ctx.Database.ExecuteSqlRawAsync(ExtractSql(migration.UpOperations));

        using var verify = _factory.CreateContext();
        Assert.Equal(EditionStatus.Confirmed, verify.EventEditions.Find(edition.Id)!.Status);
    }

    [Fact]
    public async Task Up_LeavesOtherStatuses_Untouched()
    {
        using var ctx = _factory.CreateContext();
        var ev = NewEvent("cancelled-edition-event");
        var edition = new EventEdition
        {
            Id = Guid.NewGuid(),
            EventId = ev.Id,
            Event = ev,
            Status = EditionStatus.Cancelled,
        };
        ctx.Events.Add(ev);
        ctx.EventEditions.Add(edition);
        await ctx.SaveChangesAsync();

        var migration = new RenameEditionStatusActiveToConfirmed();
        await ctx.Database.ExecuteSqlRawAsync(ExtractSql(migration.UpOperations));

        using var verify = _factory.CreateContext();
        Assert.Equal(EditionStatus.Cancelled, verify.EventEditions.Find(edition.Id)!.Status);
    }

    [Fact]
    public async Task Down_RevertsConfirmedRows_ToActive()
    {
        using var ctx = _factory.CreateContext();
        var ev = NewEvent("confirmed-edition-event");
        var edition = new EventEdition
        {
            Id = Guid.NewGuid(),
            EventId = ev.Id,
            Event = ev,
            Status = EditionStatus.Confirmed,
        };
        ctx.Events.Add(ev);
        ctx.EventEditions.Add(edition);
        await ctx.SaveChangesAsync();

        var migration = new RenameEditionStatusActiveToConfirmed();
        await ctx.Database.ExecuteSqlRawAsync(ExtractSql(migration.DownOperations));

        // Read back with raw SQL rather than through the enum property — EditionStatus has no
        // Active member any more, so EF's HasConversion<string>() can't deserialize the reverted
        // literal back into the enum.
        using var verify = _factory.CreateContext();
        var status = await verify.Database
            .SqlQueryRaw<string>("SELECT \"Status\" AS \"Value\" FROM \"EventEditions\" WHERE \"Id\" = {0}", edition.Id)
            .SingleAsync();
        Assert.Equal("Active", status);
    }
}
