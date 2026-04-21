using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Npgsql;
using Respawn;
using ClientManager.API.Data;
using ClientManager.API.Models;
using Microsoft.EntityFrameworkCore;

namespace ClientManager.Tests;

/// <summary>
/// Arranca la API en memoria apuntando a la BD de tests.
/// Se comparte entre todos los tests de una clase (IClassFixture).
/// InitializeAsync aplica migraciones e inicializa Respawn una vez.
/// ResetDatabaseAsync limpia los datos antes de cada test individual.
/// </summary>
public class CustomWebApplicationFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    // Connection string fija para la BD de tests — base de datos separada de la de desarrollo.
    private const string TestConnectionString =
        "Host=localhost;Database=clientmanager_tests;Username=postgres;Password=admin1234";

    private NpgsqlConnection _connection = null!;
    private Respawner _respawner = null!;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");

        // Sobreescribir configuración para que la API use la BD de tests y no necesite User Secrets.
        // AddJsonFile/AddUserSecrets cargados por CreateDefaultBuilder van antes; nuestro
        // AddInMemoryCollection aquí va después y pisa todo lo anterior.
        builder.ConfigureAppConfiguration((ctx, config) =>
        {
            // Limpiar sources anteriores para que User Secrets del proyecto API no se mezclen.
            config.Sources.Clear();
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = TestConnectionString,
                ["Jwt:SecretKey"]         = "TestSecretKey_32CharsMinimumXXXXXX",
                ["Jwt:Issuer"]            = "ClientManagerAPI",
                ["Jwt:Audience"]          = "ClientManagerApp",
                ["Jwt:ExpiryInMinutes"]   = "15",
                ["SuperAdmin:Email"]      = "admin@clientmanager.local",
                ["SuperAdmin:Password"]   = "TestAdmin@2026!",
                ["Cors:AllowedOrigins:0"] = "http://localhost:4200",
                ["Frontend:BaseUrl"]      = "http://localhost:4200",
                ["Email:Host"]            = "localhost",
                ["Email:Port"]            = "2525",
                ["Email:FromAddress"]     = "test@test.local",
                ["Email:FromName"]        = "Test",
            });
        });

        // Forzar la clave de firma/validación JWT al valor de test.
        // Program.cs captura Jwt:SecretKey en una local ANTES de que nuestra ConfigureAppConfiguration
        // corra, por lo que la TokenValidationParameters queda con la clave vieja (User Secrets).
        // AuthService, en cambio, lee IConfiguration en runtime y sí ve la clave nueva → mismatch.
        // Pisamos JwtBearerOptions con PostConfigure para alinear ambas.
        builder.ConfigureTestServices(services =>
        {
            services.PostConfigure<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme, opts =>
            {
                opts.TokenValidationParameters.IssuerSigningKey =
                    new SymmetricSecurityKey(Encoding.UTF8.GetBytes("TestSecretKey_32CharsMinimumXXXXXX"));
                opts.TokenValidationParameters.ValidIssuer   = "ClientManagerAPI";
                opts.TokenValidationParameters.ValidAudience = "ClientManagerApp";
            });

            // Desactivar rate limiting en tests: todas las peticiones comparten IP en el TestServer,
            // así que después de 5 requests a /api/auth/* el 6º recibiría 429. Reemplazamos la política
            // "auth" por un NoLimiter. Quitamos el IConfigureOptions original antes de re-registrar
            // para evitar el "Policy already exists" que lanza AddPolicy.
            services.RemoveAll<IConfigureOptions<RateLimiterOptions>>();
            services.Configure<RateLimiterOptions>(options =>
            {
                options.AddPolicy("auth", _ => RateLimitPartition.GetNoLimiter("test"));
            });
        });
    }

    public async Task InitializeAsync()
    {
        // Aplicar migraciones a la BD de tests (solo si faltan — idempotente).
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await db.Database.MigrateAsync();

        // Abrir conexión persistente que Respawn usará para limpiar datos.
        _connection = new NpgsqlConnection(TestConnectionString);
        await _connection.OpenAsync();

        _respawner = await Respawner.CreateAsync(_connection, new RespawnerOptions
        {
            DbAdapter        = DbAdapter.Postgres,
            SchemasToInclude = ["public"],
            // No borrar el historial de migraciones ni los roles/admin del seed.
            TablesToIgnore   =
            [
                new Respawn.Graph.Table("__EFMigrationsHistory"),
                new Respawn.Graph.Table("AspNetRoles"),
            ],
        });
    }

    /// <summary>Llamado antes de cada test para dejar la BD limpia con solo los datos de seed.</summary>
    public async Task ResetDatabaseAsync()
    {
        await _respawner.ResetAsync(_connection);
        await SeedAsync();
    }

    // Respawn borra AspNetUsers entre tests — hay que volver a crear el SuperAdmin de seed.
    private async Task SeedAsync()
    {
        using var scope = Services.CreateScope();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();

        foreach (var role in new[] { "SuperAdmin", "Cliente" })
            if (!await roleManager.RoleExistsAsync(role))
                await roleManager.CreateAsync(new IdentityRole(role));

        if (await userManager.FindByEmailAsync("admin@clientmanager.local") is null)
        {
            var admin = new ApplicationUser
            {
                UserName       = "admin@clientmanager.local",
                Email          = "admin@clientmanager.local",
                EmailConfirmed = true,
                CreatedAt      = DateTime.UtcNow
            };
            var result = await userManager.CreateAsync(admin, "TestAdmin@2026!");
            if (result.Succeeded)
                await userManager.AddToRoleAsync(admin, "SuperAdmin");
        }
    }

    public new async Task DisposeAsync()
    {
        await _connection.DisposeAsync();
        await base.DisposeAsync();
    }
}
