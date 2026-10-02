using FluentValidation;

namespace Utanvega.Backend.Application.Locations.Commands.DeleteLocation;

public class DeleteLocationCommandValidator : AbstractValidator<DeleteLocationCommand>
{
    public DeleteLocationCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
    }
}
