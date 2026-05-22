using FluentValidation;

namespace Utanvega.Backend.Application.Events.Commands.GenerateEditionsForSeason;

public class GenerateEditionsForSeasonCommandValidator : AbstractValidator<GenerateEditionsForSeasonCommand>
{
    public GenerateEditionsForSeasonCommandValidator()
    {
        RuleFor(x => x.EventId).NotEmpty();

        RuleFor(x => x.From).NotEmpty();
        RuleFor(x => x.To).NotEmpty();

        RuleFor(x => x)
            .Must(x => x.To >= x.From)
            .WithMessage("To must be on or after From.");

        RuleFor(x => x)
            .Must(x => x.To.DayNumber - x.From.DayNumber <= 730)
            .WithMessage("Date range cannot exceed 2 years.");
    }
}
