using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Infrastructure.Retention;

public class FeedbackRetentionOptions
{
    /// <summary>
    /// How long a feedback report's screenshot and browser metadata are kept before being
    /// cleared. 60 days — the owner's final 30-vs-60-day call per #768 is still pending, so
    /// this leans toward the safer (shorter) retention until that's confirmed; change here
    /// only, nowhere else reads this value.
    /// </summary>
    public TimeSpan Retention { get; init; } = TimeSpan.FromDays(60);

    /// <summary>How often the sweep runs.</summary>
    public TimeSpan Interval { get; init; } = TimeSpan.FromHours(24);

    /// <summary>
    /// Delay before the first sweep, so it does not compete with startup.
    /// </summary>
    public TimeSpan InitialDelay { get; init; } = TimeSpan.FromMinutes(5);
}

/// <summary>
/// Runs <see cref="FeedbackRetentionSweeper"/> on a timer.
///
/// <para>
/// An in-process background service rather than external scheduling: the app is
/// configured with <c>min_machines_running = 1</c> and
/// <c>auto_stop_machines = 'off'</c>, so exactly one instance is always up and
/// there is nothing to coordinate. The work is a single idempotent UPDATE —
/// running it twice, or missing a day, changes nothing.
/// </para>
/// </summary>
public class FeedbackRetentionService : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly FeedbackRetentionOptions _options;
    private readonly TimeProvider _timeProvider;
    private readonly ILogger<FeedbackRetentionService> _logger;

    public FeedbackRetentionService(
        IServiceProvider services,
        FeedbackRetentionOptions options,
        TimeProvider timeProvider,
        ILogger<FeedbackRetentionService> logger)
    {
        _services = services;
        _options = options;
        _timeProvider = timeProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "Feedback retention: clearing screenshots and browser info older than {Days} days, every {Hours}h",
            _options.Retention.TotalDays, _options.Interval.TotalHours);

        try
        {
            await Task.Delay(_options.InitialDelay, stoppingToken);
        }
        catch (OperationCanceledException)
        {
            return;
        }

        using var timer = new PeriodicTimer(_options.Interval);
        do
        {
            await SweepAsync(stoppingToken);
        }
        while (await SafeWaitAsync(timer, stoppingToken));
    }

    private async Task SweepAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var scope = _services.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<UtanvegaDbContext>();

            var affected = await FeedbackRetentionSweeper.SweepAsync(
                context, _options.Retention, _timeProvider.GetUtcNow(), cancellationToken);

            if (affected > 0)
            {
                _logger.LogInformation("Feedback retention: cleared {Count} rows", affected);
            }
        }
        catch (OperationCanceledException)
        {
            // Shutting down — nothing to report.
        }
        catch (Exception ex)
        {
            // Never let a failed sweep take the host down; the next one retries.
            _logger.LogError(ex, "Feedback retention sweep failed");
        }
    }

    private static async Task<bool> SafeWaitAsync(PeriodicTimer timer, CancellationToken cancellationToken)
    {
        try
        {
            return await timer.WaitForNextTickAsync(cancellationToken);
        }
        catch (OperationCanceledException)
        {
            return false;
        }
    }
}
