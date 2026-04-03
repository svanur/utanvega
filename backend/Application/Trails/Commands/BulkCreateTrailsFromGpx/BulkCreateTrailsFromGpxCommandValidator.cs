using FluentValidation;

namespace Utanvega.Backend.Application.Trails.Commands.BulkCreateTrailsFromGpx;

public class BulkCreateTrailsFromGpxCommandValidator : AbstractValidator<BulkCreateTrailsFromGpxCommand>
{
    public BulkCreateTrailsFromGpxCommandValidator()
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

                file.RuleFor(f => f.Name)
                    .MaximumLength(200)
                    .When(f => f.Name is not null);
            });
    }
}
