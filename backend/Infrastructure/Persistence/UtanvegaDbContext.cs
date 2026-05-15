namespace Utanvega.Backend.Infrastructure.Persistence;

using System.Text.Json;
using Utanvega.Backend.Core.Entities;
using Microsoft.EntityFrameworkCore;

public class UtanvegaDbContext : DbContext
{
    public UtanvegaDbContext(DbContextOptions<UtanvegaDbContext> options) : base(options)
    {
    }

    public DbSet<Trail> Trails => Set<Trail>();
    public DbSet<Location> Locations => Set<Location>();
    public DbSet<TrailLocation> TrailLocations => Set<TrailLocation>();
    public DbSet<Tag> Tags => Set<Tag>();
    public DbSet<TrailTag> TrailTags => Set<TrailTag>();
    public DbSet<ChangeLog> ChangeLogs => Set<ChangeLog>();
    public DbSet<TrailView> TrailViews => Set<TrailView>();
    public DbSet<FeatureFlag> FeatureFlags => Set<FeatureFlag>();
    public DbSet<Competition> Competitions => Set<Competition>();
    public DbSet<Race> Races => Set<Race>();
    public DbSet<UserTrailActivity> UserTrailActivities => Set<UserTrailActivity>();
    public DbSet<Profile> Profiles => Set<Profile>();
    public DbSet<TrailCheckIn> TrailCheckIns => Set<TrailCheckIn>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasPostgresExtension("postgis");

