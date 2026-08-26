using Microsoft.EntityFrameworkCore;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Infrastructure.Retention;

public class TrailViewRetentionOptions
{
    /// <summary>How long an IP hash is kept before being cleared.</summary>
    public TimeSpan Retention { get; init; } = TimeSpan.FromDays(90);

    /// <summary>How often the sweep runs.</summary>
    public TimeSpan Interval { get; init; } = TimeSpan.FromHours(24);

    /// <summary>
    /// Delay before the first sweep, so it does not compete with startup.
    /// </summary>
    public TimeSpan InitialDelay { get; init; } = TimeSpan.FromMinutes(5);
}

/// <summary>
/// Runs <see cref="TrailViewAnonymizer"/> on a timer.
///
/// <para>
/// An in-process background service rather than external scheduling: the app is
/// configured with <c>min_machines_running = 1</c> and
/// <c>auto_stop_machines = 'off'</c>, so exactly one instance is always up and
/// there is nothing to coordinate. The work is a single idempotent UPDATE —
/// running it twice, or missing a day, changes nothing.
/// </para>
/// </summary>
public class TrailViewRetentionService : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly TrailViewRetentionOptions _options;
    private readonly TimeProvider _timeProvider;
    private readonly ILogger<TrailViewRetentionService> _logger;

    public TrailViewRetentionService(
        IServiceProvider services,
        TrailViewRetentionOptions options,
        TimeProvider timeProvider,
        ILogger<TrailViewRetentionService> logger)
    {
        _services = services;
        _options = options;
        _timeProvider = timeProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "Trail view retention: clearing IP hashes older than {Days} days, every {Hours}h",
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

            var affected = await TrailViewAnonymizer.AnonymizeAsync(
                context, _options.Retention, _timeProvider.GetUtcNow().UtcDateTime, cancellationToken);

            if (affected > 0)
            {
                _logger.LogInformation("Trail view retention: cleared {Count} IP hashes", affected);
            }
        }
        catch (OperationCanceledException)
        {
            // Shutting down — nothing to report.
        }
        catch (Exception ex)
        {
            // Never let a failed sweep take the host down; the next one retries.
            _logger.LogError(ex, "Trail view retention sweep failed");
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
