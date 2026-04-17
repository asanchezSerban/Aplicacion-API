using ClientManager.API.Data;
using Microsoft.EntityFrameworkCore;

namespace ClientManager.API.Services;

/// <summary>
/// Servicio en segundo plano que elimina periódicamente tokens y OTPs expirados.
/// Se ejecuta cada hora para evitar que las tablas RefreshTokens y EmailOtpCodes
/// crezcan indefinidamente con registros caducados.
/// </summary>
public class CleanupHostedService : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromHours(1);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<CleanupHostedService> _logger;

    public CleanupHostedService(IServiceScopeFactory scopeFactory, ILogger<CleanupHostedService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger       = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("CleanupHostedService arrancado");

        while (!stoppingToken.IsCancellationRequested)
        {
            await DoCleanupAsync(stoppingToken);

            try
            {
                await Task.Delay(Interval, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }

        _logger.LogInformation("CleanupHostedService detenido");
    }

    private async Task DoCleanupAsync(CancellationToken ct)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var db  = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var now = DateTime.UtcNow;

            var refreshDeleted = await db.RefreshTokens
                .Where(r => r.ExpiresAt < now)
                .ExecuteDeleteAsync(ct);

            var otpDeleted = await db.EmailOtpCodes
                .Where(o => o.ExpiresAt < now || o.IsUsed)
                .ExecuteDeleteAsync(ct);

            if (refreshDeleted > 0 || otpDeleted > 0)
                _logger.LogInformation(
                    "Limpieza periódica: {Refresh} refresh tokens y {Otp} OTPs eliminados",
                    refreshDeleted, otpDeleted);
        }
        catch (OperationCanceledException) { }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error durante la limpieza periódica de tokens");
        }
    }
}
