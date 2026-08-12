namespace Utanvega.Backend.Infrastructure.Translation;

/// <summary>
/// Lazily creates and reuses a single DeepL.Translator instance for the lifetime of the app,
/// instead of constructing one (and its underlying HttpClient) per request.
/// </summary>
public sealed class DeepLTranslatorProvider
{
    private readonly Lazy<DeepL.Translator?> _translator;

    public DeepLTranslatorProvider(IConfiguration config)
    {
        _translator = new Lazy<DeepL.Translator?>(() =>
        {
            var apiKey = config["DeepL:ApiKey"];
            return string.IsNullOrWhiteSpace(apiKey) ? null : new DeepL.Translator(apiKey);
        });
    }

    public DeepL.Translator? Translator => _translator.Value;
}
