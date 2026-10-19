using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using NetTopologySuite.Geometries;
using Utanvega.Backend.Application.Events;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Weather.Queries;

// DTO returned to the frontend — historical climate normals ("usually"), not a forecast.
// Distinct from WeatherDto/GetTrailWeatherQuery (live forecast, "forecast") so the two can coexist
// on event-detail pages without confusing a visitor about which number is which.
// Lat/Lon are the coordinate the climate was actually resolved from (GpxPointLat/Lng, or
// Location.Center as fallback — see the Handle method below) so the frontend can fall back to
// showing coordinates when the event has no linked Location to name (#1411).
// IsApproximate (#1414) flags when that coordinate came from a broad Location (Country/Area/
// Region) rather than a precise point — a GPX point, or a Municipality/Place-type Location, is
// never approximate.
// IsStartPoint (#1415) flags when that coordinate came from the event's own GpxPointLat/Lng — by
// the TrailStartPicker convention that field is the race's start point, not a route-wide point, so
// the frontend can label the climate as "at the start" rather than implying it covers the whole
// trail. Mutually exclusive with IsApproximate: the GPX-pin branch is never approximate, and the
// Location-fallback branch (approximate or not) is never the start point.
public record ClimateDto(
    double AverageHigh,
    double AverageLow,
    double AveragePrecipitation,
    double PrecipitationChance,
    double AverageMaxWind,
    int YearsOfData,
    int TargetMonth,
    int TargetDay,
    double Lat,
    double Lon,
    bool IsApproximate,
    bool IsStartPoint
);

// #1416: wraps one or two ClimateDto results — Finish is only populated when the event's relevant
// edition has a PointToPoint primary trail long/steep enough that its start and finish are worth
// showing separately (see GetEventClimateQueryHandler.ResolvePointToPointEndpointsAsync). Start
// alone (Finish null) is exactly today's single-coordinate behavior, unchanged.
public record EventClimateDto(ClimateDto Start, ClimateDto? Finish);

// MediatR query — TargetMonth/TargetDay are a concrete calendar date already resolved by the
// caller (event.displayDate ?? event.nextEditionDate), not a ScheduleRule re-interpreted here.
// Climate is event data, not trail data — an event's own GpxPointLat/Lng (falling back to its
// Location's center) is the coordinate source, not any race's attached trail, *unless* the
// two-coordinate point-to-point split below applies. An event with no trail at all can still show
// its climate card.
public record GetEventClimateQuery(string Slug, int TargetMonth, int TargetDay) : IRequest<EventClimateDto?>;

public class GetEventClimateQueryHandler : IRequestHandler<GetEventClimateQuery, EventClimateDto?>
{
    private readonly UtanvegaDbContext _context;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IMemoryCache _cache;
    private readonly ILogger<GetEventClimateQueryHandler> _logger;

    private const int YearsOfHistory = 15;
    private const int WindowDays = 5;

    // Open-Meteo reports precipitation in mm; below this a "rainy" day is really just dew/mist noise.
    private const double MeasurablePrecipitationMm = 0.1;

    // #1416: minimum "effort distance" (DifficultyCalculator's distance_km + elevationGain_m/100)
    // a PointToPoint trail must reach before its start and finish are worth showing as two separate
    // climate cards — below this, the two ends are close/flat enough that one coordinate is a fair
    // stand-in for the whole route. Set to 25, the same number DifficultyCalculator's
    // TrailRunningThresholds uses as the Moderate→Hard boundary: a trail "Hard" or harder for a
    // trail runner is long/steep enough that its start and finish can plausibly sit in different
    // microclimates (coastal start, highland finish, etc.). Adjustable later without a schema
    // change — this is a constant, not a stored threshold.
    private const double MinPointToPointEffortKm = 25;

    private static readonly TimeSpan CacheDuration = TimeSpan.FromDays(7);

    public GetEventClimateQueryHandler(
        UtanvegaDbContext context,
        IHttpClientFactory httpClientFactory,
        IMemoryCache cache,
        ILogger<GetEventClimateQueryHandler> logger)
    {
        _context = context;
        _httpClientFactory = httpClientFactory;
        _cache = cache;
        _logger = logger;
    }

