using FluentValidation.TestHelper;
using Utanvega.Backend.Application.Tips.Commands;

namespace Utanvega.Backend.Tests.Validators;

public class SendTipCommandValidatorTests
{
    private readonly SendTipCommandValidator _validator = new();

    private SendTipCommand Valid => new("https://hlaupadagskra.is/trails/laugavegur", "Great trail, missing parking info");

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

    // ─── Message ───

    [Theory]
    [InlineData("")]
    [InlineData(null)]
    public void EmptyMessage_FailsValidation(string? msg)
    {
        var cmd = Valid with { Message = msg! };
        _validator.TestValidate(cmd).ShouldHaveValidationErrorFor(x => x.Message);
    }

    [Fact]
    public void Message_ExceedingMaxLength_FailsValidation()
    {
        var cmd = Valid with { Message = new string('x', 2001) };
        _validator.TestValidate(cmd).ShouldHaveValidationErrorFor(x => x.Message);
    }

    [Fact]
    public void Message_AtMaxLength_PassesValidation()
    {
        var cmd = Valid with { Message = new string('x', 2000) };
        _validator.TestValidate(cmd).ShouldNotHaveValidationErrorFor(x => x.Message);
    }
}
