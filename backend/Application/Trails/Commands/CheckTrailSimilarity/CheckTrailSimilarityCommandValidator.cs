using FluentValidation;

namespace Utanvega.Backend.Application.Trails.Commands.CheckTrailSimilarity;

public class CheckTrailSimilarityCommandValidator : AbstractValidator<CheckTrailSimilarityCommand>
{
    public CheckTrailSimilarityCommandValidator()
    {
        RuleFor(x => x.GpxXml)
            .NotEmpty()
            .WithMessage("GPX content is required.");

        RuleFor(x => x.Name)
            .MaximumLength(200)
            .When(x => x.Name is not null);
    }
}
