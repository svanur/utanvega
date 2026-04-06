using MediatR;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Trails.Queries.GetTrailSuggestions;

public record TrailSuggestionDto(string Name, string Slug, double Length, string ActivityType, string TrailType);

public record GetTrailSuggestionsQuery(string Slug) : IRequest<List<TrailSuggestionDto>>;

public class GetTrailSuggestionsQueryHandler : IRequestHandler<GetTrailSuggestionsQuery, List<TrailSuggestionDto>>
{
    private readonly UtanvegaDbContext _context;

    public GetTrailSuggestionsQueryHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<List<TrailSuggestionDto>> Handle(GetTrailSuggestionsQuery request, CancellationToken cancellationToken)
    {
        var input = request.Slug.ToLowerInvariant().Trim();
        if (string.IsNullOrEmpty(input)) return [];

        var published = _context.Trails
            .Where(t => t.Status == TrailStatus.Published)
            .AsNoTracking();

        // 1. Prefix match (tindahlaup → tindahlaup-1, tindahlaup-3, etc.)
        var prefixMatches = await published
            .Where(t => t.Slug.StartsWith(input))
            .OrderBy(t => t.Slug)
            .Take(10)
            .ToListAsync(cancellationToken);

        // 2. Contains match (if prefix didn't find enough)
        var containsMatches = new List<Trail>();
        if (prefixMatches.Count < 5)
        {
            var prefixIds = prefixMatches.Select(t => t.Id).ToHashSet();
            containsMatches = await published
                .Where(t => t.Slug.Contains(input) && !prefixIds.Contains(t.Id))
                .OrderBy(t => t.Slug)
                .Take(10 - prefixMatches.Count)
                .ToListAsync(cancellationToken);
        }

        // 3. Word overlap — split input on hyphens and find trails sharing words
        var wordMatches = new List<Trail>();
        var words = input.Split('-', StringSplitOptions.RemoveEmptyEntries)
            .Where(w => w.Length >= 3) // Skip short words like numbers
            .ToList();

        if (prefixMatches.Count + containsMatches.Count < 5 && words.Count > 0)
        {
            var alreadyFound = prefixMatches.Concat(containsMatches).Select(t => t.Id).ToHashSet();

            // Build a query that matches any significant word
            var candidates = published.Where(t => !alreadyFound.Contains(t.Id));
            foreach (var word in words.Take(3))
            {
                var w = word; // capture for closure
                candidates = candidates.Where(t => t.Slug.Contains(w));
            }

            wordMatches = await candidates
                .OrderBy(t => t.Slug)
                .Take(5)
                .ToListAsync(cancellationToken);
        }

        var all = prefixMatches
            .Concat(containsMatches)
            .Concat(wordMatches)
            .Take(10)
            .Select(t => new TrailSuggestionDto(
                t.Name,
                t.Slug,
                t.Length,
                t.ActivityTypeId.ToString(),
                t.Type.ToString()
            ))
            .ToList();

        return all;
    }
}
