using FluentValidation.TestHelper;
using Utanvega.Backend.Application.Feedback.Commands;

namespace Utanvega.Backend.Tests.Validators;

public class SubmitFeedbackCommandValidatorTests
{
    private readonly SubmitFeedbackCommandValidator _validator = new();

    private SubmitFeedbackCommand Valid => new(
        "https://hlaupadagskra.is/trails/laugavegur",
        "Great trail, missing parking info",
        "bug",
        "Jane",
        "jane@example.com",
        null,
        null,
        null);

    // ─── PageUrl ───

    [Fact]
    public void ValidCommand_PassesValidation()
    {
        _validator.TestValidate(Valid).ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData("")]
    [InlineData(null)]
    public void EmptyPageUrl_FailsValidation(string? url)
    {
        var cmd = Valid with { PageUrl = url! };
        _validator.TestValidate(cmd).ShouldHaveValidationErrorFor(x => x.PageUrl);
    }

    [Theory]
    [InlineData("not-a-url")]
    [InlineData("ftp://hlaupadagskra.is/trails")]
    [InlineData("javascript:alert(1)")]
    [InlineData("/relative/path")]
    public void InvalidPageUrl_FailsValidation(string url)
    {
        var cmd = Valid with { PageUrl = url };
        _validator.TestValidate(cmd).ShouldHaveValidationErrorFor(x => x.PageUrl);
    }

    [Theory]
    [InlineData("http://hlaupadagskra.is/trails")]
    [InlineData("https://hlaupadagskra.is/trails/laugavegur?foo=bar")]
    public void ValidHttpUrls_PassValidation(string url)
    {
        var cmd = Valid with { PageUrl = url };
        _validator.TestValidate(cmd).ShouldNotHaveValidationErrorFor(x => x.PageUrl);
    }

    [Fact]
    public void PageUrl_ExceedingMaxLength_FailsValidation()
    {
        var longUrl = "https://hlaupadagskra.is/" + new string('a', 480);
        var cmd = Valid with { PageUrl = longUrl };
        _validator.TestValidate(cmd).ShouldHaveValidationErrorFor(x => x.PageUrl);
    }
}
