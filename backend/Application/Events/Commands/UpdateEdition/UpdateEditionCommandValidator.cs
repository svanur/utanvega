using FluentValidation;
using Utanvega.Backend.Core.Entities;

namespace Utanvega.Backend.Application.Events.Commands.UpdateEdition;

public class UpdateEditionCommandValidator : AbstractValidator<UpdateEditionCommand>
{
    public UpdateEditionCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();

        RuleFor(x => x.Title)
            .MaximumLength(200)
            .When(x => x.Title is not null);

        RuleFor(x => x.RegistrationUrl)
            .MaximumLength(500)
            .Must(url => Uri.TryCreate(url, UriKind.Absolute, out _))
            .WithMessage("RegistrationUrl must be a valid URL.")
            .When(x => !string.IsNullOrEmpty(x.RegistrationUrl));

        RuleFor(x => x.ResultsUrl)
            .MaximumLength(500)
            .Must(url => Uri.TryCreate(url, UriKind.Absolute, out _))
            .WithMessage("ResultsUrl must be a valid URL.")
            .When(x => !string.IsNullOrEmpty(x.ResultsUrl));

        RuleFor(x => x.RegistrationStatus)
            .NotEmpty()
            .Must(v => Enum.TryParse<RegistrationStatus>(v, ignoreCase: true, out _))
            .WithMessage($"RegistrationStatus must be one of: {string.Join(", ", Enum.GetNames<RegistrationStatus>())}.");

        RuleFor(x => x.Status)
            .Must(v => Enum.TryParse<EditionStatus>(v, ignoreCase: true, out _))
            .WithMessage($"Status must be one of: {string.Join(", ", Enum.GetNames<EditionStatus>())}.")
            .When(x => !string.IsNullOrEmpty(x.Status));

        RuleFor(x => x.Year)
            .InclusiveBetween(2000, 2100)
            .When(x => x.Year.HasValue);

        RuleFor(x => x.EndDate)
            .Must((cmd, endDate) => endDate == null || cmd.Date == null || endDate >= cmd.Date)
            .WithMessage("EndDate must be on or after Date.");
    }
}
