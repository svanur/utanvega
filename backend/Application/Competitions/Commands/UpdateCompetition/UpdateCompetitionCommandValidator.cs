using FluentValidation;
using Utanvega.Backend.Core.Entities;

namespace Utanvega.Backend.Application.Competitions.Commands.UpdateCompetition;

public class UpdateCompetitionCommandValidator : AbstractValidator<UpdateCompetitionCommand>
{
    public UpdateCompetitionCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();

        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(200);

        RuleFor(x => x.Status)
            .NotEmpty()
            .Must(v => Enum.TryParse<CompetitionStatus>(v, ignoreCase: true, out _))
            .WithMessage($"Status must be one of: {string.Join(", ", Enum.GetNames<CompetitionStatus>())}.");

        RuleFor(x => x.OrganizerWebsite)
            .MaximumLength(500)
            .Must(url => Uri.TryCreate(url, UriKind.Absolute, out _))
            .WithMessage("OrganizerWebsite must be a valid URL.")
            .When(x => !string.IsNullOrEmpty(x.OrganizerWebsite));

        RuleFor(x => x.Description)
            .MaximumLength(5000)
            .When(x => x.Description is not null);

        RuleFor(x => x.OrganizerName)
            .MaximumLength(200)
            .When(x => x.OrganizerName is not null);
    }
}