    public async Task<EventClimateDto?> Handle(GetEventClimateQuery request, CancellationToken cancellationToken)
    {
        var cacheKey = $"climate:event:{request.Slug}:{request.TargetMonth}:{request.TargetDay}";
        if (_cache.TryGetValue(cacheKey, out EventClimateDto? cached))
            return cached;

        // #1416: Editions/Races loaded alongside the existing Location include so
        // ResolvePointToPointEndpointsAsync below can resolve the relevant edition's primary trail
        // without a second round-trip for the event itself — AsNoTracking preserved from before.
        var @event = await _context.Events
            .AsNoTracking()
            .AsSplitQuery()
            .Include(e => e.Location)
            .Include(e => e.Editions)
                .ThenInclude(ed => ed.Races)
            .FirstOrDefaultAsync(e => e.Slug == request.Slug, cancellationToken);

        if (@event == null)
            return null;

        // Event's own GPS point first, Location's center as fallback — never a race's trail.
        double lat, lon;
        bool isApproximate;
        bool isStartPoint;
        if (@event.GpxPointLat is { } gpxLat && @event.GpxPointLng is { } gpxLng)
        {
            lat = gpxLat;
            lon = gpxLng;
            isApproximate = false;
            isStartPoint = true;
        }
        else if (@event.Location?.Center is { } center)
        {
            lat = center.Y;
            lon = center.X;
            // #1414: only a broad Location (whole country/area/region) makes the climate an
            // estimate — a Municipality/Place-type Location is precise enough to trust as-is.
            isApproximate = @event.Location.Type is LocationType.Country or LocationType.Area or LocationType.Region;
            isStartPoint = false;
        }
        else
        {
            return null;
        }

        // #1416: a long point-to-point race's start and finish can sit in meaningfully different
        // microclimates (e.g. coastal start, highland finish) — when the relevant edition's
        // primary trail qualifies, fetch both ends as two distinct results instead of one blended
        // coordinate. Mirrors GetEventQuery's relevantEdition/primaryTrailId resolution rather than
        // reinventing it (see GetEventQuery.cs:216-222,:321).
        EventClimateDto? result = null;
        var endpoints = await ResolvePointToPointEndpointsAsync(@event, cancellationToken);
        if (endpoints != null)
        {
            var (startLat, startLon, endLat, endLon) = endpoints.Value;
            var startClimate = await FetchClimateAsync(startLat, startLon, request.TargetMonth, request.TargetDay, isApproximate: false, isStartPoint: true, cancellationToken);
            var finishClimate = await FetchClimateAsync(endLat, endLon, request.TargetMonth, request.TargetDay, isApproximate: false, isStartPoint: false, cancellationToken);
            if (startClimate != null && finishClimate != null)
                result = new EventClimateDto(startClimate, finishClimate);
        }

        // Either the trail didn't qualify for the two-coordinate split, or one of the two archive
        // calls above came back empty/failed — fall back to today's single-coordinate behavior.
        if (result == null)
        {
            var single = await FetchClimateAsync(lat, lon, request.TargetMonth, request.TargetDay, isApproximate, isStartPoint, cancellationToken);
            result = single != null ? new EventClimateDto(single, null) : null;
        }

        if (result == null)
            return null;

        _cache.Set(cacheKey, result, CacheDuration);

        return result;
    }

    // Shared by the single-coordinate fallback and both ends of the two-coordinate point-to-point
    // split — the FetchArchiveAsync + Aggregate steps are identical either way, only the coordinate
    // and the two DTO flags (isApproximate/isStartPoint) differ per call site.
    private async Task<ClimateDto?> FetchClimateAsync(double lat, double lon, int targetMonth, int targetDay, bool isApproximate, bool isStartPoint, CancellationToken cancellationToken)
    {
        var currentYear = DateTime.UtcNow.Year;
        // Full past years only — the current year's target date may not have happened yet, which
        // would make the archive API return a short/empty window for it.
        var years = Enumerable.Range(currentYear - YearsOfHistory, YearsOfHistory).ToList();

        // #1356: one wide call spanning the earliest year's window through the latest year's
        // window, instead of YearsOfHistory separate narrow calls — Aggregate below does the
        // ±WindowDays filtering per year client-side, since the response is no longer pre-windowed.
        var firstYear = years[0];
        var firstDay = Math.Min(targetDay, DateTime.DaysInMonth(firstYear, targetMonth));
        var startDate = new DateTime(firstYear, targetMonth, firstDay).AddDays(-WindowDays);

        var lastYear = years[^1];
        var lastDay = Math.Min(targetDay, DateTime.DaysInMonth(lastYear, targetMonth));
        var endDate = new DateTime(lastYear, targetMonth, lastDay).AddDays(WindowDays);

        var response = await FetchArchiveAsync(lat, lon, startDate, endDate, cancellationToken);

        return Aggregate(response, years, targetMonth, targetDay, WindowDays, lat, lon, isApproximate, isStartPoint);
    }

