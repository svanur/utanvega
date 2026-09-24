namespace Utanvega.Backend.Application.Events.Queries.GetEvents;

using Utanvega.Backend.Application.PhotoGalleries;
using Utanvega.Backend.Core.Entities;

public record RaceDistanceSummaryDto(
    string Label,
    string? TicketStatus
);

public record SeriesRaceDto(
    Guid RaceId,
    string RaceName,
    string? RaceNameEn,
    DateOnly? DateOfRace,
    TimeOnly? StartTime,
    string? DistanceLabel,
    string? DistanceLabelEn,
    string TicketStatus,
    string? RegistrationUrl
);

public record EventSummaryDto(
    Guid Id,
    string Name,
    string Slug,
    string? Description,
    string? NameEn,
    string? DescriptionEn,
    string Type,
    string ActivityType,
    string Status,
    string? OrganizerName,
    string? OrganizerNameEn,
    string? OrganizerWebsite,
    Guid? OrganizerId,
    string? AlertMessage,
    string? AlertMessageEn,
    string? AlertSeverity,
    Guid? LocationId,
    string? LocationName,
    ScheduleRule? ScheduleRule,
    List<SocialLink>? SocialLinks,
    DateOnly? NextEditionDate,
    int? DaysUntil,
    int EditionCount,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    DateOnly? DisplayDate = null,
    List<RaceDistanceSummaryDto>? Distances = null,
    string? RegistrationUrl = null,
    string? RegistrationStatus = null,
    string? ResultsUrl = null,
    List<string>? Certifications = null,
    string? YoutubeUrl = null,
    List<string>? ChampionshipCategories = null,
    List<int>? ItraPoints = null,
    List<SeriesRaceDto>? SeriesRaces = null,
    double? GpxPointLat = null,
    double? GpxPointLng = null,
    bool IsMountainRace = false,
    string? TerrainType = null,
    bool HasFutureEdition = false,
    DateOnly? EndDisplayDate = null,
    List<string>? ActivityTypes = null,
    string? EditionStatus = null,
    bool EditionEffectiveCancelled = false,
    string? OrganizerSlug = null,
    List<PublicPhotoGalleryDto>? Galleries = null,
    // Aggregate across this event's editions, not the same thing as EventEditionDto.NeedsReview
    // (a single edition's own flag) — true when at least one edition is bookmarked for review, so
    // the admin events list can filter to "events with something to look at" without fetching the
    // full edition list per row.
    bool AnyEditionNeedsReview = false,
    // Raw registration close instant for the relevant edition, alongside the already-derived
    // RegistrationStatus string — lets the frontend gate UI (e.g. the resale link) on "has
    // registration actually closed" without re-deriving it from RegistrationStatus alone.
    DateTime? RegistrationCloses = null
);

public record RaceDto(
    Guid Id,
    Guid EventEditionId,
    Guid? TrailId,
    string? TrailName,
    string? TrailSlug,
    string Name,
    string? NameEn,
    string? DistanceLabel,
    string? DistanceLabelEn,
    int? CutoffMinutes,
    string? Description,
    string? DescriptionEn,
    string Status,
    int SortOrder,
    string TicketStatus,
    int? MaxParticipants,
    int? ItraPoints,
    string? CertifiedBy,
    string? CertifiedByEn,
    decimal PrizeMoney,
    string? ChampionshipCategory,
    string? ChampionshipCategoryEn,
    DateOnly? DateOfRace,
    TimeOnly? StartTime,
    double? TrailDistanceMeters,
    double? TrailElevationGain,
    string? TrailTerrainType = null,
    string? TrailDifficulty = null,
    string? TrailActivityType = null,
    Dictionary<string, string>? TranslationHashes = null,
    string? ActivityType = null,
    string ResultType = "Time"
);

public record EventEditionDto(
    Guid Id,
    Guid EventId,
    int? Year,
    DateOnly? Date,
    DateOnly? EndDate,
    string? Title,
    string? TitleEn,
    string? RegistrationUrl,
    string? ResultsUrl,
    string? Notes,
    string? NotesEn,
    string RegistrationStatus,
    Guid? TrailId,
    string? TrailName,
    string? TrailSlug,
    List<RaceDto> Races,
    List<PublicPhotoGalleryDto> Galleries,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    Dictionary<string, string>? TranslationHashes = null,
    string Status = "Active",
    bool EffectiveCancelled = false,
    DateTime? RegistrationOpens = null,
    DateTime? RegistrationCloses = null,
    bool NeedsReview = false,
    // #927: same "primary race" concept as EditionHistoryRowDto (backend/Application/Events/Queries/
    // GetEditionsHistory/GetEditionsHistoryQuery.cs) — among this edition's races, the one whose
    // linked trail has the greatest Length. Both null when no race is linked to a trail; reimplemented
    // in GetEventQueryHandler rather than shared, since the two queries' edition shapes differ.
    double[]? PrimaryElevationProfile = null,
    string? PrimaryTerrainType = null
);
