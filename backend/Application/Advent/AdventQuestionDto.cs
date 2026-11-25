namespace Utanvega.Backend.Application.Advent;

/// <summary>
/// The only shape ever serialized to a client for a day's question — deliberately has no
/// <c>CorrectIndex</c> field, so there is nothing for a serializer misconfiguration to accidentally
/// leak; the correct answer never exists in any type that crosses the wire.
/// </summary>
public sealed record AdventQuestionDto(
    int Day,
    string TextIs,
    string TextEn,
    string[] ChoicesIs,
    string[] ChoicesEn,
    string LinkUrl,
    string LinkLabelIs,
    string LinkLabelEn)
{
    public static AdventQuestionDto FromQuestion(AdventQuestion question) => new(
        question.Day,
        question.TextIs,
        question.TextEn,
        question.ChoicesIs,
        question.ChoicesEn,
        question.LinkUrl,
        question.LinkLabelIs,
        question.LinkLabelEn);
}
