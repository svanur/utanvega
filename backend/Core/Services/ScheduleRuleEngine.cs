namespace Utanvega.Backend.Core.Services;

using Utanvega.Backend.Core.Entities;

public interface IScheduleRuleEngine
{
    /// <summary>
    /// Returns the next occurrence of the schedule from the given reference date.
    /// For seasonal rules, returns the next individual occurrence.
    /// </summary>
    DateOnly? GetNextOccurrence(ScheduleRule rule, DateOnly fromDate);

    /// <summary>
    /// Returns all occurrences within the given date range (inclusive).
    /// </summary>
    List<DateOnly> GetOccurrencesInRange(ScheduleRule rule, DateOnly from, DateOnly to);

    /// <summary>
    /// Returns the number of days until the next occurrence from today.
    /// </summary>
    int? GetDaysUntilNext(ScheduleRule rule);
}

public class ScheduleRuleEngine : IScheduleRuleEngine
{
    public DateOnly? GetNextOccurrence(ScheduleRule rule, DateOnly fromDate)
    {
        return rule.Type switch
        {
            ScheduleType.Fixed => GetNextFixed(rule, fromDate),
            ScheduleType.Yearly => GetNextYearly(rule, fromDate),
            ScheduleType.Seasonal => GetNextSeasonal(rule, fromDate),
            _ => null,
        };
    }

    public List<DateOnly> GetOccurrencesInRange(ScheduleRule rule, DateOnly from, DateOnly to)
    {
        var results = new List<DateOnly>();
        if (from > to) return results;

        return rule.Type switch
        {
            ScheduleType.Fixed => GetFixedInRange(rule, from, to),
            ScheduleType.Yearly => GetYearlyInRange(rule, from, to),
            ScheduleType.Seasonal => GetSeasonalInRange(rule, from, to),
            _ => results,
        };
    }

