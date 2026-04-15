using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Core.Services;

namespace Utanvega.Backend.Tests.Services;

public class ScheduleRuleEngineTests
{
    private readonly ScheduleRuleEngine _engine = new();

    // ========== Yearly: "2nd Saturday of July" ==========

    [Fact]
    public void Yearly_SecondSaturdayOfJuly_ReturnsCorrectDate()
    {
        var rule = new ScheduleRule
        {
            Type = ScheduleType.Yearly,
            Month = 7,
            WeekOfMonth = 2,
            DayOfWeek = DayOfWeek.Saturday,
        };

        // 2nd Saturday of July 2026 = July 11
        var result = _engine.GetNextOccurrence(rule, new DateOnly(2026, 1, 1));
        Assert.NotNull(result);
        Assert.Equal(new DateOnly(2026, 7, 11), result.Value);
    }

    [Fact]
    public void Yearly_PastThisYear_ReturnsNextYear()
    {
        var rule = new ScheduleRule
        {
            Type = ScheduleType.Yearly,
            Month = 3,
            WeekOfMonth = 1,
            DayOfWeek = DayOfWeek.Sunday,
        };

        // 1st Sunday of March 2026 = March 1
        // If fromDate is March 15, should return next year's 1st Sunday of March
        var result = _engine.GetNextOccurrence(rule, new DateOnly(2026, 3, 15));
        Assert.NotNull(result);
        Assert.Equal(2027, result.Value.Year);
        Assert.Equal(3, result.Value.Month);
        Assert.Equal(DayOfWeek.Sunday, result.Value.DayOfWeek);
    }

    [Fact]
    public void Yearly_OnExactDate_ReturnsSameDate()
    {
        var rule = new ScheduleRule
        {
            Type = ScheduleType.Yearly,
            Month = 7,
            WeekOfMonth = 2,
            DayOfWeek = DayOfWeek.Saturday,
        };

        // If from == the exact date, it should return it
        var date = new DateOnly(2026, 7, 11); // 2nd Saturday of July 2026
        var result = _engine.GetNextOccurrence(rule, date);
        Assert.Equal(date, result);
    }

    // ========== Yearly: "Last Saturday of August" ==========

    [Fact]
    public void Yearly_LastSaturday_ReturnsCorrectDate()
    {
        var rule = new ScheduleRule
        {
            Type = ScheduleType.Yearly,
            Month = 8,
            WeekOfMonth = -1,
            DayOfWeek = DayOfWeek.Saturday,
        };

        // Last Saturday of August 2026 = August 29
        var result = _engine.GetNextOccurrence(rule, new DateOnly(2026, 1, 1));
        Assert.NotNull(result);
        Assert.Equal(new DateOnly(2026, 8, 29), result.Value);
    }

    // ========== Seasonal: "Every Thursday Oct–Mar" ==========

    [Fact]
    public void Seasonal_EveryThursdayOctToMar_FindsNextInSeason()
    {
        var rule = new ScheduleRule
        {
            Type = ScheduleType.Seasonal,
            MonthStart = 10,
            MonthEnd = 3,
            DayOfWeek = DayOfWeek.Thursday,
        };

        // From Oct 1, 2026 (Wednesday) → next Thursday Oct 2
        var result = _engine.GetNextOccurrence(rule, new DateOnly(2026, 10, 1));
        Assert.NotNull(result);
        Assert.Equal(new DateOnly(2026, 10, 1), result.Value); // Oct 1, 2026 IS a Thursday
    }

    [Fact]
    public void Seasonal_OutOfSeason_SkipsToNextSeason()
    {
        var rule = new ScheduleRule
        {
            Type = ScheduleType.Seasonal,
            MonthStart = 10,
            MonthEnd = 3,
            DayOfWeek = DayOfWeek.Thursday,
        };

        // From June 1, 2026 → should skip to October
        var result = _engine.GetNextOccurrence(rule, new DateOnly(2026, 6, 1));
        Assert.NotNull(result);
        Assert.Equal(10, result.Value.Month);
        Assert.Equal(DayOfWeek.Thursday, result.Value.DayOfWeek);
    }

