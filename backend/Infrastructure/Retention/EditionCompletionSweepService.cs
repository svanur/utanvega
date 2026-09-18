using Utanvega.Backend.Application.Caching;
using Utanvega.Backend.Infrastructure.Persistence;

namespace Utanvega.Backend.Infrastructure.Retention;

public class EditionCompletionSweepOptions
{
    /// <summary>How often the sweep runs.</summary>
    public TimeSpan Interval { get; init; } = TimeSpan.FromHours(24);

    /// <summary>
    /// Delay before the first sweep, so it does not compete with startup.
    /// </summary>
    public TimeSpan InitialDelay { get; init; } = TimeSpan.FromMinutes(5);
}

/// <summary>
/// Runs <see cref="EditionCompletionSweep"/> on a timer.
///
/// <para>
/// An in-process background service rather than external scheduling: the app is
/// configured with <c>min_machines_running = 1</c> and
/// <c>auto_stop_machines = 'off'</c>, so exactly one instance is always up and
/// there is nothing to coordinate. The work is idempotent — a past-dated Active
/// edition transitions to Completed once, and every sweep after that is a no-op
/// for it, whether the previous sweep ran, was missed, or ran twice.
/// </para>
/// </summary>
public class EditionCompletionSweepService : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly EditionCompletionSweepOptions _options;
    private readonly TimeProvider _timeProvider;
    private readonly ILogger<EditionCompletionSweepService> _logger;

    public EditionCompletionSweepService(
        IServiceProvider services,
        EditionCompletionSweepOptions options,
        TimeProvider timeProvider,
        ILogger<EditionCompletionSweepService> logger)
    {
        _services = services;
        _options = options;
        _timeProvider = timeProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "Edition completion sweep: completing past-dated Active editions every {Hours}h",
            _options.Interval.TotalHours);

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
        using var scope = _services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<UtanvegaDbContext>();
        var cacheInvalidator = scope.ServiceProvider.GetRequiredService<ICacheInvalidator>();
        var today = DateOnly.FromDateTime(_timeProvider.GetUtcNow().UtcDateTime);

        try
        {
            var completed = await EditionCompletionSweep.RunAsync(context, cacheInvalidator, today, cancellationToken);

            if (completed > 0)
            {
                _logger.LogInformation("Edition completion sweep: completed {Count} editions", completed);
            }
        }
        catch (OperationCanceledException)
        {
            // Shutting down — nothing to report.
        }
        catch (Exception ex)
        {
            // Never let a failed sweep take the host down; the next one retries.
            _logger.LogError(ex, "Edition completion sweep failed");
        }

        // Own try/catch: a clone failure must never block, or be blocked by, the completion
        // sweep above. They deliberately run back-to-back in the same pass — so an edition
        // completed in the block above is picked up for cloning the same cycle it completes in —
        // but they're independent failure domains. See #904.
        try
        {
            var cloned = await EditionAutoCloneSweep.RunAsync(context, cacheInvalidator, today, cancellationToken);

            if (cloned > 0)
            {
                _logger.LogInformation("Edition auto-clone sweep: cloned {Count} editions for next year", cloned);
            }
        }
        catch (OperationCanceledException)
        {
            // Shutting down — nothing to report.
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Edition auto-clone sweep failed");
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
