using FluentValidation;
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

        RuleFor(x => x.Type)
            .NotEmpty()
            .Must(v => Enum.TryParse<EventType>(v, ignoreCase: true, out _))
            .WithMessage($"Type must be one of: {string.Join(", ", Enum.GetNames<EventType>())}.");

        RuleFor(x => x.ActivityType)
            .NotEmpty()
            .Must(v => Enum.TryParse<ActivityType>(v, ignoreCase: true, out _))
            .WithMessage($"ActivityType must be one of: {string.Join(", ", Enum.GetNames<ActivityType>())}.");

        RuleFor(x => x.Status)
            .NotEmpty()
            .Must(v => Enum.TryParse<EventStatus>(v, ignoreCase: true, out _))
            .WithMessage($"Status must be one of: {string.Join(", ", Enum.GetNames<EventStatus>())}.");

        RuleFor(x => x.OrganizerName)
            .MaximumLength(200)
            .When(x => x.OrganizerName is not null);

        RuleFor(x => x.OrganizerWebsite)
            .MaximumLength(500)
            .Must(url => Uri.TryCreate(url, UriKind.Absolute, out _))
            .WithMessage("OrganizerWebsite must be a valid URL.")
            .When(x => !string.IsNullOrEmpty(x.OrganizerWebsite));

        RuleFor(x => x.Description)
            .MaximumLength(5000)
            .When(x => x.Description is not null);

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
