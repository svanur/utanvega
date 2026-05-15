namespace Utanvega.Backend.Tests.Handlers;
using Utanvega.Backend.Application.Activities.Commands.CreateUserTrailActivity;
using Utanvega.Backend.Application.Activities.Commands.DeleteUserTrailActivity;
using Utanvega.Backend.Application.Activities.Commands.UpdateUserTrailActivity;
using Utanvega.Backend.Application.Activities.Queries.GetUserTrailActivities;
using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Core.Entities;
using Xunit;
using Moq;
public class ActivityHandlerTests : IDisposable
{
    private readonly TestDbContextFactory _factory;
    public ActivityHandlerTests() => _factory = new TestDbContextFactory();
    public void Dispose() => _factory.Dispose();
    [Fact]
    public async Task GetUserTrailActivities_ReturnsEmptyList_WhenNoActivities()
    {
        using var context = _factory.CreateContext();
        var handler = new GetUserTrailActivitiesHandler(context);
        var result = await handler.Handle(new GetUserTrailActivitiesQuery(Guid.NewGuid()), CancellationToken.None);
        Assert.Empty(result.Activities);
    }
    [Fact]
    public async Task GetUserTrailActivities_ReturnsOnlyCurrentUserActivities()
    {
        var userId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;
        await using (var context = _factory.CreateContext())
        {
            context.UserTrailActivities.AddRange(
                new UserTrailActivity { Id = Guid.NewGuid(), UserId = userId, TrailSlug = "helgafell", TimeInSeconds = 3600, IsPublic = false, LoggedAt = now, CreatedAt = now },
                new UserTrailActivity { Id = Guid.NewGuid(), UserId = userId, TrailSlug = "esja", TimeInSeconds = 5400, IsPublic = true, LoggedAt = now, CreatedAt = now },
                new UserTrailActivity { Id = Guid.NewGuid(), UserId = otherUserId, TrailSlug = "helgafell", TimeInSeconds = 4000, IsPublic = false, LoggedAt = now, CreatedAt = now }
            );
            await context.SaveChangesAsync();
        }
        using var readContext = _factory.CreateContext();
        var handler = new GetUserTrailActivitiesHandler(readContext);
        var result = await handler.Handle(new GetUserTrailActivitiesQuery(userId), CancellationToken.None);
        Assert.Equal(2, result.Activities.Count);
        Assert.All(result.Activities, a => Assert.Equal(userId, a.UserId));
    }
    [Fact]
    public async Task GetUserTrailActivities_ReturnsActivitiesOrderedByCreatedAtDescending()
    {
        var userId = Guid.NewGuid();
        var baseTime = DateTimeOffset.UtcNow;
        await using (var context = _factory.CreateContext())
        {
            context.UserTrailActivities.AddRange(
                new UserTrailActivity { Id = Guid.NewGuid(), UserId = userId, TrailSlug = "first", TimeInSeconds = 100, IsPublic = false, LoggedAt = baseTime, CreatedAt = baseTime.AddHours(-2) },
                new UserTrailActivity { Id = Guid.NewGuid(), UserId = userId, TrailSlug = "second", TimeInSeconds = 200, IsPublic = false, LoggedAt = baseTime, CreatedAt = baseTime.AddHours(-1) },
                new UserTrailActivity { Id = Guid.NewGuid(), UserId = userId, TrailSlug = "third", TimeInSeconds = 300, IsPublic = false, LoggedAt = baseTime, CreatedAt = baseTime }
            );
            await context.SaveChangesAsync();
        }
        using var readContext = _factory.CreateContext();
        var handler = new GetUserTrailActivitiesHandler(readContext);
        var result = await handler.Handle(new GetUserTrailActivitiesQuery(userId), CancellationToken.None);
        Assert.Equal(3, result.Activities.Count);
        Assert.Equal("third", result.Activities[0].TrailSlug);
        Assert.Equal("second", result.Activities[1].TrailSlug);
        Assert.Equal("first", result.Activities[2].TrailSlug);
    }
    [Fact]
    public async Task CreateUserTrailActivity_PersistsAndReturnsActivity()
    {
        var userId = Guid.NewGuid();
        using var context = _factory.CreateContext();
        var mockInvalidator = new Mock<ICacheInvalidator>();
        var handler = new CreateUserTrailActivityHandler(context, mockInvalidator.Object);
        var command = new CreateUserTrailActivityCommand(userId, "esja", new DateOnly(2026, 5, 3), 5400, 12.5m, 800, "Great run!", true);
        var response = await handler.Handle(command, CancellationToken.None);
        Assert.NotEqual(Guid.Empty, response.Id);
        Assert.Equal(userId, response.UserId);
        Assert.Equal("esja", response.TrailSlug);
        Assert.Equal(5400, response.TimeInSeconds);
        using var verifyContext = _factory.CreateContext();
        var saved = await verifyContext.UserTrailActivities.FindAsync(response.Id);
        Assert.NotNull(saved);
    }
    [Fact]
    public async Task UpdateUserTrailActivity_UpdatesFields()
    {
        var userId = Guid.NewGuid();
        var activityId = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;
        await using (var context = _factory.CreateContext())
        {
            context.UserTrailActivities.Add(new UserTrailActivity { Id = activityId, UserId = userId, TrailSlug = "helgafell", TimeInSeconds = 3600, IsPublic = false, LoggedAt = now, CreatedAt = now });
            await context.SaveChangesAsync();
        }
        using var updateContext = _factory.CreateContext();
        var mockInvalidator = new Mock<ICacheInvalidator>();
        var handler = new UpdateUserTrailActivityHandler(updateContext, mockInvalidator.Object);
        var response = await handler.Handle(new UpdateUserTrailActivityCommand(activityId, userId, new DateOnly(2026, 5, 3), 4000, 15m, 900, "Updated notes", true), CancellationToken.None);
        Assert.Equal(4000, response.TimeInSeconds);
        Assert.Equal("Updated notes", response.Notes);
        Assert.True(response.IsPublic);
    }
    [Fact]
    public async Task UpdateUserTrailActivity_ThrowsUnauthorized_WhenWrongUser()
    {
        var userId = Guid.NewGuid();
        var activityId = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;
        await using (var context = _factory.CreateContext())
        {
            context.UserTrailActivities.Add(new UserTrailActivity { Id = activityId, UserId = userId, TrailSlug = "helgafell", TimeInSeconds = 3600, IsPublic = false, LoggedAt = now, CreatedAt = now });
            await context.SaveChangesAsync();
        }
        using var updateContext = _factory.CreateContext();
        var mockInvalidator = new Mock<ICacheInvalidator>();
        var handler = new UpdateUserTrailActivityHandler(updateContext, mockInvalidator.Object);
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            handler.Handle(new UpdateUserTrailActivityCommand(activityId, Guid.NewGuid(), null, 4000, null, null, null, false), CancellationToken.None));
    }
    [Fact]
    public async Task DeleteUserTrailActivity_RemovesActivity()
    {
        var userId = Guid.NewGuid();
        var activityId = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;
        await using (var context = _factory.CreateContext())
        {
            context.UserTrailActivities.Add(new UserTrailActivity { Id = activityId, UserId = userId, TrailSlug = "esja", TimeInSeconds = 3600, IsPublic = false, LoggedAt = now, CreatedAt = now });
            await context.SaveChangesAsync();
        }
        using var deleteContext = _factory.CreateContext();
        var mockInvalidator = new Mock<ICacheInvalidator>();
        await new DeleteUserTrailActivityHandler(deleteContext, mockInvalidator.Object).Handle(new DeleteUserTrailActivityCommand(activityId, userId), CancellationToken.None);
        using var verifyContext = _factory.CreateContext();
        Assert.Null(await verifyContext.UserTrailActivities.FindAsync(activityId));
    }
    [Fact]
    public async Task DeleteUserTrailActivity_ThrowsUnauthorized_WhenWrongUser()
    {
        var userId = Guid.NewGuid();
        var activityId = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;
        await using (var context = _factory.CreateContext())
        {
            context.UserTrailActivities.Add(new UserTrailActivity { Id = activityId, UserId = userId, TrailSlug = "esja", TimeInSeconds = 3600, IsPublic = false, LoggedAt = now, CreatedAt = now });
            await context.SaveChangesAsync();
        }
        using var deleteContext = _factory.CreateContext();
        var mockInvalidator = new Mock<ICacheInvalidator>();
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            new DeleteUserTrailActivityHandler(deleteContext, mockInvalidator.Object).Handle(new DeleteUserTrailActivityCommand(activityId, Guid.NewGuid()), CancellationToken.None));
    }
}
