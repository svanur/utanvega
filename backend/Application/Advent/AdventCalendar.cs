namespace Utanvega.Backend.Application.Advent;

/// <summary>
/// Server-side "is this door open yet" gate for the 2026 advent calendar (#1875) — the correct
/// answer can never be shipped to the browser before a door unlocks, so this has to be enforced
/// here and checked by every handler that touches a day, not left to the client's clock.
/// </summary>
public static class AdventCalendar
{
    /// <summary>
    /// This campaign is a one-time 2026 event (<c>/jolaleikur/2026</c>), not a recurring yearly
    /// feature — hardcoded rather than "the current year" so a December run of this same code in
    /// any other year doesn't spuriously unlock every door. Reusing this for a future year's
    /// calendar needs this to become a parameter, not just a bumped constant.
    /// </summary>
    public const int Year = 2026;

    /// <summary>
    /// Iceland keeps UTC year-round with no DST (see <c>GetAnalyticsQuery.Handle</c>'s comment for
    /// the same fact stated the same way), so converting via the real IANA zone and simply using
    /// the UTC date would agree every single day — but resolving the zone explicitly is what makes
    /// this a real timezone-aware check rather than a comment promising one. Falls back to UTC
    /// (which is already the correct Iceland-local answer per the fact above) if the IANA id isn't
    /// resolvable on the host, rather than crashing the app at startup over a campaign-specific gate.
    /// </summary>
    private static readonly Lazy<TimeZoneInfo> IcelandTimeZone = new(() =>
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById("Atlantic/Reykjavik");
        }
        catch (TimeZoneNotFoundException)
        {
            return TimeZoneInfo.Utc;
        }
        catch (InvalidTimeZoneException)
        {
            return TimeZoneInfo.Utc;
        }
    });

    /// <summary>
    /// True only when <paramref name="day"/> is a real door (1-24) and today's Iceland-local date
    /// is on or after December <paramref name="day"/>, <see cref="Year"/> — false for anything
    /// outside 1-24, and false before that door's date (there is no "after Dec 24 it all re-locks"
    /// case to express: every door earned stays earned).
    ///
    /// <para>
    /// <paramref name="unlockAllDoors"/> is the staging-only override (#1885): when true, every
    /// in-range day (1-24) reports unlocked regardless of the real date, so testers on the
    /// hlaupadagskra-staging Fly app can see all 24 doors without the real clock reaching
    /// December. Out-of-range days still return false either way — the override bypasses the
    /// date check, not the door-range check. Callers are expected to pass <c>false</c> here
    /// whenever <c>IWebHostEnvironment.IsProduction()</c> is true, so production behavior is
    /// provably unaffected by this parameter even if the env var were ever set there by mistake.
    /// </para>
    /// </summary>
    public static bool IsDayUnlocked(int day, TimeProvider timeProvider, bool unlockAllDoors = false)
    {
        if (day < 1 || day > 24)
            return false;

        if (unlockAllDoors)
            return true;

        var icelandNow = TimeZoneInfo.ConvertTimeFromUtc(timeProvider.GetUtcNow().UtcDateTime, IcelandTimeZone.Value);
        var unlockDate = new DateTime(Year, 12, day);
        return icelandNow.Date >= unlockDate;
    }
}
