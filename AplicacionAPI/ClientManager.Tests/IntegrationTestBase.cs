using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;

namespace ClientManager.Tests;

/// <summary>
/// Clase base para todos los tests de integración.
/// Hereda de aquí para tener el HttpClient listo y la BD limpia antes de cada test.
/// </summary>
public abstract class IntegrationTestBase : IAsyncLifetime
{
    protected readonly HttpClient Client;

    private readonly CustomWebApplicationFactory _factory;

    protected IntegrationTestBase(CustomWebApplicationFactory factory)
    {
        _factory = factory;

        // CookieContainer manual — más fiable que HandleCookies=true con TestServer in-memory.
        // El handler de WebApplicationFactory maneja cookies de forma algo especial; este approach
        // replica lo que haría un navegador real: guardar cookies del response y enviarlas en el siguiente request.
        Client = factory.CreateDefaultClient(
            new Uri("http://localhost"),
            new CookieHandler());
    }

    // xUnit llama a esto antes de cada test — limpia la BD.
    public Task InitializeAsync() => _factory.ResetDatabaseAsync();

    public Task DisposeAsync() => Task.CompletedTask;

    // Middleware HTTP que copia cookies del response al próximo request.
    // TestServer no soporta CookieContainer directo, así que lo hacemos manualmente.
    private sealed class CookieHandler : DelegatingHandler
    {
        private readonly Dictionary<string, string> _cookies = new();

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            if (_cookies.Count > 0)
            {
                var cookieHeader = string.Join("; ", _cookies.Select(c => $"{c.Key}={c.Value}"));
                request.Headers.Remove("Cookie");
                request.Headers.Add("Cookie", cookieHeader);
            }

            var response = await base.SendAsync(request, cancellationToken);

            if (response.Headers.TryGetValues("Set-Cookie", out var setCookies))
            {
                foreach (var raw in setCookies)
                {
                    var firstPair = raw.Split(';')[0].Trim();
                    var eq = firstPair.IndexOf('=');
                    if (eq <= 0) continue;
                    var name  = firstPair[..eq];
                    var value = firstPair[(eq + 1)..];
                    _cookies[name] = value;
                }
            }

            return response;
        }
    }
}
