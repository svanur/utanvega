using Utanvega.Backend.Application.Advent;

namespace Utanvega.Backend.Tests.Handlers;

/// <summary>
/// Content invariants for the 24 committed advent questions (#1875) — not the engine's behaviour
/// (covered by <see cref="AdventHandlerTests"/>), but the data itself: exactly 24 entries, days
/// 1-24 with no duplicates, 4 non-empty choices per language, a valid <c>CorrectIndex</c>, and a
/// non-empty <c>LinkUrl</c>. These would catch a transcription slip (a missing day, a duplicate day,
/// an empty choice) that a day-lock or persistence test could never surface.
/// </summary>
public class AdventQuestionsContentTests
{
    [Fact]
    public void All_ContainsExactlyTwentyFourEntries() =>
        Assert.Equal(24, AdventQuestions.All.Count);

    [Fact]
    public void All_CoversEveryDayOneToTwentyFour_WithNoDuplicates()
    {
        var days = AdventQuestions.All.Select(q => q.Day).OrderBy(d => d).ToList();
        Assert.Equal(Enumerable.Range(1, 24), days);
    }

    [Theory]
    [MemberData(nameof(AllDays))]
    public void Question_HasFourNonEmptyChoices_InBothLanguages(int day)
    {
        var question = AdventQuestions.ForDay(day)!;
        Assert.Equal(4, question.ChoicesIs.Length);
        Assert.Equal(4, question.ChoicesEn.Length);
        Assert.All(question.ChoicesIs, c => Assert.False(string.IsNullOrWhiteSpace(c)));
        Assert.All(question.ChoicesEn, c => Assert.False(string.IsNullOrWhiteSpace(c)));
    }

    [Theory]
    [MemberData(nameof(AllDays))]
    public void Question_HasValidCorrectIndex(int day)
    {
        var question = AdventQuestions.ForDay(day)!;
        Assert.InRange(question.CorrectIndex, 0, 3);
    }

    [Theory]
    [MemberData(nameof(AllDays))]
    public void Question_HasNonEmptyLinkUrl(int day)
    {
        var question = AdventQuestions.ForDay(day)!;
        Assert.False(string.IsNullOrWhiteSpace(question.LinkUrl));
    }

    [Theory]
    [MemberData(nameof(AllDays))]
    public void Question_HasNonEmptyTextAndLinkLabels_InBothLanguages(int day)
    {
        var question = AdventQuestions.ForDay(day)!;
        Assert.False(string.IsNullOrWhiteSpace(question.TextIs));
        Assert.False(string.IsNullOrWhiteSpace(question.TextEn));
        Assert.False(string.IsNullOrWhiteSpace(question.LinkLabelIs));
        Assert.False(string.IsNullOrWhiteSpace(question.LinkLabelEn));
    }

    // Plain ints rather than AdventQuestion records, so xUnit's VSTest-adapter serialization of
    // MemberData (which only reliably round-trips primitives/strings, not arbitrary records) never
    // has to be relied on — each test looks the question up by day itself.
    public static IEnumerable<object[]> AllDays() =>
        Enumerable.Range(1, 24).Select(day => new object[] { day });

    [Fact]
    public void ForDay_UnknownDay_ReturnsNull()
    {
        Assert.Null(AdventQuestions.ForDay(0));
        Assert.Null(AdventQuestions.ForDay(25));
    }

    [Fact]
    public void ForDay_KnownDay_ReturnsMatchingQuestion()
    {
        var question = AdventQuestions.ForDay(1);
        Assert.NotNull(question);
        Assert.Equal(1, question!.Day);
    }
}
