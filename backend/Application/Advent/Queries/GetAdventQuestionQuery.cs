using MediatR;

namespace Utanvega.Backend.Application.Advent.Queries;

/// <summary>Fetches a single day's advent question — see <c>GET /api/v1/advent/{day}</c>.</summary>
public sealed record GetAdventQuestionQuery(int Day) : IRequest<AdventQuestionDto?>;

/// <summary>
/// Returns <c>null</c> for a <see cref="GetAdventQuestionQuery.Day"/> outside 1-24 or not yet
/// unlocked per <see cref="AdventCalendar.IsDayUnlocked"/> — the endpoint turns that into a 400,
/// the same shape <c>GetTrailBySlugQuery</c>-style null-means-not-found queries already use.
/// </summary>
public sealed class GetAdventQuestionQueryHandler(TimeProvider timeProvider, AdventTestOverride testOverride)
    : IRequestHandler<GetAdventQuestionQuery, AdventQuestionDto?>
{
    public Task<AdventQuestionDto?> Handle(GetAdventQuestionQuery request, CancellationToken cancellationToken)
    {
        if (!AdventCalendar.IsDayUnlocked(request.Day, timeProvider, testOverride.UnlockAllDoors))
            return Task.FromResult<AdventQuestionDto?>(null);

        var question = AdventQuestions.ForDay(request.Day);
        return Task.FromResult(question is null ? null : AdventQuestionDto.FromQuestion(question));
    }
}
