using FluentValidation;

namespace Utanvega.Backend.Application.PhotoGalleries;

public class UpdatePhotoGalleryCommandValidator : AbstractValidator<UpdatePhotoGalleryCommand>
{
    public UpdatePhotoGalleryCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();

        // Same rule as CreateEditionCommandValidator's PhotoGalleryUrl, except Url is required here
        // (a gallery with no URL has nothing to link to).
        RuleFor(x => x.Url).NotEmpty();

        RuleFor(x => x.Url)
            .MaximumLength(500)
            .Must(url => Uri.TryCreate(url, UriKind.Absolute, out _))
            .WithMessage("Url must be a valid URL.")
            .When(x => !string.IsNullOrEmpty(x.Url));

        RuleFor(x => x.Title)
            .MaximumLength(200)
            .When(x => x.Title is not null);

        RuleFor(x => x.TitleEn)
            .MaximumLength(200)
            .When(x => x.TitleEn is not null);

        RuleFor(x => x.SortOrder).GreaterThanOrEqualTo(0);
    }
}
