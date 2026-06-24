namespace Utanvega.Backend.Core.Services;

public interface IEmailService
{
    Task SendAsync(string to, string subject, string textBody, CancellationToken cancellationToken = default);
}
