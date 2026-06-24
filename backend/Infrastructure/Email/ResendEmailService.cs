using System.Text;
using System.Text.Json;
using Utanvega.Backend.Core.Services;

namespace Utanvega.Backend.Infrastructure.Email;

public class ResendEmailService : IEmailService
{
    private readonly HttpClient _http;
    private readonly string _from;
    private readonly ILogger<ResendEmailService> _logger;

    public ResendEmailService(HttpClient http, IConfiguration config, ILogger<ResendEmailService> logger)
    {
        _http = http;
        _from = config["Resend:From"] ?? "tips@hlaupadagskra.is";
        _logger = logger;
    }

    public async Task SendAsync(string to, string subject, string textBody, CancellationToken cancellationToken = default)
    {
        var payload = new
        {
            from = _from,
            to = new[] { to },
            subject,
            text = textBody,
        };

        var json = JsonSerializer.Serialize(payload);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        var response = await _http.PostAsync("https://api.resend.com/emails", content, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogError("Resend API error {StatusCode}: {Body}", response.StatusCode, body);
            throw new InvalidOperationException($"Failed to send email: {response.StatusCode}");
        }
    }
}
