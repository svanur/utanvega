using FluentValidation;
using Utanvega.Backend.Core.Entities;

namespace Utanvega.Backend.Application.Trails.Commands.UpdateTrail;

public class UpdateTrailCommandValidator : AbstractValidator<UpdateTrailCommand>
{
    public UpdateTrailCommandValidator()
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

        RuleFor(x => x.ActivityType)
            .NotEmpty()
            .Must(v => Enum.TryParse<ActivityType>(v, ignoreCase: true, out _))
            .WithMessage($"ActivityType must be one of: {string.Join(", ", Enum.GetNames<ActivityType>())}.");

        RuleFor(x => x.Status)
            .NotEmpty()
            .Must(v => Enum.TryParse<TrailStatus>(v, ignoreCase: true, out _))
            .WithMessage($"Status must be one of: {string.Join(", ", Enum.GetNames<TrailStatus>())}.");

        RuleFor(x => x.Type)
            .NotEmpty()
            .Must(v => Enum.TryParse<TrailType>(v, ignoreCase: true, out _))
            .WithMessage($"Type must be one of: {string.Join(", ", Enum.GetNames<TrailType>())}.");

        RuleFor(x => x.Difficulty)
            .NotEmpty()
            .Must(v => Enum.TryParse<Difficulty>(v, ignoreCase: true, out _))
            .WithMessage($"Difficulty must be one of: {string.Join(", ", Enum.GetNames<Difficulty>())}.");

        RuleFor(x => x.Visibility)
            .NotEmpty()
            .Must(v => Enum.TryParse<Visibility>(v, ignoreCase: true, out _))
            .WithMessage($"Visibility must be one of: {string.Join(", ", Enum.GetNames<Visibility>())}.");

        RuleFor(x => x.Description)
            .MaximumLength(5000)
            .When(x => x.Description is not null);

        RuleForEach(x => x.Locations)
            .ChildRules(loc =>
            {
                loc.RuleFor(l => l.LocationId).NotEmpty();
                loc.RuleFor(l => l.Role)
                    .NotEmpty()
                    .Must(v => Enum.TryParse<TrailLocationRole>(v, ignoreCase: true, out _))
                    .WithMessage($"Role must be one of: {string.Join(", ", Enum.GetNames<TrailLocationRole>())}.");
                loc.RuleFor(l => l.Order).GreaterThanOrEqualTo(0);
            })
            .When(x => x.Locations is not null);
    }
}
