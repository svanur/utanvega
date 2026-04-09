using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using NetTopologySuite.Geometries;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Weather.Queries;

// DTOs returned to the frontend
public record WeatherDto(
    WeatherPointDto Current,
    List<HourlyForecastDto> Hourly,
    List<DailyForecastDto> Daily,
    WeatherPointDto? Summit,
    TrailCondition Condition
);

public record WeatherPointDto(
    double Latitude,
    double Longitude,
    double Elevation,
    double Temperature,
    double ApparentTemperature,
    double WindSpeed,
    double WindGusts,
    double Precipitation,
    int WeatherCode,
    int CloudCover,
    string Label
);

public record HourlyForecastDto(
    string Time,
    double Temperature,
    double ApparentTemperature,
    double WindSpeed,
    double WindGusts,
    double Precipitation,
    int WeatherCode,
    int CloudCover
);

public record DailyForecastDto(
    string Date,
    double TemperatureMax,
    double TemperatureMin,
    double PrecipitationSum,
    double WindSpeedMax,
    double WindGustsMax,
    int WeatherCode
);

public enum TrailCondition
{
    Good,
    Fair,
    Poor
}

// MediatR query
public record GetTrailWeatherQuery(string Slug) : IRequest<WeatherDto?>;

public class GetTrailWeatherQueryHandler : IRequestHandler<GetTrailWeatherQuery, WeatherDto?>
{
    private readonly UtanvegaDbContext _context;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IMemoryCache _cache;

    private const int ElevationThresholdMeters = 300;
    private const int HighlandElevationThreshold = 200;
    private const int HighlandAltitudeMinMeters = 400;
    private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(30);

    public GetTrailWeatherQueryHandler(
        UtanvegaDbContext context,
        IHttpClientFactory httpClientFactory,
        IMemoryCache cache)
    {
        _context = context;
        _httpClientFactory = httpClientFactory;
        _cache = cache;
    }

    public async Task<WeatherDto?> Handle(GetTrailWeatherQuery request, CancellationToken cancellationToken)
    {
        var cacheKey = $"weather:{request.Slug}";
        if (_cache.TryGetValue(cacheKey, out WeatherDto? cached))
            return cached;

        var trail = await _context.Trails
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Slug == request.Slug && t.Status == TrailStatus.Published, cancellationToken);

        if (trail?.GpxData == null)
            return null;

        var coords = trail.GpxData.Coordinates;
        if (coords.Length == 0)
            return null;

        var startCoord = coords[0];
        var highestCoord = coords[0];

        foreach (var c in coords)
        {
            if (!double.IsNaN(c.Z) && (double.IsNaN(highestCoord.Z) || c.Z > highestCoord.Z))
                highestCoord = c;
        }

        var lowestZ = double.MaxValue;
        foreach (var c in coords)
        {
            if (!double.IsNaN(c.Z) && c.Z < lowestZ)
                lowestZ = c.Z;
        }

        var elevationDiff = double.IsNaN(highestCoord.Z) || lowestZ == double.MaxValue
            ? 0
            : highestCoord.Z - lowestZ;

        var hasSummit = elevationDiff >= ElevationThresholdMeters
            || (elevationDiff >= HighlandElevationThreshold
                && !double.IsNaN(highestCoord.Z)
                && highestCoord.Z >= HighlandAltitudeMinMeters);

        // Fetch weather for start point
        var startWeather = await FetchWeatherAsync(startCoord.Y, startCoord.X, cancellationToken);
        if (startWeather == null)
            return null;

        // Current conditions at start
        var current = ExtractCurrent(startWeather, startCoord.Y, startCoord.X,
            double.IsNaN(startCoord.Z) ? startWeather.Elevation ?? 0 : startCoord.Z, "start");

        // Hourly (next 24h)
        var hourly = ExtractHourly(startWeather);

        // Daily (next 5 days)
        var daily = ExtractDaily(startWeather);

