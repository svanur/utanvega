namespace Utanvega.Backend.Infrastructure.Persistence;

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
            entity.Property(e => e.GpxData).HasColumnType("geometry");
            
            // Store Enums as Strings in Database
            entity.Property(e => e.Status)
                  .HasConversion<string>();
            entity.Property(e => e.ActivityTypeId)
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
            entity.HasKey(tl => new { tl.TrailId, tl.LocationId, tl.Role });

            entity.Property(tl => tl.Role).HasConversion<string>();

            entity.HasOne(tl => tl.Trail)
                  .WithMany(t => t.TrailLocations)
                  .HasForeignKey(tl => tl.TrailId);

            entity.HasOne(tl => tl.Location)
                  .WithMany(l => l.TrailLocations)
                  .HasForeignKey(tl => tl.LocationId);
        });
    }
}
