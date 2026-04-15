namespace Utanvega.Backend.Core.Entities;

public class Race
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CompetitionId { get; set; }
    public Competition Competition { get; set; } = null!;

    public Guid? TrailId { get; set; }
    public Trail? Trail { get; set; }

    public string Name { get; set; } = string.Empty;
    public string? DistanceLabel { get; set; }
    public int? CutoffMinutes { get; set; }
    public string? RegistrationUrl { get; set; }
    public string? Description { get; set; }
    public int SortOrder { get; set; }
}
