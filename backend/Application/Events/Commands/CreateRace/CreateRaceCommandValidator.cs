using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Events.Commands.CreateRace;

public class CreateRaceCommandValidator : AbstractValidator<CreateRaceCommand>
{
    public CreateRaceCommandValidator(UtanvegaDbContext context)
    {
        RuleFor(x => x.EventEditionId)
            .NotEmpty()
            .MustAsync(async (editionId, ct) =>
            {
                var editionStatus = await context.EventEditions
                    .Where(ed => ed.Id == editionId)
                    .Select(ed => ed.Status)
                    .FirstOrDefaultAsync(ct);

                return editionStatus != EditionStatus.Cancelled;
            })
            .WithMessage("Cannot add a race to a cancelled edition — reactivate the edition first.");

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
            .InclusiveBetween(0, 6)
            .When(x => x.ItraPoints.HasValue);

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
