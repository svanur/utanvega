using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Core.Entities;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Application.Events.Commands.UpdateRace;

public class UpdateRaceCommandValidator : AbstractValidator<UpdateRaceCommand>
{
    public UpdateRaceCommandValidator(UtanvegaDbContext context)
    {
        RuleFor(x => x.Status)
            .MustAsync(async (command, statusValue, ct) =>
            {
                if (string.Equals(statusValue, "Cancelled", StringComparison.OrdinalIgnoreCase))
                    return true;

                var editionStatus = await context.Races
                    .Where(r => r.Id == command.Id)
                    .Select(r => r.EventEdition.Status)
                    .FirstOrDefaultAsync(ct);

                return editionStatus != EditionStatus.Cancelled;
            })
            .WithMessage("Cannot change race status away from Cancelled while its edition is cancelled — reactivate the edition first.");
    }
}
