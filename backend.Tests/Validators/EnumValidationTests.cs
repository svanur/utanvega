using Utanvega.Backend.Application.Validation;
using Utanvega.Backend.Core.Entities;

namespace backend.Tests.Validators;

public class EnumValidationTests
{
    [Theory]
    [InlineData("Active")]
    [InlineData("unconfirmed")]
    [InlineData("COMPLETED")]
    public void IsDefined_NamedValue_ReturnsTrue(string value)
    {
        Assert.True(EnumValidation.IsDefined<EditionStatus>(value));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("NotAStatus")]
    public void IsDefined_MissingOrUnnamedValue_ReturnsFalse(string? value)
    {
        Assert.False(EnumValidation.IsDefined<EditionStatus>(value));
    }

    [Theory]
    [InlineData("0")]
    [InlineData("4")]
    [InlineData("99")]
    [InlineData("-1")]
    public void IsDefined_NumericString_ReturnsFalse(string value)
    {
        // Enum.TryParse alone accepts any numeric string that fits the underlying type, named member
        // or not — "0" and "4" happen to map to real EditionStatus members (Active, Completed) when
        // parsed as the enum's ordinal, so a bare TryParse would wrongly accept them as text input too.
        // A status value arriving as JSON should only ever be the member name, never its ordinal.
        Assert.False(EnumValidation.IsDefined<EditionStatus>(value));
    }

    [Fact]
    public void IsDefined_WorksAcrossDifferentEnums()
    {
        Assert.True(EnumValidation.IsDefined<RaceStatus>("Cancelled"));
        Assert.False(EnumValidation.IsDefined<RaceStatus>("99"));
    }
}
