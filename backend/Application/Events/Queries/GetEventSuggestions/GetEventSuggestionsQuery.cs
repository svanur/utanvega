using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Events.Queries.GetEventSuggestions;

public record EventSuggestionDto(string Name, string Slug, string? LocationName, int EditionCount);

public record GetEventSuggestionsQuery(string Slug) : IRequest<List<EventSuggestionDto>>;

public class GetEventSuggestionsQueryHandler : IRequestHandler<GetEventSuggestionsQuery, List<EventSuggestionDto>>
{
    private readonly UtanvegaDbContext _context;

    public GetEventSuggestionsQueryHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<List<EventSuggestionDto>> Handle(GetEventSuggestionsQuery request, CancellationToken cancellationToken)
    {
        var input = request.Slug.ToLowerInvariant().Trim();
        if (string.IsNullOrEmpty(input)) return [];

        var published = _context.Events
            .Where(e => e.Status != EventStatus.Hidden && e.Status != EventStatus.Unlisted)
            .Include(e => e.Location)
            .Include(e => e.Editions)
            .AsNoTracking();

        // 1. Prefix match
        var prefixMatches = await published
            .Where(e => e.Slug.StartsWith(input))
            .OrderBy(e => e.Slug)
            .Take(10)
            .ToListAsync(cancellationToken);

        // 2. Contains match (if prefix didn't find enough)
        var containsMatches = new List<Event>();
        if (prefixMatches.Count < 5)
        {
            var prefixIds = prefixMatches.Select(e => e.Id).ToHashSet();
            containsMatches = await published
                .Where(e => e.Slug.Contains(input) && !prefixIds.Contains(e.Id))
                .OrderBy(e => e.Slug)
                .Take(10 - prefixMatches.Count)
                .ToListAsync(cancellationToken);
        }

        // 3. Word overlap — split input on hyphens and find events sharing words
        var wordMatches = new List<Event>();
        var words = input.Split('-', StringSplitOptions.RemoveEmptyEntries)
            .Where(w => w.Length >= 3) // Skip short words like numbers
            .ToList();

        if (prefixMatches.Count + containsMatches.Count < 5 && words.Count > 0)
        {
            var alreadyFound = prefixMatches.Concat(containsMatches).Select(e => e.Id).ToHashSet();

            // Build a query that matches any significant word — union the per-word
            // candidate sets (OR) rather than chaining .Where() (which composes as AND).
            IQueryable<Event>? candidates = null;
            foreach (var word in words.Take(3))
            {
                var w = word; // capture for closure
                var wordQuery = published.Where(e => !alreadyFound.Contains(e.Id) && e.Slug.Contains(w));
                candidates = candidates == null ? wordQuery : candidates.Union(wordQuery);
            }

            wordMatches = await candidates!
                .OrderBy(e => e.Slug)
                .Take(5)
                .ToListAsync(cancellationToken);
        }

        var all = prefixMatches
            .Concat(containsMatches)
            .Concat(wordMatches)
            .Take(10)
            .Select(e => new EventSuggestionDto(
                e.Name,
                e.Slug,
                e.Location?.Name,
                e.Editions.Count
            ))
            .ToList();

        return all;
    }
}
