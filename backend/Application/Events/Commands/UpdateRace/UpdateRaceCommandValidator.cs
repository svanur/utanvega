using FluentValidation;
using Utanvega.Backend.Core.Entities;

namespace Utanvega.Backend.Application.Events.Commands.UpdateRace;

public class UpdateRaceCommandValidator : AbstractValidator<UpdateRaceCommand>
{
    public UpdateRaceCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();

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

        RuleFor(x => x.TicketStatus)
            .NotEmpty()
            .Must(v => Enum.TryParse<TicketStatus>(v, ignoreCase: true, out _))
            .WithMessage($"TicketStatus must be one of: {string.Join(", ", Enum.GetNames<TicketStatus>())}.");

        RuleFor(x => x.SortOrder).GreaterThanOrEqualTo(0);

        RuleFor(x => x.ItraPoints)
            .InclusiveBetween(0, 6);

        RuleFor(x => x.PrizeMoney)
            .GreaterThanOrEqualTo(0);

        RuleFor(x => x.MaxParticipants)
            .GreaterThan(0)
            .When(x => x.MaxParticipants.HasValue);

        RuleFor(x => x.CertifiedBy)
            .MaximumLength(100)
            .When(x => x.CertifiedBy is not null);

        RuleFor(x => x.ChampionshipCategory)
            .MaximumLength(200)
            .When(x => x.ChampionshipCategory is not null);
    }
}
