var builder = WebApplication.CreateBuilder(args);
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();

var api = app.MapGroup("/api/v1");

api.MapGet("/health", () => Results.Ok(
        new
    {
        status = "healthy",
        service = "backend",
        version = "v1",
        timestampUtc = DateTime.UtcNow,
    }))
    .WithName("Health");

app.MapGet("/", () => new
{
    message = "Backend API running!",
});

app.Run();
