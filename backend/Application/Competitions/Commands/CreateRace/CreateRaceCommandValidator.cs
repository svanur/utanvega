using FluentValidation;
using Utanvega.Backend.Core.Entities;

namespace Utanvega.Backend.Application.Competitions.Commands.CreateRace;

public class CreateRaceCommandValidator : AbstractValidator<CreateRaceCommand>
{
    public CreateRaceCommandValidator()
    {
        RuleFor(x => x.CompetitionId).NotEmpty();

        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(200);

        RuleFor(x => x.DistanceLabel)
            .MaximumLength(50)
            .When(x => x.DistanceLabel is not null);

        RuleFor(x => x.CutoffMinutes)
            .GreaterThan(0)
            .When(x => x.CutoffMinutes.HasValue);

        RuleFor(x => x.Status)
            .NotEmpty()
            .Must(v => Enum.TryParse<RaceStatus>(v, ignoreCase: true, out _))
            .WithMessage($"Status must be one of: {string.Join(", ", Enum.GetNames<RaceStatus>())}.");

        RuleFor(x => x.SortOrder)
            .GreaterThanOrEqualTo(0);
    }
}