    // #1416: resolves the event's relevant edition (mirroring GetEventQuery.cs:321's
    // ongoingEdition/recentlyCompleted/next-upcoming fallback chain) and, within it, the primary
    // trail — the longest non-hidden race's trail (mirroring GetEventQuery.cs:216-222) — then
    // returns its GpxData LineString's start/end coordinates if, and only if, that trail is
    // PointToPoint and meets MinPointToPointEffortKm. Returns null for every other case (no
    // relevant edition, no linked trail, wrong TrailType, below threshold, or no/degenerate GPX
    // geometry) so the caller falls back to the single-coordinate behavior unchanged.
    private async Task<(double StartLat, double StartLon, double EndLat, double EndLon)?> ResolvePointToPointEndpointsAsync(Event ev, CancellationToken cancellationToken)
    {
        // Climate has no admin/IncludeHidden variant — always the public view of editions.
        var publicEditions = ev.Editions.Where(ed => ed.Status != EditionStatus.Hidden).ToList();
        if (publicEditions.Count == 0)
            return null;

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var effectiveEditionDates = ev.Editions.ToDictionary(
            ed => ed.Id,
            ed => EditionStatusHelpers.ComputeEffectiveEditionDates(
                ev.Type, ed.Date, ed.EndDate,
                EditionStatusHelpers.SeriesRaceDates(ed.Races)));

        DateOnly? EffDate(EventEdition? ed) => ed != null ? effectiveEditionDates[ed.Id].Date : null;
        DateOnly? EffEndDate(EventEdition? ed) => ed != null ? effectiveEditionDates[ed.Id].EndDate : null;

        var ongoingEdition = publicEditions.FirstOrDefault(ed =>
            EffDate(ed).HasValue && EffDate(ed)!.Value <= today &&
            (EffEndDate(ed) ?? EffDate(ed)).HasValue && (EffEndDate(ed) ?? EffDate(ed))!.Value >= today);

        var mostRecentPast = publicEditions
            .Where(ed => (EffEndDate(ed) ?? EffDate(ed)).HasValue && (EffEndDate(ed) ?? EffDate(ed))!.Value < today)
            .OrderByDescending(ed => EffEndDate(ed) ?? EffDate(ed))
            .Select(ed => EffEndDate(ed) ?? EffDate(ed))
            .FirstOrDefault();

        var recentlyCompleted = ev.Status != EventStatus.Cancelled
            && ongoingEdition == null
            && mostRecentPast.HasValue
            && (today.DayNumber - mostRecentPast.Value.DayNumber) <= 3;

        var relevantEdition = ongoingEdition
            ?? (recentlyCompleted
                ? publicEditions.FirstOrDefault(ed => (EffEndDate(ed) ?? EffDate(ed)) == mostRecentPast)
                : publicEditions
                    .Where(ed => EffDate(ed).HasValue && EffDate(ed)!.Value >= today)
                    .OrderBy(ed => EffDate(ed))
                    .FirstOrDefault());

        if (relevantEdition == null)
            return null;

        var candidateTrailIds = relevantEdition.Races
            .Where(r => r.Status != RaceStatus.Hidden && r.TrailId.HasValue)
            .Select(r => r.TrailId!.Value)
            .Distinct()
            .ToHashSet();

        if (candidateTrailIds.Count == 0)
            return null;

        var trailLookup = (await _context.Trails
            .AsNoTracking()
            .Where(t => candidateTrailIds.Contains(t.Id))
            .Select(t => new { t.Id, t.Length, t.ElevationGain, t.Type, t.GpxData })
            .ToListAsync(cancellationToken))
            .ToDictionary(t => t.Id, t => t);

        var primaryTrailId = relevantEdition.Races
            .Where(r => r.Status != RaceStatus.Hidden && r.TrailId.HasValue && trailLookup.ContainsKey(r.TrailId.Value))
            .OrderByDescending(r => trailLookup[r.TrailId!.Value].Length)
            .ThenBy(r => r.Id)
            .Select(r => r.TrailId)
            .FirstOrDefault();

        if (primaryTrailId is not { } trailId || !trailLookup.TryGetValue(trailId, out var trail))
            return null;

        if (trail.Type != TrailType.PointToPoint)
            return null;

        var effortKm = (trail.Length / 1000.0) + (trail.ElevationGain / 100.0);
        if (effortKm < MinPointToPointEffortKm)
            return null;

        if (trail.GpxData is not LineString line || line.NumPoints < 2)
            return null;

        return (line.StartPoint.Y, line.StartPoint.X, line.EndPoint.Y, line.EndPoint.X);
    }

