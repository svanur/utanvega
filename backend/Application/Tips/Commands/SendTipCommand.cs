using FluentValidation;
using MediatR;
using Utanvega.Backend.Core.Services;

namespace Utanvega.Backend.Application.Tips.Commands;

public record SendTipCommand(string PageUrl, string Message) : IRequest<bool>;

public class SendTipCommandValidator : AbstractValidator<SendTipCommand>
{
    public SendTipCommandValidator()
    {
        RuleFor(x => x.PageUrl)
            .NotEmpty()
            .MaximumLength(500)
            .Must(url => Uri.TryCreate(url, UriKind.Absolute, out var uri)
                         && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps))
            .WithMessage("PageUrl must be a valid HTTP or HTTPS URL.");

        RuleFor(x => x.Message)
            .NotEmpty()
            .MaximumLength(2000);
    }
}

public class SendTipCommandHandler : IRequestHandler<SendTipCommand, bool>
{
    private readonly IEmailService _email;
    private readonly IConfiguration _config;

    public SendTipCommandHandler(IEmailService email, IConfiguration config)
    {
        _email = email;
        _config = config;
    }

    public async Task<bool> Handle(SendTipCommand request, CancellationToken cancellationToken)
    {
        var to = _config["Resend:TipRecipient"] ?? "oskar@hlaupadagskra.is";
        var subject = $"Tip: {request.PageUrl}";
        var body = $"Page: {request.PageUrl}\n\n{request.Message}";

        await _email.SendAsync(to, subject, body, cancellationToken);
        return true;
    }
}