    [Fact]
    public void Seasonal_WrapAround_IncludesJanFebMar()
    {
        var rule = new ScheduleRule
        {
            Type = ScheduleType.Seasonal,
            MonthStart = 10,
            MonthEnd = 3,
            DayOfWeek = DayOfWeek.Thursday,
        };

        // From January 1, 2026 → should find Thursday in January
        var result = _engine.GetNextOccurrence(rule, new DateOnly(2026, 1, 1));
        Assert.NotNull(result);
        Assert.Equal(DayOfWeek.Thursday, result.Value.DayOfWeek);
        Assert.True(result.Value.Month >= 1 && result.Value.Month <= 3);
    }

    [Fact]
    public void Seasonal_NonWrapping_SummerSeries()
    {
        var rule = new ScheduleRule
        {
            Type = ScheduleType.Seasonal,
            MonthStart = 5,
            MonthEnd = 9,
            DayOfWeek = DayOfWeek.Saturday,
        };

        // From May 1, 2026 (Friday) → next Saturday May 2
        var result = _engine.GetNextOccurrence(rule, new DateOnly(2026, 5, 1));
        Assert.NotNull(result);
        Assert.Equal(new DateOnly(2026, 5, 2), result.Value);
    }

    // ========== Fixed ==========

    [Fact]
    public void Fixed_FutureDate_ReturnsDate()
    {
        var rule = new ScheduleRule
        {
            Type = ScheduleType.Fixed,
            Date = new DateOnly(2026, 6, 15),
        };

        var result = _engine.GetNextOccurrence(rule, new DateOnly(2026, 1, 1));
        Assert.Equal(new DateOnly(2026, 6, 15), result);
    }

    [Fact]
    public void Fixed_PastDate_ReturnsNull()
    {
        var rule = new ScheduleRule
        {
            Type = ScheduleType.Fixed,
            Date = new DateOnly(2025, 6, 15),
        };

        var result = _engine.GetNextOccurrence(rule, new DateOnly(2026, 1, 1));
        Assert.Null(result);
    }

    // ========== GetOccurrencesInRange ==========

    [Fact]
    public void OccurrencesInRange_Yearly_ReturnsMultipleYears()
    {
        var rule = new ScheduleRule
        {
            Type = ScheduleType.Yearly,
            Month = 7,
            WeekOfMonth = 2,
            DayOfWeek = DayOfWeek.Saturday,
        };

        var results = _engine.GetOccurrencesInRange(rule, new DateOnly(2025, 1, 1), new DateOnly(2027, 12, 31));
        Assert.Equal(3, results.Count);
        Assert.All(results, d => Assert.Equal(DayOfWeek.Saturday, d.DayOfWeek));
        Assert.All(results, d => Assert.Equal(7, d.Month));
    }

    [Fact]
    public void OccurrencesInRange_Seasonal_ReturnsAllThursdays()
    {
        var rule = new ScheduleRule
        {
            Type = ScheduleType.Seasonal,
            MonthStart = 1,
            MonthEnd = 1, // January only
            DayOfWeek = DayOfWeek.Thursday,
        };

        var results = _engine.GetOccurrencesInRange(rule, new DateOnly(2026, 1, 1), new DateOnly(2026, 1, 31));
        Assert.All(results, d => Assert.Equal(DayOfWeek.Thursday, d.DayOfWeek));
        Assert.True(results.Count >= 4); // January always has at least 4 Thursdays
    }

    // ========== Edge Cases ==========

    [Fact]
    public void Yearly_MissingFields_ReturnsNull()
    {
        var rule = new ScheduleRule { Type = ScheduleType.Yearly, Month = 7 };
        Assert.Null(_engine.GetNextOccurrence(rule, new DateOnly(2026, 1, 1)));
    }

    [Fact]
    public void Seasonal_MissingFields_ReturnsNull()
    {
        var rule = new ScheduleRule { Type = ScheduleType.Seasonal };
        Assert.Null(_engine.GetNextOccurrence(rule, new DateOnly(2026, 1, 1)));
    }

    [Fact]
    public void Fixed_MissingDate_ReturnsNull()
    {
        var rule = new ScheduleRule { Type = ScheduleType.Fixed };
        Assert.Null(_engine.GetNextOccurrence(rule, new DateOnly(2026, 1, 1)));
    }

    [Fact]
    public void GetDaysUntilNext_ReturnsPositiveForFuture()
    {
        var rule = new ScheduleRule
        {
            Type = ScheduleType.Fixed,
            Date = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(10)),
        };

        var days = _engine.GetDaysUntilNext(rule);
        Assert.NotNull(days);
        Assert.InRange(days.Value, 9, 11); // Allow ±1 for midnight edge case
    }
}
