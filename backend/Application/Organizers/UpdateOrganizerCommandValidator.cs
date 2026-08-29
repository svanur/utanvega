using FluentValidation;

namespace Utanvega.Backend.Application.Organizers;

public class UpdateOrganizerCommandValidator : AbstractValidator<UpdateOrganizerCommand>
{
    public UpdateOrganizerCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();

        // A blank or whitespace-only slug is treated by the handler as "no change requested" (it
        // leaves the existing slug untouched), so only a non-blank value needs format validation.
        RuleFor(x => x.Slug)
            .MaximumLength(250)
            .Matches(@"^[a-z0-9]+(?:-[a-z0-9]+)*$")
            .WithMessage("Slug must be lowercase alphanumeric with hyphens only.")
            .When(x => !string.IsNullOrWhiteSpace(x.Slug));
    }
}