        // Summit weather if significant elevation difference
        WeatherPointDto? summitPoint = null;
        if (hasSummit)
        {
            var summitWeather = await FetchWeatherAsync(highestCoord.Y, highestCoord.X, cancellationToken);
            if (summitWeather != null)
            {
                summitPoint = ExtractCurrent(summitWeather, highestCoord.Y, highestCoord.X,
                    double.IsNaN(highestCoord.Z) ? summitWeather.Elevation ?? 0 : highestCoord.Z, "summit");
            }
        }

        // Determine trail condition based on worst conditions (current or summit)
        var condition = DetermineCondition(current, summitPoint);

        var result = new WeatherDto(current, hourly, daily, summitPoint, condition);

        _cache.Set(cacheKey, result, CacheDuration);

        return result;
    }

    private async Task<OpenMeteoResponse?> FetchWeatherAsync(double lat, double lon, CancellationToken cancellationToken)
    {
        var client = _httpClientFactory.CreateClient("OpenMeteo");
        var latStr = lat.ToString(CultureInfo.InvariantCulture);
        var lonStr = lon.ToString(CultureInfo.InvariantCulture);

        var url = $"https://api.open-meteo.com/v1/forecast?latitude={latStr}&longitude={lonStr}" +
                  "&current=temperature_2m,apparent_temperature,wind_speed_10m,wind_gusts_10m,precipitation,weather_code,cloud_cover" +
                  "&hourly=temperature_2m,apparent_temperature,wind_speed_10m,wind_gusts_10m,precipitation,weather_code,cloud_cover" +
                  "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,weather_code" +
                  "&forecast_days=5&timezone=Atlantic/Reykjavik&wind_speed_unit=ms";

        try
        {
            var response = await client.GetFromJsonAsync<OpenMeteoResponse>(url, cancellationToken);
            return response;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[WARN] Open-Meteo API call failed: {ex.Message}");
            return null;
        }
    }

    private static WeatherPointDto ExtractCurrent(OpenMeteoResponse response, double lat, double lon, double elevation, string label)
    {
        var c = response.Current!;
        return new WeatherPointDto(
            lat, lon, Math.Round(elevation, 0),
            c.Temperature2m,
            c.ApparentTemperature,
            c.WindSpeed10m,
            c.WindGusts10m,
            c.Precipitation,
            c.WeatherCode,
            c.CloudCover,
            label
        );
    }

    private static List<HourlyForecastDto> ExtractHourly(OpenMeteoResponse response)
    {
        var h = response.Hourly!;
        var now = DateTime.UtcNow;
        var result = new List<HourlyForecastDto>();

        for (int i = 0; i < h.Time.Count && result.Count < 24; i++)
        {
            if (DateTime.TryParse(h.Time[i], out var time) && time >= now.AddHours(-1))
            {
                result.Add(new HourlyForecastDto(
                    h.Time[i],
                    h.Temperature2m[i],
                    h.ApparentTemperature[i],
                    h.WindSpeed10m[i],
                    h.WindGusts10m[i],
                    h.Precipitation[i],
                    (int)h.WeatherCode[i],
                    (int)h.CloudCover[i]
                ));
            }
        }

        return result;
    }

    private static List<DailyForecastDto> ExtractDaily(OpenMeteoResponse response)
    {
        var d = response.Daily!;
        var result = new List<DailyForecastDto>();

        for (int i = 0; i < d.Time.Count; i++)
        {
            result.Add(new DailyForecastDto(
                d.Time[i],
                d.Temperature2mMax[i],
                d.Temperature2mMin[i],
                d.PrecipitationSum[i],
                d.WindSpeed10mMax[i],
                d.WindGusts10mMax[i],
                (int)d.WeatherCode[i]
            ));
        }

        return result;
    }

    private static TrailCondition DetermineCondition(WeatherPointDto current, WeatherPointDto? summit)
    {
        // Use worst conditions between start and summit
        var windSpeed = current.WindSpeed;
        var windGusts = current.WindGusts;
        var precipitation = current.Precipitation;
        var feelsLike = current.ApparentTemperature;
        var weatherCode = current.WeatherCode;

        if (summit != null)
        {
            windSpeed = Math.Max(windSpeed, summit.WindSpeed);
            windGusts = Math.Max(windGusts, summit.WindGusts);
            precipitation = Math.Max(precipitation, summit.Precipitation);
            feelsLike = Math.Min(feelsLike, summit.ApparentTemperature);
            weatherCode = Math.Max(weatherCode, summit.WeatherCode);
        }

        var isSnow = weatherCode is >= 71 and <= 77;
        var isThunderstorm = weatherCode is >= 95 and <= 99;
        var isFog = weatherCode is 45 or 48;

        // Poor: dangerous conditions
        if (windSpeed > 18 || windGusts > 25 || precipitation > 4 || feelsLike < -15 || isThunderstorm)
            return TrailCondition.Poor;

        // Fair: challenging but manageable
        if (windSpeed > 10 || windGusts > 15 || precipitation > 0.5 || feelsLike < -5 || isSnow || isFog)
            return TrailCondition.Fair;

        return TrailCondition.Good;
    }
}

