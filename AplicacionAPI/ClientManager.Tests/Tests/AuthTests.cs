using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;

namespace ClientManager.Tests.Tests;

/// <summary>
/// Tests de autenticación y autorización.
/// IClassFixture hace que la factory (y la BD) se comparta entre todos los tests de esta clase.
/// IntegrationTestBase limpia los datos antes de cada test individual.
/// </summary>
public class AuthTests : IntegrationTestBase, IClassFixture<CustomWebApplicationFactory>
{
    public AuthTests(CustomWebApplicationFactory factory) : base(factory) { }

    // ── Sin autenticación ─────────────────────────────────────────────────────

    [Fact]
    public async Task GetCompanies_WithoutAuth_Returns401()
    {
        var response = await Client.GetAsync("/api/companies");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ── Login ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Login_WithValidCredentials_Returns200AndNoMfaRequired()
    {
        // El SuperAdmin de seed tiene TotpEnabled=false → no pide MFA, emite tokens directamente.
        var response = await Client.PostAsJsonAsync("/api/auth/login", new
        {
            email    = "admin@clientmanager.local",
            password = "TestAdmin@2026!"
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("requiresMfa").GetBoolean().Should().BeFalse();
    }

    [Fact]
    public async Task Login_WithWrongPassword_Returns401()
    {
        var response = await Client.PostAsJsonAsync("/api/auth/login", new
        {
            email    = "admin@clientmanager.local",
            password = "ContraseñaIncorrecta123!"
        });

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ── Acceso autenticado ────────────────────────────────────────────────────

    [Fact]
    public async Task GetCompanies_AfterLogin_Returns200()
    {
        await LoginAsAdminAsync();

        var response = await Client.GetAsync("/api/companies");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetMe_AfterLogin_ReturnsCorrectIdentity()
    {
        await LoginAsAdminAsync();

        var response = await Client.GetAsync("/api/auth/me");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("email").GetString().Should().Be("admin@clientmanager.local");
        body.GetProperty("role").GetString().Should().Be("SuperAdmin");
        body.GetProperty("totpEnabled").GetBoolean().Should().BeFalse();
    }

    [Fact]
    public async Task Refresh_ReturnsNewAccessToken_AndStaysAuthenticated()
    {
        await LoginAsAdminAsync();

        var refreshResponse = await Client.PostAsync("/api/auth/refresh", null);
        refreshResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // Con el nuevo access token en la cookie, la API sigue reconociendo al usuario.
        var response = await Client.GetAsync("/api/companies");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Logout_RevokesSession_Returns401OnNextRequest()
    {
        await LoginAsAdminAsync();

        // Antes del logout el usuario está autenticado.
        var before = await Client.GetAsync("/api/companies");
        before.StatusCode.Should().Be(HttpStatusCode.OK);

        var logoutResponse = await Client.PostAsync("/api/auth/logout", null);
        logoutResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Tras el logout la cookie queda borrada → 401.
        var after = await Client.GetAsync("/api/companies");
        after.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task LoginAsAdminAsync()
    {
        var response = await Client.PostAsJsonAsync("/api/auth/login", new
        {
            email    = "admin@clientmanager.local",
            password = "TestAdmin@2026!"
        });
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
