using FluentValidation;
using Utanvega.Backend.Application.Locations;
using Utanvega.Backend.Application.Validation;
using Utanvega.Backend.Core.Entities;

namespace Utanvega.Backend.Application.Locations.Commands.UpdateLocation;

public class UpdateLocationCommandValidator : AbstractValidator<UpdateLocationCommand>
{
    public UpdateLocationCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();

        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(200);

        RuleFor(x => x.Slug)
            .NotEmpty()
            .MaximumLength(250)
            .Matches(@"^[a-z0-9]+(?:-[a-z0-9]+)*$")
            .WithMessage("Slug must be lowercase alphanumeric with hyphens only.");

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

        // #1705: same rule as CreateLocationCommandValidator — see LocationBoundaryParser.
        RuleFor(x => x.BoundaryGeoJson)
            .Must(json => LocationBoundaryParser.TryParse(json!, out _, out _))
            .WithMessage(x => GetBoundaryError(x.BoundaryGeoJson))
            .When(x => x.BoundaryGeoJson is not null);
    }

    private static string GetBoundaryError(string? boundaryGeoJson)
    {
        LocationBoundaryParser.TryParse(boundaryGeoJson!, out _, out var error);
        return error ?? "BoundaryGeoJson is invalid.";
    }
}