        modelBuilder.Entity<Trail>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Slug).IsRequired().HasMaxLength(250);
            entity.HasIndex(e => e.Slug).IsUnique();
            
            // Map NetTopologySuite Geometry to PostGIS
            // Use geometry(LineStringZ, 4326) to ensure elevation (Z) is preserved
            entity.Property(e => e.GpxData).HasColumnType("geometry(LineStringZ, 4326)");
            
            // Log for debugging (this will run on every context instantiation, maybe too much?)
            // Console.WriteLine("[DEBUG_LOG] UtanvegaDbContext: GpxData configured as geometry(LineStringZ, 4326)");
            
            // Store Enums as Strings in Database
            entity.Property(e => e.Status)
                  .HasConversion<string>();
            entity.Property(e => e.ActivityTypeId)
                  .HasConversion<string>();
            entity.Property(e => e.Type)
                  .HasConversion<string>();
            entity.Property(e => e.Difficulty)
                  .HasConversion<string>();
            entity.Property(e => e.Visibility)
                  .HasConversion<string>();
        });

        modelBuilder.Entity<Location>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Slug).IsRequired().HasMaxLength(250);
            entity.HasIndex(e => e.Slug).IsUnique();
            
            entity.Property(e => e.Center).HasColumnType("geometry(Point, 4326)"); // Using 4326 (WGS 84) for PostGIS
            
            entity.Property(e => e.Type).HasConversion<string>();

            // Self-referencing relationship
            entity.HasOne(e => e.Parent)
                  .WithMany(e => e.Children)
                  .HasForeignKey(e => e.ParentId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<TrailLocation>(entity =>
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

        modelBuilder.Entity<ChangeLog>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.EntityName).IsRequired().HasMaxLength(100);
            entity.Property(e => e.EntityId).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Action).IsRequired().HasMaxLength(50);
            entity.Property(e => e.TimestampUtc).IsRequired();
            entity.HasIndex(e => e.EntityId);
            entity.HasIndex(e => e.EntityName);
        });

        modelBuilder.Entity<Tag>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Slug).IsRequired().HasMaxLength(120);
            entity.HasIndex(e => e.Slug).IsUnique();
            entity.Property(e => e.Color).HasMaxLength(20);
        });

        modelBuilder.Entity<TrailTag>(entity =>
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

        modelBuilder.Entity<TrailView>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.ViewedAtUtc).IsRequired();
            entity.Property(e => e.IpHash).HasMaxLength(64);

            entity.HasOne(v => v.Trail)
                  .WithMany()
                  .HasForeignKey(v => v.TrailId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => e.TrailId);
            entity.HasIndex(e => e.ViewedAtUtc);
            entity.HasIndex(e => new { e.TrailId, e.IpHash, e.ViewedAtUtc });
        });

        modelBuilder.Entity<FeatureFlag>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
            entity.HasIndex(e => e.Name).IsUnique();
            entity.Property(e => e.Description).HasMaxLength(500);
        });

        modelBuilder.Entity<Competition>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Slug).IsRequired().HasMaxLength(250);
            entity.HasIndex(e => e.Slug).IsUnique();
            entity.Property(e => e.OrganizerName).HasMaxLength(200);
            entity.Property(e => e.OrganizerWebsite).HasMaxLength(500);
            entity.Property(e => e.RegistrationUrl).HasMaxLength(500);

            entity.Property(e => e.Status).HasConversion<string>();

            entity.Property(e => e.ScheduleRule)
                  .HasColumnType("jsonb")
                  .HasConversion(
                      v => v == null ? null : JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                      v => v == null ? null : JsonSerializer.Deserialize<ScheduleRule>(v, (JsonSerializerOptions?)null)
                  );

            entity.HasOne(e => e.Location)
                  .WithMany()
                  .HasForeignKey(e => e.LocationId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Race>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.DistanceLabel).HasMaxLength(50);
            entity.Property(e => e.Status).HasConversion<string>();

            entity.HasOne(e => e.Competition)
                  .WithMany(c => c.Races)
                  .HasForeignKey(e => e.CompetitionId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Trail)
                  .WithMany()
                  .HasForeignKey(e => e.TrailId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasIndex(e => e.CompetitionId);
        });

        modelBuilder.Entity<UserTrailActivity>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.ToTable("UserTrailActivities");
            
            entity.Property(e => e.Id).HasColumnName("Id");
            entity.Property(e => e.UserId).IsRequired().HasColumnName("UserId");
            entity.Property(e => e.TrailSlug).IsRequired().HasMaxLength(250).HasColumnName("TrailSlug");
            entity.Property(e => e.LogDate).HasColumnType("date").HasColumnName("LogDate");
            entity.Property(e => e.TimeInSeconds).IsRequired().HasColumnName("TimeInSeconds");
            entity.Property(e => e.Distance).HasPrecision(8, 2).HasColumnName("Distance");
            entity.Property(e => e.ElevationGain).HasColumnName("ElevationGain");
            entity.Property(e => e.Notes).HasMaxLength(500).HasColumnName("Notes");
            entity.Property(e => e.IsPublic).HasColumnName("IsPublic");
            entity.Property(e => e.LoggedAt).IsRequired().HasColumnName("LoggedAt");
            entity.Property(e => e.UpdatedAt).HasColumnName("UpdatedAt");
            entity.Property(e => e.CreatedAt).IsRequired().HasColumnName("CreatedAt");
            
            // Unique constraint: one activity per user per trail per day
            entity.HasIndex(e => new { e.UserId, e.TrailSlug, e.LogDate }).IsUnique();
            
            // Indexes for querying
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.LogDate);
            entity.HasIndex(e => e.CreatedAt);
        });

        modelBuilder.Entity<Profile>(entity =>
        {
            entity.HasKey(e => e.UserId);
            entity.ToTable("Profiles");

            entity.Property(e => e.UserId).HasColumnName("UserId");
            entity.Property(e => e.DisplayName).IsRequired().HasColumnName("DisplayName");
            entity.Property(e => e.AvatarUrl).HasColumnName("AvatarUrl");
            entity.Property(e => e.CreatedAt).HasColumnName("CreatedAt");
            entity.Property(e => e.UpdatedAt).HasColumnName("UpdatedAt");
        });

        modelBuilder.Entity<TrailCheckIn>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.ToTable("TrailCheckIns");

            entity.Property(e => e.TrailId).HasColumnName("TrailId");
            entity.Property(e => e.UserId).HasColumnName("UserId");
            entity.Property(e => e.CreatedAt).HasColumnName("CreatedAt");
            entity.Property(e => e.UpdatedAt).HasColumnName("UpdatedAt");
            entity.Property(e => e.ExpiresAt).HasColumnName("ExpiresAt");

            entity.HasOne(e => e.Trail)
                  .WithMany()
                  .HasForeignKey(e => e.TrailId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => new { e.TrailId, e.UserId }).IsUnique();
            entity.HasIndex(e => new { e.TrailId, e.ExpiresAt });
            entity.HasIndex(e => new { e.UserId, e.ExpiresAt });
        });
    }
}
