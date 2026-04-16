namespace Utanvega.Backend.Core.Entities;

using System.Text.Json.Serialization;

/// <summary>
/// Recurring schedule pattern stored as JSON on Competition.
/// Supports yearly events ("2nd Saturday of July"), seasonal series
/// ("every Thursday Oct–Mar"), and fixed one-off dates.
/// </summary>
public class ScheduleRule
{
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public ScheduleType Type { get; set; }

    /// <summary>Month (1-12) for yearly events.</summary>
    public int? Month { get; set; }

    /// <summary>Week-of-month: 1–4, or -1 for "last". Used with DayOfWeek.</summary>
    public int? WeekOfMonth { get; set; }

    /// <summary>Day of month (1-31) for yearly events on a specific calendar date (e.g. Dec 31).</summary>
    public int? DayOfMonth { get; set; }

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public DayOfWeek? DayOfWeek { get; set; }

    /// <summary>Start month (1-12) for seasonal series.</summary>
    public int? MonthStart { get; set; }

    /// <summary>End month (1-12) for seasonal series. Can wrap (e.g., 10→3).</summary>
    public int? MonthEnd { get; set; }

    /// <summary>Specific date for fixed/one-off events.</summary>
    public DateOnly? Date { get; set; }
}

public enum ScheduleType
{
    Yearly,
    Seasonal,
    Fixed,
}
