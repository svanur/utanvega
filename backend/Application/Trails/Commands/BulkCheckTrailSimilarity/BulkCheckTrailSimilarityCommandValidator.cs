using FluentValidation;

namespace Utanvega.Backend.Application.Trails.Commands.BulkCheckTrailSimilarity;

public class BulkCheckTrailSimilarityCommandValidator : AbstractValidator<BulkCheckTrailSimilarityCommand>
{
    public BulkCheckTrailSimilarityCommandValidator()
    {
        RuleFor(x => x.Files)
            .NotEmpty()
            .WithMessage("At least one GPX file is required.");

        RuleForEach(x => x.Files)
            .ChildRules(file =>
            {
                file.RuleFor(f => f.GpxXml)
                    .NotEmpty()
                    .WithMessage("GPX content is required for each file.");
            });
    }
}
