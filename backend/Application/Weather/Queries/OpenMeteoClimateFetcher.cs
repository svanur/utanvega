using System.Globalization;
using System.Net.Http.Json;

namespace Utanvega.Backend.Application.Weather.Queries;

// #1817: FetchClimateAsync/FetchArchiveAsync used to be near-identical private copies on
// GetEventClimateQueryHandler and GetLocationClimateQueryHandler (the latter mirrored rather than
// extracted when #1801 introduced it, deliberately out of scope for that PR). Both handlers now
// call this single shared implementation instead. It takes IHttpClientFactory/ILogger as
// parameters rather than as its own injected dependencies, since it isn't registered in DI — each
// handler still owns its constructor-injected factory/logger and simply forwards them here.
// GetEventClimateQueryHandler.Aggregate (already shared pre-#1817 — see GetLocationClimateQuery.cs)
// is left where it is; only the fetch step moves.
internal static class OpenMeteoClimateFetcher
{
    internal const int YearsOfHistory = 15;
    internal const int WindowDays = 5;

    internal static async Task<ClimateDto?> FetchClimateAsync(
        IHttpClientFactory httpClientFactory,
        ILogger logger,
        double lat,
        double lon,
        int targetMonth,
        int targetDay,
        bool isApproximate,
        CancellationToken cancellationToken)
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

        var response = await FetchArchiveAsync(httpClientFactory, logger, lat, lon, startDate, endDate, cancellationToken);

        return GetEventClimateQueryHandler.Aggregate(response, years, targetMonth, targetDay, WindowDays, lat, lon, isApproximate);
    }

    // #1356: a single wide-range call (startDate..endDate spans every year's ±WindowDays window)
    // replaces the former YearsOfHistory per-year calls — Aggregate does the per-year windowing
    // that FetchArchiveAsync's start_date/end_date used to do per call.
    private static async Task<OpenMeteoArchiveResponse?> FetchArchiveAsync(
        IHttpClientFactory httpClientFactory,
        ILogger logger,
        double lat,
        double lon,
        DateTime startDate,
        DateTime endDate,
        CancellationToken cancellationToken)
    {
        var client = httpClientFactory.CreateClient("OpenMeteo");
        var latStr = lat.ToString(CultureInfo.InvariantCulture);
        var lonStr = lon.ToString(CultureInfo.InvariantCulture);
        var startStr = startDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var endStr = endDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

        var url = $"https://archive-api.open-meteo.com/v1/archive?latitude={latStr}&longitude={lonStr}" +
                  $"&start_date={startStr}&end_date={endStr}" +
                  "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_hours,sunshine_duration,wind_speed_10m_max" +
                  "&timezone=Atlantic/Reykjavik&wind_speed_unit=ms";

        try
        {
            return await client.GetFromJsonAsync<OpenMeteoArchiveResponse>(url, cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Open-Meteo archive API call failed for coordinates ({Lat}, {Lon}), range {Start}–{End}", lat, lon, startStr, endStr);
            return null;
        }
    }
}
