namespace Utanvega.Backend.Infrastructure.Persistence;

using Utanvega.Backend.Core.Entities;
using Microsoft.EntityFrameworkCore;

public class UtanvegaDbContext : DbContext
{
    public UtanvegaDbContext(DbContextOptions<UtanvegaDbContext> options) : base(options)
    {
    }

    public DbSet<Trail> Trails => Set<Trail>();

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
        });
    }
}
