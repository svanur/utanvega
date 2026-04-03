using FluentValidation;
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
            .Must(v => Enum.TryParse<LocationType>(v, ignoreCase: true, out _))
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
    }
}
