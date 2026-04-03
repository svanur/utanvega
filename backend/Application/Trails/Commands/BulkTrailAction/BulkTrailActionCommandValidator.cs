using FluentValidation;

namespace Utanvega.Backend.Application.Trails.Commands.BulkTrailAction;

public class BulkTrailActionCommandValidator : AbstractValidator<BulkTrailActionCommand>
{
    public BulkTrailActionCommandValidator()
    {
        RuleFor(x => x.Ids)
            .NotEmpty()
            .WithMessage("At least one trail ID is required.");

        RuleFor(x => x.Action)
            .IsInEnum();

        RuleFor(x => x.Value)
            .NotEmpty()
            .When(x => x.Action is BulkTrailActionType.UpdateStatus
                or BulkTrailActionType.UpdateDifficulty
                or BulkTrailActionType.UpdateVisibility)
            .WithMessage("Value is required for update actions.");
    }
}
