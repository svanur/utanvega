using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Tests;

/// <summary>
/// Creates in-memory SQLite-based DbContext instances for testing.
/// Uses a shared connection so the database persists across operations within a test.
/// </summary>
public class TestDbContextFactory : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly DbContextOptions<UtanvegaDbContext> _options;

    public TestDbContextFactory()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        _options = new DbContextOptionsBuilder<UtanvegaDbContext>()
            .UseSqlite(_connection)
            .Options;

        using var context = CreateContext();
        context.Database.EnsureCreated();
    }

    public UtanvegaDbContext CreateContext() => new TestDbContext(_options);

    public void Dispose()
    {
        _connection.Close();
        _connection.Dispose();
    }
}

/// <summary>
/// Test DbContext that skips Postgres-specific configurations (PostGIS extension, geometry column types).
/// </summary>
internal class TestDbContext : UtanvegaDbContext
{
    public TestDbContext(DbContextOptions<UtanvegaDbContext> options) : base(options) { }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Call base but we need to skip HasPostgresExtension and HasColumnType for geometry
        // So we replicate the config without Postgres-specific parts

        modelBuilder.Entity<Core.Entities.Trail>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Slug).IsRequired().HasMaxLength(250);
            entity.HasIndex(e => e.Slug).IsUnique();
            entity.Property(e => e.GpxData).HasConversion(
                v => (byte[]?)null,
                v => null!
            );
            entity.Property(e => e.Status).HasConversion<string>();
            entity.Property(e => e.ActivityTypeId).HasConversion<string>();
            entity.Property(e => e.Type).HasConversion<string>();
            entity.Property(e => e.Difficulty).HasConversion<string>();
            entity.Property(e => e.Visibility).HasConversion<string>();
        });

        modelBuilder.Entity<Core.Entities.Location>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Slug).IsRequired().HasMaxLength(250);
            entity.HasIndex(e => e.Slug).IsUnique();
            entity.Ignore(e => e.Center); // SQLite can't store NTS Point
            entity.Property(e => e.Type).HasConversion<string>();
            entity.HasOne(e => e.Parent)
                  .WithMany(e => e.Children)
                  .HasForeignKey(e => e.ParentId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Core.Entities.TrailLocation>(entity =>
        {
            entity.HasKey(tl => tl.Id);
            entity.Property(tl => tl.Role).HasConversion<string>();
            entity.HasOne(tl => tl.Trail)
                  .WithMany(t => t.TrailLocations)
                  .HasForeignKey(tl => tl.TrailId);
            entity.HasOne(tl => tl.Location)
                  .WithMany(l => l.TrailLocations)
                  .HasForeignKey(tl => tl.LocationId);
        });

        modelBuilder.Entity<Core.Entities.ChangeLog>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.EntityName).IsRequired().HasMaxLength(100);
            entity.Property(e => e.EntityId).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Action).IsRequired().HasMaxLength(50);
            entity.Property(e => e.TimestampUtc).IsRequired();
        });

        modelBuilder.Entity<Core.Entities.Tag>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Slug).IsRequired().HasMaxLength(120);
            entity.HasIndex(e => e.Slug).IsUnique();
            entity.Property(e => e.Color).HasMaxLength(20);
        });

        modelBuilder.Entity<Core.Entities.TrailTag>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasOne(tt => tt.Trail)
                  .WithMany(t => t.TrailTags)
                  .HasForeignKey(tt => tt.TrailId);
            entity.HasOne(tt => tt.Tag)
                  .WithMany(t => t.TrailTags)
                  .HasForeignKey(tt => tt.TagId);
            entity.HasIndex(tt => new { tt.TrailId, tt.TagId }).IsUnique();
        });
    }
}
