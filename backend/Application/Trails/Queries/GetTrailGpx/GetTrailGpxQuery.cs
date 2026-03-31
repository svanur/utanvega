using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Text;
using System.Xml.Linq;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Trails.Queries.GetTrailGpx;

public record GetTrailGpxQuery(string Slug) : IRequest<GpxResponse?>;

public record GpxResponse(string FileName, string Content);

public class GetTrailGpxQueryHandler : IRequestHandler<GetTrailGpxQuery, GpxResponse?>
{
    private readonly UtanvegaDbContext _context;

    public GetTrailGpxQueryHandler(UtanvegaDbContext context)
    {
        _context = context;
    }

    public async Task<GpxResponse?> Handle(GetTrailGpxQuery request, CancellationToken cancellationToken)
    {
        var trail = await _context.Trails
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Slug == request.Slug, cancellationToken);

        if (trail?.GpxData == null) return null;

        XNamespace ns = "http://www.topografix.com/GPX/1/1";
        var doc = new XDocument(
            new XDeclaration("1.0", "utf-8", null),
            new XElement(ns + "gpx",
                new XAttribute("version", "1.1"),
                new XAttribute("creator", "Utanvega"),
                new XElement(ns + "metadata",
                    new XElement(ns + "name", trail.Name),
                    new XElement(ns + "link", new XAttribute("href", $"https://utanvega.vercel.app/trails/{trail.Slug}"),
                        new XElement(ns + "text", "Utanvega Trail"))
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
        using (var writer = new Utanvega.Backend.Application.Trails.Queries.GetTrailGpx.Utf8StringWriter(sb))
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
