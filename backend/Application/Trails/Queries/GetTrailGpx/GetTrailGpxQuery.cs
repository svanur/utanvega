using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Text;
using System.Xml.Linq;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Application.Events;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Trails.Queries.GetTrailGpx;

public record GetTrailGpxQuery(string Slug, string? Lang = null) : IRequest<GpxResponse?>, ICacheable
{
    // #1173: the lang query param selects the brand (Hlaupadagskra.is vs 360Runs.com) baked into
    // the GPX's creator/text literals, so the cache key must vary by lang too — mirrors the
    // isEnglish check GetEventCalendarIcs's cache key already does for the same reason.
    private bool IsEnglish => string.Equals(Lang, "en", StringComparison.OrdinalIgnoreCase);
    public string CacheKey => CacheKeys.Gpx(Slug, IsEnglish);
    public TimeSpan CacheDuration => TimeSpan.FromHours(24);
}

public record GpxResponse(string FileName, string Content);

public class GetTrailGpxQueryHandler : IRequestHandler<GetTrailGpxQuery, GpxResponse?>
{
    private readonly UtanvegaDbContext _context;
    private readonly IConfiguration _configuration;

    public GetTrailGpxQueryHandler(UtanvegaDbContext context, IConfiguration configuration)
    {
        _context = context;
        _configuration = configuration;
    }

    public async Task<GpxResponse?> Handle(GetTrailGpxQuery request, CancellationToken cancellationToken)
    {
        var trail = await _context.Trails
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Slug == request.Slug, cancellationToken);

        if (trail?.GpxData == null) return null;

        // #1173: same isEnglish branch GetEventCalendarIcs uses (Program.cs) — resolves SiteUrl
        // vs SiteUrlEn and derives the brand token (e.g. "Hlaupadagskra.is" / "360Runs.com") from
        // the host, instead of hardcoding the Icelandic brand regardless of lang.
        var isEnglish = string.Equals(request.Lang, "en", StringComparison.OrdinalIgnoreCase);
        var siteUrl = isEnglish
            ? (_configuration["SiteUrlEn"] ?? CalendarHostHelpers.DefaultSiteUrlEn)
            : (_configuration["SiteUrl"] ?? CalendarHostHelpers.DefaultSiteUrl);
        var (_, productIdHost) = CalendarHostHelpers.ComputeCalendarHosts(siteUrl);

        XNamespace ns = "http://www.topografix.com/GPX/1/1";
        var doc = new XDocument(
            new XDeclaration("1.0", "utf-8", null),
            new XElement(ns + "gpx",
                new XAttribute("version", "1.1"),
                new XAttribute("creator", productIdHost),
                new XElement(ns + "metadata",
                    new XElement(ns + "name", trail.Name),
                    new XElement(ns + "link", new XAttribute("href", $"{siteUrl}/trails/{trail.Slug}"),
                        new XElement(ns + "text", productIdHost))
                ),
                new XElement(ns + "trk",
                    new XElement(ns + "name", trail.Name),
                    new XElement(ns + "trkseg",
                        trail.GpxData.Coordinates.Select(c => 
                        {
                            var point = new XElement(ns + "trkpt",
                                new XAttribute("lat", c.Y.ToString(System.Globalization.CultureInfo.InvariantCulture)),
                                new XAttribute("lon", c.X.ToString(System.Globalization.CultureInfo.InvariantCulture))
                            );
                            if (!double.IsNaN(c.Z))
                            {
                                point.Add(new XElement(ns + "ele", c.Z.ToString(System.Globalization.CultureInfo.InvariantCulture)));
                            }
                            return point;
                        })
                    )
                )
            )
        );

        var sb = new StringBuilder();
        using (var writer = new Utf8StringWriter(sb))
        {
            doc.Save(writer);
        }

        return new GpxResponse($"{trail.Slug}.gpx", sb.ToString());
    }
}

public class Utf8StringWriter : StringWriter
{
    public Utf8StringWriter(StringBuilder sb) : base(sb) { }
    public override Encoding Encoding => Encoding.UTF8;
}
