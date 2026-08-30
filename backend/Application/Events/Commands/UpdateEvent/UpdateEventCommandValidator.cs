using FluentValidation;
using Utanvega.Backend.Application.Validation;
using Utanvega.Backend.Core.Entities;

namespace Utanvega.Backend.Application.Events.Commands.UpdateEvent;

public class UpdateEventCommandValidator : AbstractValidator<UpdateEventCommand>
{
    public UpdateEventCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();

        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(200);

        // A blank or whitespace-only slug is treated by the handler as "no change requested" (it
        // leaves the existing slug untouched), so only a non-blank value needs format validation.
        RuleFor(x => x.Slug)
            .MaximumLength(250)
            .Matches(@"^[a-z0-9]+(?:-[a-z0-9]+)*$")
            .WithMessage("Slug must be lowercase alphanumeric with hyphens only.")
            .When(x => !string.IsNullOrWhiteSpace(x.Slug));

        RuleFor(x => x.Type)
            .NotEmpty()
            .Must(EnumValidation.IsDefined<EventType>)
            .WithMessage($"Type must be one of: {string.Join(", ", Enum.GetNames<EventType>())}.");

        RuleFor(x => x.ActivityType)
            .NotEmpty()
            .Must(EnumValidation.IsDefined<ActivityType>)
            .WithMessage($"ActivityType must be one of: {string.Join(", ", Enum.GetNames<ActivityType>())}.");

        RuleFor(x => x.Status)
            .NotEmpty()
            .Must(EnumValidation.IsDefined<EventStatus>)
            .WithMessage($"Status must be one of: {string.Join(", ", Enum.GetNames<EventStatus>())}.");

        RuleFor(x => x.OrganizerName)
            .MaximumLength(200)
            .When(x => x.OrganizerName is not null);

        RuleFor(x => x.OrganizerWebsite)
            .MaximumLength(500)
            .Must(url => Uri.TryCreate(url, UriKind.Absolute, out _))
            .WithMessage("OrganizerWebsite must be a valid URL.")
            .When(x => !string.IsNullOrEmpty(x.OrganizerWebsite));

        RuleFor(x => x.PhotoGalleryUrl)
            .MaximumLength(500)
            .Must(url => Uri.TryCreate(url, UriKind.Absolute, out _))
            .WithMessage("PhotoGalleryUrl must be a valid URL.")
            .When(x => !string.IsNullOrEmpty(x.PhotoGalleryUrl));

        RuleFor(x => x.Description)
            .MaximumLength(5000)
            .When(x => x.Description is not null);

        RuleFor(x => x.GpxPointLat)
            .InclusiveBetween(-90.0, 90.0)
            .WithMessage("GpxPointLat must be between -90 and 90.")
            .When(x => x.GpxPointLat.HasValue);

        RuleFor(x => x.GpxPointLng)
            .InclusiveBetween(-180.0, 180.0)
            .WithMessage("GpxPointLng must be between -180 and 180.")
            .When(x => x.GpxPointLng.HasValue);

        RuleFor(x => x)
            .Must(x => (x.GpxPointLat.HasValue) == (x.GpxPointLng.HasValue))
            .WithMessage("GpxPointLat and GpxPointLng must both be set or both be null.");

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
