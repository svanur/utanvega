using FluentValidation;

namespace Utanvega.Backend.Application.Trails.Commands.UpdateTrailGpx;

public class UpdateTrailGpxCommandValidator : AbstractValidator<UpdateTrailGpxCommand>
{
    public UpdateTrailGpxCommandValidator()
    {
        RuleFor(x => x.GpxXml)
            .NotEmpty()
            .WithMessage("GPX content is required.");
    }
}