    // #1356: a single wide-range call (startDate..endDate spans every year's ±WindowDays window)
    // replaces the former YearsOfHistory per-year calls — Aggregate below does the per-year
    // windowing that FetchArchiveAsync's start_date/end_date used to do per call.
    private async Task<OpenMeteoArchiveResponse?> FetchArchiveAsync(double lat, double lon, DateTime startDate, DateTime endDate, CancellationToken cancellationToken)
    {
        var client = _httpClientFactory.CreateClient("OpenMeteo");
        var latStr = lat.ToString(CultureInfo.InvariantCulture);
        var lonStr = lon.ToString(CultureInfo.InvariantCulture);
        var startStr = startDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var endStr = endDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

        var url = $"https://archive-api.open-meteo.com/v1/archive?latitude={latStr}&longitude={lonStr}" +
                  $"&start_date={startStr}&end_date={endStr}" +
                  "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max" +
                  "&timezone=Atlantic/Reykjavik&wind_speed_unit=ms";

        try
        {
            return await client.GetFromJsonAsync<OpenMeteoArchiveResponse>(url, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Open-Meteo archive API call failed for coordinates ({Lat}, {Lon}), range {Start}–{End}", lat, lon, startStr, endStr);
            return null;
        }
    }

    // Walks the single wide response's daily.Time array, keeping only the days that fall within
    // ±windowDays of (targetMonth, targetDay) in at least one of `years` — the response itself is
    // no longer pre-windowed per year (#1356), so that filtering happens here instead of in
    // FetchArchiveAsync's start_date/end_date. Internal (not private) so backend.Tests can exercise
    // the aggregation math directly, without mocking HTTP.
    internal static ClimateDto? Aggregate(OpenMeteoArchiveResponse? response, IReadOnlyList<int> years, int targetMonth, int targetDay, int windowDays, double lat, double lon, bool isApproximate = false, bool isStartPoint = false)
    {
        var daily = response?.Daily;
        if (daily == null || daily.Time.Count == 0)
            return null;

        // One ±windowDays anniversary window per year — same day-of-month clamping (e.g. Feb 29
        // in a non-leap year) FetchArchiveAsync's start/end dates used before #1356.
        var yearWindows = years
            .Select(year =>
            {
                var day = Math.Min(targetDay, DateTime.DaysInMonth(year, targetMonth));
                var targetDate = new DateTime(year, targetMonth, day);
                return (Start: targetDate.AddDays(-windowDays), End: targetDate.AddDays(windowDays));
            })
            .ToList();

        var highs = new List<double>();
        var lows = new List<double>();
        var precipValues = new List<double>();
        var windValues = new List<double>();
        var wetDays = 0;
        var yearsWithData = new HashSet<int>();

        for (var i = 0; i < daily.Time.Count; i++)
        {
            if (!DateTime.TryParse(daily.Time[i], CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
                continue;

            // A day only counts if it falls inside some year's window — the wide response also
            // includes the days between windows, which belong to no year and must be excluded.
            var windowIndex = yearWindows.FindIndex(w => date >= w.Start && date <= w.End);
            if (windowIndex < 0)
                continue;

            yearsWithData.Add(windowIndex);

            var hi = daily.Temperature2mMax.ElementAtOrDefault(i);
            var lo = daily.Temperature2mMin.ElementAtOrDefault(i);
            var precip = daily.PrecipitationSum.ElementAtOrDefault(i);
            var wind = daily.WindSpeed10mMax.ElementAtOrDefault(i);

            if (hi.HasValue) highs.Add(hi.Value);
            if (lo.HasValue) lows.Add(lo.Value);
            if (wind.HasValue) windValues.Add(wind.Value);
            if (precip.HasValue)
            {
                precipValues.Add(precip.Value);
                if (precip.Value >= MeasurablePrecipitationMm) wetDays++;
            }
        }

        if (highs.Count == 0 || lows.Count == 0 || yearsWithData.Count == 0)
            return null;

        return new ClimateDto(
            Math.Round(highs.Average(), 1),
            Math.Round(lows.Average(), 1),
            Math.Round(precipValues.Count > 0 ? precipValues.Average() : 0, 1),
            Math.Round(precipValues.Count > 0 ? (double)wetDays / precipValues.Count : 0, 2),
            Math.Round(windValues.Count > 0 ? windValues.Average() : 0, 1),
            yearsWithData.Count,
            targetMonth,
            targetDay,
            lat,
            lon,
            isApproximate,
            isStartPoint
        );
    }
}

// Open-Meteo archive API response models — a subset of GetTrailWeatherQuery's OpenMeteoResponse
// shape, scoped to the daily aggregates this query needs. Values are nullable because Open-Meteo
// returns null (not 0) for days it has no reanalysis data for yet.
public class OpenMeteoArchiveResponse
{
    [JsonPropertyName("daily")]
    public OpenMeteoArchiveDaily? Daily { get; set; }
}

public class OpenMeteoArchiveDaily
{
    [JsonPropertyName("time")]
    public List<string> Time { get; set; } = [];

    [JsonPropertyName("temperature_2m_max")]
    public List<double?> Temperature2mMax { get; set; } = [];

    [JsonPropertyName("temperature_2m_min")]
    public List<double?> Temperature2mMin { get; set; } = [];

    [JsonPropertyName("precipitation_sum")]
    public List<double?> PrecipitationSum { get; set; } = [];

    [JsonPropertyName("wind_speed_10m_max")]
    public List<double?> WindSpeed10mMax { get; set; } = [];
}
