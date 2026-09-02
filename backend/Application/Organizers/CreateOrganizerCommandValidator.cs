using FluentValidation;

namespace Utanvega.Backend.Application.Organizers;

public class CreateOrganizerCommandValidator : AbstractValidator<CreateOrganizerCommand>
{
    public CreateOrganizerCommandValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(200);

        RuleFor(x => x.Website)
            .MaximumLength(500)
            .Must(url => Uri.TryCreate(url, UriKind.Absolute, out var uri)
                && (uri.Scheme == "http" || uri.Scheme == "https"))
            .WithMessage("Website must be a valid HTTP or HTTPS URL.")
            .When(x => !string.IsNullOrEmpty(x.Website));
    }
}
