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
            .MustAsync(async (editionId, ct) =>
            {
                var editionStatus = await context.EventEditions
                    .Where(ed => ed.Id == editionId)
                    .Select(ed => ed.Status)
                    .FirstOrDefaultAsync(ct);

                return editionStatus != EditionStatus.Cancelled;
            })
            .WithMessage("Cannot add a race to a cancelled edition — reactivate the edition first.");
    }
}
