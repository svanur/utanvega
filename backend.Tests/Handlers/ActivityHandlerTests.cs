namespace Utanvega.Backend.Tests.Handlers;
using Utanvega.Backend.Application.Activities.Commands.CreateUserTrailActivity;
using Utanvega.Backend.Application.Activities.Commands.DeleteUserTrailActivity;
using Utanvega.Backend.Application.Activities.Commands.UpdateUserTrailActivity;
using Utanvega.Backend.Application.Activities.Queries.GetUserTrailActivities;
using Utanvega.Backend.Core.Entities;
using Xunit;
using MediatR;
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
                new UserTrailActivity { Id = Guid.NewGuid(), UserId = userId, TrailSlug = "helgafell", Time = 3600, IsPublic = false, LoggedAt = now, CreatedAt = now },
                new UserTrailActivity { Id = Guid.NewGuid(), UserId = userId, TrailSlug = "esja", Time = 5400, IsPublic = true, LoggedAt = now, CreatedAt = now },
                new UserTrailActivity { Id = Guid.NewGuid(), UserId = otherUserId, TrailSlug = "helgafell", Time = 4000, IsPublic = false, LoggedAt = now, CreatedAt = now }
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
                new UserTrailActivity { Id = Guid.NewGuid(), UserId = userId, TrailSlug = "first", Time = 100, IsPublic = false, LoggedAt = baseTime, CreatedAt = baseTime.AddHours(-2) },
                new UserTrailActivity { Id = Guid.NewGuid(), UserId = userId, TrailSlug = "second", Time = 200, IsPublic = false, LoggedAt = baseTime, CreatedAt = baseTime.AddHours(-1) },
                new UserTrailActivity { Id = Guid.NewGuid(), UserId = userId, TrailSlug = "third", Time = 300, IsPublic = false, LoggedAt = baseTime, CreatedAt = baseTime }
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
        var handler = new CreateUserTrailActivityHandler(context, new Moq.Mock<IMediator>().Object);
        var command = new CreateUserTrailActivityCommand(userId, "esja", 5400, 12.5m, 800, new DateOnly(2026, 5, 3), "Great run!", true);
        var response = await handler.Handle(command, CancellationToken.None);
        Assert.NotEqual(Guid.Empty, response.Id);
        Assert.Equal(userId, response.UserId);
        Assert.Equal("esja", response.TrailSlug);
        Assert.Equal(5400, response.Time);
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
            context.UserTrailActivities.Add(new UserTrailActivity { Id = activityId, UserId = userId, TrailSlug = "helgafell", Time = 3600, IsPublic = false, LoggedAt = now, CreatedAt = now });
            await context.SaveChangesAsync();
        }
        using var updateContext = _factory.CreateContext();
        var handler = new UpdateUserTrailActivityHandler(updateContext);
        var response = await handler.Handle(new UpdateUserTrailActivityCommand(activityId, userId, 4000, 15m, 900, new DateOnly(2026, 5, 3), "Updated notes", true), CancellationToken.None);
        Assert.Equal(4000, response.Time);
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
            context.UserTrailActivities.Add(new UserTrailActivity { Id = activityId, UserId = userId, TrailSlug = "helgafell", Time = 3600, IsPublic = false, LoggedAt = now, CreatedAt = now });
            await context.SaveChangesAsync();
        }
        using var updateContext = _factory.CreateContext();
        var handler = new UpdateUserTrailActivityHandler(updateContext);
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            handler.Handle(new UpdateUserTrailActivityCommand(activityId, Guid.NewGuid(), 4000, null, null, null, null, false), CancellationToken.None));
    }
    [Fact]
    public async Task DeleteUserTrailActivity_RemovesActivity()
    {
        var userId = Guid.NewGuid();
        var activityId = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;
        await using (var context = _factory.CreateContext())
        {
            context.UserTrailActivities.Add(new UserTrailActivity { Id = activityId, UserId = userId, TrailSlug = "esja", Time = 3600, IsPublic = false, LoggedAt = now, CreatedAt = now });
            await context.SaveChangesAsync();
        }
        using var deleteContext = _factory.CreateContext();
        await new DeleteUserTrailActivityHandler(deleteContext).Handle(new DeleteUserTrailActivityCommand(activityId, userId), CancellationToken.None);
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
            context.UserTrailActivities.Add(new UserTrailActivity { Id = activityId, UserId = userId, TrailSlug = "esja", Time = 3600, IsPublic = false, LoggedAt = now, CreatedAt = now });
            await context.SaveChangesAsync();
        }
        using var deleteContext = _factory.CreateContext();
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            new DeleteUserTrailActivityHandler(deleteContext).Handle(new DeleteUserTrailActivityCommand(activityId, Guid.NewGuid()), CancellationToken.None));
    }
}
