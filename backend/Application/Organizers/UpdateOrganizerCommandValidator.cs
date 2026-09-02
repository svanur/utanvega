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

        RuleFor(x => x.Website)
            .MaximumLength(500)
            .Must(url => Uri.TryCreate(url, UriKind.Absolute, out var uri)
                && (uri.Scheme == "http" || uri.Scheme == "https"))
            .WithMessage("Website must be a valid HTTP or HTTPS URL.")
            .When(x => !string.IsNullOrEmpty(x.Website));

        RuleForEach(x => x.SocialLinks)
            .ChildRules(link =>
            {
                link.RuleFor(l => l.Type).NotEmpty().MaximumLength(50);
                link.RuleFor(l => l.Url)
                    .NotEmpty()
                    .MaximumLength(500)
                    .Must(url => Uri.TryCreate(url, UriKind.Absolute, out var uri)
                        && (uri.Scheme == "http" || uri.Scheme == "https"))
                    .WithMessage("SocialLink URL must be a valid HTTP or HTTPS URL.");
            })
            .When(x => x.SocialLinks is not null);
    }
}
