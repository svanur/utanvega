using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;
using System.Text.Json;
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
            // SQLite has no PostGIS geometry column — round-trip via WKB (with Z ordinate) so
            // tests exercising GpxData (e.g. elevation-profile backfill) see real geometry
            // instead of it silently vanishing to null.
            entity.Property(e => e.GpxData).HasConversion(
                v => v == null ? null : new WKBWriter { HandleOrdinates = Ordinates.XYZ }.Write(v),
                v => v == null ? null : (Geometry)new WKBReader { HandleOrdinates = Ordinates.XYZ }.Read(v)
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
            // SQLite has no PostGIS geometry column — round-trip via WKB (2D, no elevation)
            // the same way GpxData does above, so tests exercising LocationDetector
            // (GetAllLocationCenters filters on Center != null && Radius != null) see real
            // geometry instead of it silently vanishing to null.
            entity.Property(e => e.Center).HasConversion(
                v => v == null ? null : new WKBWriter { HandleOrdinates = Ordinates.XY }.Write(v),
                v => v == null ? null : (Point)new WKBReader { HandleOrdinates = Ordinates.XY }.Read(v)
            );
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

        modelBuilder.Entity<Core.Entities.FeatureFlag>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
            entity.HasIndex(e => e.Name).IsUnique();
            entity.Property(e => e.Description).HasMaxLength(500);
        });

        modelBuilder.Entity<Core.Entities.TrailView>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.ViewedAtUtc).IsRequired();
            entity.Property(e => e.IpHash).HasMaxLength(64);
            entity.HasOne(v => v.Trail)
                  .WithMany()
                  .HasForeignKey(v => v.TrailId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Core.Entities.Event>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Slug).IsRequired().HasMaxLength(250);
            entity.HasIndex(e => e.Slug).IsUnique();
            entity.Property(e => e.OrganizerName).HasMaxLength(200);
            entity.Property(e => e.OrganizerWebsite).HasMaxLength(500);
            entity.Property(e => e.Type).HasConversion<string>();
            entity.Property(e => e.Status).HasConversion<string>();
            entity.Property(e => e.ScheduleRule).HasConversion(
                v => v == null ? null : JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                v => v == null ? null : JsonSerializer.Deserialize<Core.Entities.ScheduleRule>(v, (JsonSerializerOptions?)null)
            );
            entity.Property(e => e.SocialLinks).HasConversion(
                v => v == null ? null : JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                v => v == null ? null : JsonSerializer.Deserialize<System.Collections.Generic.List<Core.Entities.SocialLink>>(v, (JsonSerializerOptions?)null)
            );
            entity.HasOne(e => e.Location)
                  .WithMany()
                  .HasForeignKey(e => e.LocationId)
                  .OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(e => e.Organizer)
                  .WithMany(o => o.Events)
                  .HasForeignKey(e => e.OrganizerId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Core.Entities.Organizer>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Slug).IsRequired().HasMaxLength(200);
            entity.HasIndex(e => e.Slug).IsUnique();
            entity.Property(e => e.SocialLinks).HasConversion(
                v => v == null ? null : JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                v => v == null ? null : JsonSerializer.Deserialize<System.Collections.Generic.List<Core.Entities.SocialLink>>(v, (JsonSerializerOptions?)null)
            );
        });

        modelBuilder.Entity<Core.Entities.Photographer>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Slug).IsRequired().HasMaxLength(200);
            entity.HasIndex(e => e.Slug).IsUnique();
            entity.Property(e => e.SocialLinks).HasConversion(
                v => v == null ? null : JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                v => v == null ? null : JsonSerializer.Deserialize<System.Collections.Generic.List<Core.Entities.SocialLink>>(v, (JsonSerializerOptions?)null)
            );
        });

        modelBuilder.Entity<Core.Entities.EventEdition>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Title).HasMaxLength(200);
            entity.Property(e => e.RegistrationUrl).HasMaxLength(500);
            entity.Property(e => e.ResultsUrl).HasMaxLength(500);
            entity.Property(e => e.RegistrationStatus).HasConversion<string>();
            entity.Property(e => e.Status).HasConversion<string>();
            entity.Property(e => e.Date).HasConversion(
                v => v.HasValue ? (int?)v.Value.DayNumber : null,
                v => v.HasValue ? (DateOnly?)DateOnly.FromDayNumber(v.Value) : null);
            entity.HasOne(e => e.Event)
                  .WithMany(ev => ev.Editions)
                  .HasForeignKey(e => e.EventId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Trail)
                  .WithMany()
                  .HasForeignKey(e => e.TrailId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Core.Entities.PhotoGallery>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Url).IsRequired().HasMaxLength(500);
            entity.Property(e => e.Title).HasMaxLength(200);
            entity.Property(e => e.TitleEn).HasMaxLength(200);
            entity.Property(e => e.CreatedBy).HasMaxLength(200);
            entity.HasOne(e => e.EventEdition)
                  .WithMany(ed => ed.PhotoGalleries)
                  .HasForeignKey(e => e.EventEditionId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Photographer)
                  .WithMany(p => p.PhotoGalleries)
                  .HasForeignKey(e => e.PhotographerId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Core.Entities.Race>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.DistanceLabel).HasMaxLength(50);
            entity.Property(e => e.CertifiedBy).HasMaxLength(100);
            entity.Property(e => e.ChampionshipCategory).HasMaxLength(200);
            entity.Property(e => e.PrizeMoney).HasConversion(
                v => (double)v,
                v => (decimal)v);
            entity.Property(e => e.Status).HasConversion<string>();
            entity.Property(e => e.TicketStatus).HasConversion<string>();
            entity.Property(e => e.ResultType).HasConversion<string>();
            entity.Property(e => e.DateOfRace).HasConversion(
                v => v.HasValue ? (int?)v.Value.DayNumber : null,
                v => v.HasValue ? (DateOnly?)DateOnly.FromDayNumber(v.Value) : null);
            entity.Property(e => e.StartTime).HasConversion(
                v => v.HasValue ? (long?)v.Value.Ticks : null,
                v => v.HasValue ? (TimeOnly?)new TimeOnly(v.Value) : null);
            entity.HasOne(e => e.EventEdition)
                  .WithMany(ed => ed.Races)
                  .HasForeignKey(e => e.EventEditionId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Trail)
                  .WithMany()
                  .HasForeignKey(e => e.TrailId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Core.Entities.UserTrailActivity>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.UserId).IsRequired();
            entity.Property(e => e.TrailSlug).IsRequired().HasMaxLength(250);
            entity.Property(e => e.TimeInSeconds).IsRequired();
            entity.Property(e => e.Notes).HasMaxLength(500);
            // SQLite doesn't support DateTimeOffset in ORDER BY — store as ticks
            entity.Property(e => e.LoggedAt)
                  .IsRequired()
                  .HasConversion(v => v.UtcTicks, v => new DateTimeOffset(v, TimeSpan.Zero));
            entity.Property(e => e.CreatedAt)
                  .IsRequired()
                  .HasConversion(v => v.UtcTicks, v => new DateTimeOffset(v, TimeSpan.Zero));
            entity.Property(e => e.UpdatedAt)
                  .HasConversion(
                      v => v.HasValue ? (long?)v.Value.UtcTicks : null,
                      v => v.HasValue ? (DateTimeOffset?)new DateTimeOffset(v.Value, TimeSpan.Zero) : null);
            // SQLite has no native DateOnly — convert to int
            entity.Property(e => e.LogDate)
                  .HasConversion(
                      v => v.HasValue ? (int?)v.Value.DayNumber : null,
                      v => v.HasValue ? (DateOnly?)DateOnly.FromDayNumber(v.Value) : null);
            // SQLite has no numeric(8,2) — convert to double
            entity.Property(e => e.Distance)
                  .HasConversion(
                      v => v.HasValue ? (double?)((double)v.Value) : null,
                      v => v.HasValue ? (decimal?)((decimal)v.Value) : null);
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => new { e.UserId, e.TrailSlug });
        });

        modelBuilder.Entity<Core.Entities.Profile>(entity =>
        {
            entity.HasKey(e => e.UserId);
            entity.Property(e => e.DisplayName).IsRequired().HasMaxLength(200);
            entity.Property(e => e.AvatarUrl).HasMaxLength(500);
            entity.Property(e => e.CreatedAt)
                  .IsRequired()
                  .HasConversion(v => v.UtcTicks, v => new DateTimeOffset(v, TimeSpan.Zero));
            entity.Property(e => e.UpdatedAt)
                  .IsRequired()
                  .HasConversion(v => v.UtcTicks, v => new DateTimeOffset(v, TimeSpan.Zero));
        });

        modelBuilder.Entity<Core.Entities.TrailCheckIn>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.TrailId).IsRequired();
            entity.Property(e => e.UserId).IsRequired();
            entity.Property(e => e.CreatedAt)
                  .IsRequired()
                  .HasConversion(v => v.UtcTicks, v => new DateTimeOffset(v, TimeSpan.Zero));
            entity.Property(e => e.UpdatedAt)
                  .IsRequired()
                  .HasConversion(v => v.UtcTicks, v => new DateTimeOffset(v, TimeSpan.Zero));
            entity.Property(e => e.ExpiresAt)
                  .IsRequired()
                  .HasConversion(v => v.UtcTicks, v => new DateTimeOffset(v, TimeSpan.Zero));
            entity.HasIndex(e => new { e.TrailId, e.UserId }).IsUnique();
            entity.HasIndex(e => new { e.TrailId, e.ExpiresAt });
            entity.HasIndex(e => new { e.UserId, e.ExpiresAt });
        });

        modelBuilder.Entity<Core.Entities.Feedback>(entity =>
        {
            entity.ToTable("Feedback");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.FeedbackNumber).HasDefaultValue(0);
            entity.Property(e => e.PageUrl).IsRequired().HasMaxLength(500);
            entity.Property(e => e.Message).IsRequired().HasMaxLength(2000);
            entity.Property(e => e.Category).HasMaxLength(50);
            entity.Property(e => e.Name).HasMaxLength(200);
            entity.Property(e => e.Email).HasMaxLength(200);
            entity.Property(e => e.StepsToReproduce).HasMaxLength(2000);
            entity.Property(e => e.Status).IsRequired().HasMaxLength(50);
            entity.Property(e => e.Priority).IsRequired().HasMaxLength(20);
            entity.Property(e => e.AdminComment).HasMaxLength(2000);
            entity.Property(e => e.CreatedAt)
                  .HasConversion(v => v.UtcTicks, v => new DateTimeOffset(v, TimeSpan.Zero));
            entity.Property(e => e.ClosedAt)
                  .HasConversion(
                      v => v.HasValue ? (long?)v.Value.UtcTicks : null,
                      v => v.HasValue ? (DateTimeOffset?)new DateTimeOffset(v.Value, TimeSpan.Zero) : null);
        });
    }
}
