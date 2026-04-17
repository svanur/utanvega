using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Core.Entities;

namespace Utanvega.Backend.Infrastructure.Persistence;

public static class DbContextExtensions
{
    public static async Task SaveChangesWithAuditAsync(this UtanvegaDbContext db, string? userId = "system")
    {
        var auditEntries = new List<ChangeLog>();
        var entries = db.ChangeTracker.Entries()
            .Where(e => e.Entity is not ChangeLog && (e.State == EntityState.Added || e.State == EntityState.Modified || e.State == EntityState.Deleted))
            .ToList();

        if (entries.Count == 0)
        {
            await db.SaveChangesAsync();
            return;
        }

        foreach (var entry in entries)
        {
            var entityName = entry.Entity.GetType().Name;
            var entityIdProperty = entry.Metadata.FindProperty("Id");
            var entityId = "unknown";
            
            if (entityIdProperty != null)
            {
                var val = entry.Property(entityIdProperty.Name).CurrentValue;
                if (val == null || val.Equals(Guid.Empty))
                {
                    entityId = "new";
                }
                else
                {
                    entityId = val.ToString() ?? "unknown";
                }
            }
            else
            {
                var alternativeId = entry.Metadata.GetProperties().FirstOrDefault(p => p.Name.EndsWith("Id", StringComparison.OrdinalIgnoreCase));
                if (alternativeId != null)
                {
                    var val = entry.Property(alternativeId.Name).CurrentValue;
                    entityId = val?.ToString() ?? "unknown";
                }
            }
            
            var auditEntry = new ChangeLog
            {
                EntityName = entityName,
                EntityId = entityId,
                UserId = userId,
                TimestampUtc = DateTime.UtcNow
            };

            switch (entry.State)
            {
                case EntityState.Added:
                    auditEntry.Action = "Create";
                    auditEntry.Description = $"Created {entityName}";
                    break;

                case EntityState.Modified:
                    auditEntry.Action = "Update";
                    var changes = new Dictionary<string, object?>();
                    
                    var currentValues = entry.CurrentValues;
                    var originalValues = entry.OriginalValues;

                    foreach (var property in entry.Metadata.GetProperties())
                    {
                        var propName = property.Name;

                        // Skip geometry columns — NTS types have circular references
                        if (property.ClrType.Namespace?.StartsWith("NetTopologySuite") == true)
                            continue;

                        object? originalValue = null;
                        
                        try 
                        {
                            // Only Modified entries have reliable OriginalValues in most cases
                            if (originalValues.Properties.Any(p => p.Name == propName))
                            {
                                originalValue = originalValues[propName];
                            }
                        }
                        catch { /* Fallback to null */ }
                        
                        var currentValue = currentValues[propName];

                        if (!Equals(originalValue, currentValue))
                        {
                            changes[propName] = new { From = originalValue, To = currentValue };
                        }
                    }

                    // Track geometry changes separately (just note that it changed, don't serialize the object)
                    foreach (var property in entry.Metadata.GetProperties())
                    {
                        if (property.ClrType.Namespace?.StartsWith("NetTopologySuite") != true) continue;
                        var orig = entry.OriginalValues[property.Name];
                        var curr = entry.CurrentValues[property.Name];
                        if (!Equals(orig, curr))
                            changes[property.Name] = new { From = "(geometry)", To = "(updated geometry)" };
                    }
                    
                    if (changes.Count > 0)
                    {
                        var jsonOptions = new JsonSerializerOptions
                        {
                            NumberHandling = System.Text.Json.Serialization.JsonNumberHandling.AllowNamedFloatingPointLiterals
                        };
                        auditEntry.Changes = JsonSerializer.Serialize(changes, jsonOptions);
                        auditEntry.Description = $"Updated {string.Join(", ", changes.Keys)}";
                    }
                    else
                    {
                        continue; 
                    }
                    break;

                case EntityState.Deleted:
                    auditEntry.Action = "Delete";
                    auditEntry.Description = $"Deleted {entityName}";
                    break;
            }

            auditEntries.Add(auditEntry);
        }

        if (auditEntries.Count > 0)
        {
            db.ChangeLogs.AddRange(auditEntries);
        }

        await db.SaveChangesAsync();
    }
}
