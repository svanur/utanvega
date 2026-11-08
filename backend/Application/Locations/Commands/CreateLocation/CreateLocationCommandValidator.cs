using FluentValidation;
using Utanvega.Backend.Application.Locations;
using Utanvega.Backend.Application.Validation;
using Utanvega.Backend.Core.Entities;

namespace Utanvega.Backend.Application.Locations.Commands.CreateLocation;

public class CreateLocationCommandValidator : AbstractValidator<CreateLocationCommand>
{
    public CreateLocationCommandValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(200);

        RuleFor(x => x.Slug)
            .MaximumLength(250)
            .Matches(@"^[a-z0-9]+(?:-[a-z0-9]+)*$")
            .WithMessage("Slug must be lowercase alphanumeric with hyphens only.")
            .When(x => x.Slug is not null);

        RuleFor(x => x.Type)
            .NotEmpty()
            .Must(EnumValidation.IsDefined<LocationType>)
            .WithMessage($"Type must be one of: {string.Join(", ", Enum.GetNames<LocationType>())}.");

        RuleFor(x => x.Latitude)
            .InclusiveBetween(-90, 90)
            .When(x => x.Latitude.HasValue);

        RuleFor(x => x.Longitude)
            .InclusiveBetween(-180, 180)
            .When(x => x.Longitude.HasValue);

        RuleFor(x => x.Radius)
            .GreaterThan(0)
            .When(x => x.Radius.HasValue);

        RuleFor(x => x.Description)
            .MaximumLength(5000)
            .When(x => x.Description is not null);

        // #1705: reject bad GeoJSON up front — not valid GeoJSON, not a Polygon, or a
        // self-intersecting ring are all rejected with a validation error rather than silently
        // accepted/ignored. See LocationBoundaryParser for the shared parse/validate logic also
        // used by the handler.
        // #1706: "" is treated the same as null here (skip parsing) — it's only a meaningful
        // "clear the boundary" sentinel on UpdateLocationCommand, where there's an existing
        // Boundary to clear; a brand-new Location never has one.
        RuleFor(x => x.BoundaryGeoJson)
            .Must(json => LocationBoundaryParser.TryParse(json!, out _, out _))
            .WithMessage(x => GetBoundaryError(x.BoundaryGeoJson))
            .When(x => !string.IsNullOrEmpty(x.BoundaryGeoJson));
    }

    private static string GetBoundaryError(string? boundaryGeoJson)
    {
        LocationBoundaryParser.TryParse(boundaryGeoJson!, out _, out var error);
        return error ?? "BoundaryGeoJson is invalid.";
    }
}