    public int? GetDaysUntilNext(ScheduleRule rule)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var next = GetNextOccurrence(rule, today);
        return next.HasValue ? next.Value.DayNumber - today.DayNumber : null;
    }

    // --- Fixed ---

    private static DateOnly? GetNextFixed(ScheduleRule rule, DateOnly fromDate)
    {
        if (rule.Date is not { } date) return null;
        return date >= fromDate ? date : null;
    }

    private static List<DateOnly> GetFixedInRange(ScheduleRule rule, DateOnly from, DateOnly to)
    {
        if (rule.Date is { } date && date >= from && date <= to)
            return [date];
        return [];
    }

    // --- Yearly ---

    private static DateOnly? GetNextYearly(ScheduleRule rule, DateOnly fromDate)
    {
        if (rule.Month is not { } month) return null;

        // Day-of-month mode: "December 31st every year"
        if (rule.DayOfMonth is { } dayOfMonth)
        {
            for (int y = fromDate.Year; y <= fromDate.Year + 1; y++)
            {
                var clampedDay = Math.Min(dayOfMonth, DateTime.DaysInMonth(y, month));
                var date = new DateOnly(y, month, clampedDay);
                if (date >= fromDate) return date;
            }
            return null;
        }

        // Weekday-in-month mode: "2nd Saturday of July"
        if (rule.DayOfWeek is not { } dow || rule.WeekOfMonth is not { } week)
            return null;

        for (int y = fromDate.Year; y <= fromDate.Year + 1; y++)
        {
            var date = FindNthDayOfWeekInMonth(y, month, dow, week);
            if (date.HasValue && date.Value >= fromDate)
                return date;
        }

        return null;
    }

    private static List<DateOnly> GetYearlyInRange(ScheduleRule rule, DateOnly from, DateOnly to)
    {
        var results = new List<DateOnly>();
        if (rule.Month is not { } month) return results;

        // Day-of-month mode
        if (rule.DayOfMonth is { } dayOfMonth)
        {
            for (int y = from.Year; y <= to.Year; y++)
            {
                var clampedDay = Math.Min(dayOfMonth, DateTime.DaysInMonth(y, month));
                var date = new DateOnly(y, month, clampedDay);
                if (date >= from && date <= to)
                    results.Add(date);
            }
            return results;
        }

        // Weekday-in-month mode
        if (rule.DayOfWeek is not { } dow || rule.WeekOfMonth is not { } week)
            return results;

        for (int y = from.Year; y <= to.Year; y++)
        {
            var date = FindNthDayOfWeekInMonth(y, month, dow, week);
            if (date.HasValue && date.Value >= from && date.Value <= to)
                results.Add(date.Value);
        }

        return results;
    }

    // --- Seasonal ---

    private static DateOnly? GetNextSeasonal(ScheduleRule rule, DateOnly fromDate)
    {
        if (rule.MonthStart is not { } monthStart || rule.MonthEnd is not { } monthEnd || rule.DayOfWeek is not { } dow)
            return null;

        // If weekOfMonth is set, find the nth day-of-week in each month
        if (rule.WeekOfMonth is { } week)
        {
            for (int i = 0; i < 15; i++) // Check up to 15 months ahead
            {
                var checkMonth = fromDate.AddMonths(i);
                if (!IsInSeasonalRange(checkMonth.Month, monthStart, monthEnd))
                    continue;
                var date = FindNthDayOfWeekInMonth(checkMonth.Year, checkMonth.Month, dow, week);
                if (date.HasValue && date.Value >= fromDate)
                    return date;
            }
            return null;
        }

        // Every matching day-of-week in range
        var current = fromDate;
        var limit = fromDate.AddDays(400);

        while (current <= limit)
        {
            if (current.DayOfWeek == dow && IsInSeasonalRange(current.Month, monthStart, monthEnd))
                return current;
            current = current.AddDays(1);
        }

        return null;
    }

    private static List<DateOnly> GetSeasonalInRange(ScheduleRule rule, DateOnly from, DateOnly to)
    {
        var results = new List<DateOnly>();
        if (rule.MonthStart is not { } monthStart || rule.MonthEnd is not { } monthEnd || rule.DayOfWeek is not { } dow)
            return results;

        // If weekOfMonth is set, find the nth day-of-week in each qualifying month
        if (rule.WeekOfMonth is { } week)
        {
            var current = new DateOnly(from.Year, from.Month, 1);
            while (current <= to)
            {
                if (IsInSeasonalRange(current.Month, monthStart, monthEnd))
                {
                    var date = FindNthDayOfWeekInMonth(current.Year, current.Month, dow, week);
                    if (date.HasValue && date.Value >= from && date.Value <= to)
                        results.Add(date.Value);
                }
                current = current.AddMonths(1);
            }
            return results;
        }

        // Every matching day-of-week in range
        var day = from;
        while (day <= to)
        {
            if (day.DayOfWeek == dow && IsInSeasonalRange(day.Month, monthStart, monthEnd))
                results.Add(day);
            day = day.AddDays(1);
        }

        return results;
    }

    // --- Helpers ---

    /// <summary>
    /// Finds the Nth occurrence of a day-of-week in a given month.
    /// weekOfMonth: 1-4 for first through fourth, -1 for last.
    /// </summary>
    private static DateOnly? FindNthDayOfWeekInMonth(int year, int month, DayOfWeek dayOfWeek, int weekOfMonth)
    {
        if (month < 1 || month > 12) return null;

        var daysInMonth = DateTime.DaysInMonth(year, month);

        if (weekOfMonth == -1)
        {
            // Last occurrence: search backwards from end of month
            for (int d = daysInMonth; d >= 1; d--)
            {
                var date = new DateOnly(year, month, d);
                if (date.DayOfWeek == dayOfWeek)
                    return date;
            }
            return null;
        }

        if (weekOfMonth < 1 || weekOfMonth > 5) return null;

        // Find the Nth occurrence searching forward
        int count = 0;
        for (int d = 1; d <= daysInMonth; d++)
        {
            var date = new DateOnly(year, month, d);
            if (date.DayOfWeek == dayOfWeek)
            {
                count++;
                if (count == weekOfMonth)
                    return date;
            }
        }

        return null; // e.g., 5th Friday doesn't exist
    }

    /// <summary>
    /// Checks if a month falls within a seasonal range (supports wrapping, e.g., Oct-Mar = 10-3).
    /// </summary>
    private static bool IsInSeasonalRange(int month, int monthStart, int monthEnd)
    {
        if (monthStart <= monthEnd)
            return month >= monthStart && month <= monthEnd;
        // Wrapping: e.g., Oct(10) to Mar(3) → 10,11,12,1,2,3
        return month >= monthStart || month <= monthEnd;
    }
}
