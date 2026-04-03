using FluentValidation;

namespace Utanvega.Backend.Application.Trails.Commands.DeleteTrail;

public class DeleteTrailCommandValidator : AbstractValidator<DeleteTrailCommand>
{
    public DeleteTrailCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
    }
}