// Open-Meteo API response models
public class OpenMeteoResponse
{
    [JsonPropertyName("elevation")]
    public double? Elevation { get; set; }

    [JsonPropertyName("current")]
    public OpenMeteoCurrent? Current { get; set; }

    [JsonPropertyName("hourly")]
    public OpenMeteoHourly? Hourly { get; set; }

    [JsonPropertyName("daily")]
    public OpenMeteoDaily? Daily { get; set; }
}

public class OpenMeteoCurrent
{
    [JsonPropertyName("temperature_2m")]
    public double Temperature2m { get; set; }

    [JsonPropertyName("apparent_temperature")]
    public double ApparentTemperature { get; set; }

    [JsonPropertyName("wind_speed_10m")]
    public double WindSpeed10m { get; set; }

    [JsonPropertyName("wind_gusts_10m")]
    public double WindGusts10m { get; set; }

    [JsonPropertyName("precipitation")]
    public double Precipitation { get; set; }

    [JsonPropertyName("weather_code")]
    public int WeatherCode { get; set; }

    [JsonPropertyName("cloud_cover")]
    public int CloudCover { get; set; }
}

public class OpenMeteoHourly
{
    [JsonPropertyName("time")]
    public List<string> Time { get; set; } = [];

    [JsonPropertyName("temperature_2m")]
    public List<double> Temperature2m { get; set; } = [];

    [JsonPropertyName("apparent_temperature")]
    public List<double> ApparentTemperature { get; set; } = [];

    [JsonPropertyName("wind_speed_10m")]
    public List<double> WindSpeed10m { get; set; } = [];

    [JsonPropertyName("wind_gusts_10m")]
    public List<double> WindGusts10m { get; set; } = [];

    [JsonPropertyName("precipitation")]
    public List<double> Precipitation { get; set; } = [];

    [JsonPropertyName("weather_code")]
    public List<double> WeatherCode { get; set; } = [];

    [JsonPropertyName("cloud_cover")]
    public List<double> CloudCover { get; set; } = [];
}

public class OpenMeteoDaily
{
    [JsonPropertyName("time")]
    public List<string> Time { get; set; } = [];

    [JsonPropertyName("temperature_2m_max")]
    public List<double> Temperature2mMax { get; set; } = [];

    [JsonPropertyName("temperature_2m_min")]
    public List<double> Temperature2mMin { get; set; } = [];

    [JsonPropertyName("precipitation_sum")]
    public List<double> PrecipitationSum { get; set; } = [];

    [JsonPropertyName("wind_speed_10m_max")]
    public List<double> WindSpeed10mMax { get; set; } = [];

    [JsonPropertyName("wind_gusts_10m_max")]
    public List<double> WindGusts10mMax { get; set; } = [];

    [JsonPropertyName("weather_code")]
    public List<double> WeatherCode { get; set; } = [];
}
