using FluentValidation;
using Utanvega.Backend.Application.Validation;
using Utanvega.Backend.Core.Entities;

namespace Utanvega.Backend.Application.Trails.Commands.UpdateTrail;

public class UpdateTrailCommandValidator : AbstractValidator<UpdateTrailCommand>
{
    public UpdateTrailCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();

        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(200);

        RuleFor(x => x.Slug)
            .NotEmpty()
            .MaximumLength(250)
            .Matches(@"^[a-z0-9]+(?:-[a-z0-9]+)*$")
            .WithMessage("Slug must be lowercase alphanumeric with hyphens only.");

        RuleFor(x => x.ActivityType)
            .NotEmpty()
            .Must(EnumValidation.IsDefined<ActivityType>)
            .WithMessage($"ActivityType must be one of: {string.Join(", ", Enum.GetNames<ActivityType>())}.");

        RuleFor(x => x.Status)
            .NotEmpty()
            .Must(EnumValidation.IsDefined<TrailStatus>)
            .WithMessage($"Status must be one of: {string.Join(", ", Enum.GetNames<TrailStatus>())}.");

        RuleFor(x => x.Type)
            .NotEmpty()
            .Must(EnumValidation.IsDefined<TrailType>)
            .WithMessage($"Type must be one of: {string.Join(", ", Enum.GetNames<TrailType>())}.");

        RuleFor(x => x.Difficulty)
            .NotEmpty()
            .Must(EnumValidation.IsDefined<Difficulty>)
            .WithMessage($"Difficulty must be one of: {string.Join(", ", Enum.GetNames<Difficulty>())}.");

        RuleFor(x => x.Visibility)
            .NotEmpty()
            .Must(EnumValidation.IsDefined<Visibility>)
            .WithMessage($"Visibility must be one of: {string.Join(", ", Enum.GetNames<Visibility>())}.");

        RuleFor(x => x.Description)
            .MaximumLength(5000)
            .When(x => x.Description is not null);

        RuleFor(x => x.YoutubeUrl)
            .MaximumLength(500)
            .Must(BeAValidYoutubeUrl)
            .WithMessage("YoutubeUrl must be a valid YouTube URL.")
            .When(x => !string.IsNullOrEmpty(x.YoutubeUrl));

        RuleForEach(x => x.Locations)
            .ChildRules(loc =>
            {
                loc.RuleFor(l => l.LocationId).NotEmpty();
                loc.RuleFor(l => l.Role)
                    .NotEmpty()
                    .Must(EnumValidation.IsDefined<TrailLocationRole>)
                    .WithMessage($"Role must be one of: {string.Join(", ", Enum.GetNames<TrailLocationRole>())}.");
                loc.RuleFor(l => l.Order).GreaterThanOrEqualTo(0);
            })
            .When(x => x.Locations is not null);
    }

    private static readonly string[] AllowedYoutubeHosts =
        ["www.youtube.com", "youtube.com", "youtu.be", "www.youtube-nocookie.com"];

    private static bool BeAValidYoutubeUrl(string? url)
    {
        if (string.IsNullOrEmpty(url)) return true;
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri)) return false;
        if (uri.Scheme != "https" && uri.Scheme != "http") return false;
        return AllowedYoutubeHosts.Contains(uri.Host, StringComparer.OrdinalIgnoreCase);
    }
}
