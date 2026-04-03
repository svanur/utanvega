using FluentValidation.TestHelper;
using Utanvega.Backend.Application.Trails.Commands.BulkTrailAction;

namespace backend.Tests.Validators;

public class BulkTrailActionCommandValidatorTests
{
    private readonly BulkTrailActionCommandValidator _validator = new();

    [Fact]
    public void ValidDeleteCommand_Passes()
    {
        var cmd = new BulkTrailActionCommand([Guid.NewGuid()], BulkTrailActionType.Delete);
        var result = _validator.TestValidate(cmd);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void EmptyIds_Fails()
    {
        var cmd = new BulkTrailActionCommand([], BulkTrailActionType.Delete);
        var result = _validator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Ids);
    }

    [Fact]
    public void UpdateStatus_WithoutValue_Fails()
    {
        var cmd = new BulkTrailActionCommand([Guid.NewGuid()], BulkTrailActionType.UpdateStatus);
        var result = _validator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Value);
    }

    [Fact]
    public void UpdateStatus_WithValue_Passes()
    {
        var cmd = new BulkTrailActionCommand([Guid.NewGuid()], BulkTrailActionType.UpdateStatus, "Published");
        var result = _validator.TestValidate(cmd);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Delete_WithoutValue_Passes()
    {
        var cmd = new BulkTrailActionCommand([Guid.NewGuid()], BulkTrailActionType.Delete);
        var result = _validator.TestValidate(cmd);
        result.ShouldNotHaveValidationErrorFor(x => x.Value);
    }

    [Fact]
    public void UpdateDifficulty_WithoutValue_Fails()
    {
        var cmd = new BulkTrailActionCommand([Guid.NewGuid()], BulkTrailActionType.UpdateDifficulty);
        var result = _validator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Value);
    }

    [Fact]
    public void UpdateVisibility_WithValue_Passes()
    {
        var cmd = new BulkTrailActionCommand([Guid.NewGuid()], BulkTrailActionType.UpdateVisibility, "Private");
        var result = _validator.TestValidate(cmd);
        result.ShouldNotHaveAnyValidationErrors();
    }
}
