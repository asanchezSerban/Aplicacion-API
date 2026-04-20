# Plan — Tests de integración para ClientManager.API

> Documento de continuidad. Si la sesión se compacta o se reinicia, leer este fichero antes de seguir. Contiene el razonamiento, el stack elegido, las fases, y los cambios mínimos que hay que aplicar al código de producción.

---

## 1. Contexto y motivación

### ¿Por qué tests de integración y no unitarios ni más k6?

La pirámide de testing saludable, de más a menos cantidad, es:

```
           ▲   (pocos)
        ┌──┴──┐
        │ E2E │          Selenium / Playwright / k6 (carga)
        └─────┘
       ┌───────┐
       │ Integ │         xUnit + WebApplicationFactory  ← AQUÍ
       └───────┘
     ┌───────────┐
     │   Unit    │        xUnit sobre clases puras
     └───────────┘
           ▼   (muchos)
```

Lo que tiene el proyecto ahora mismo está **invertido**: hay tests de carga (k6) pero ninguna verificación funcional automatizada. Eso significa que los k6 pueden pasar con respuestas 200 aunque el endpoint esté devolviendo datos incorrectos, porque k6 solo mira status y latencia.

### ¿Por qué integración en vez de unitarios en este proyecto?

- El código de `ClientManager.API` es principalmente **orquestación**: controllers → services → EF Core → PostgreSQL. Muy poca lógica pura aislable.
- Los bugs reales que han aparecido en el histórico (migraciones que fallan, cookies que no viajan, rate limiter que no se aplica, autorización por rol) solo se detectan con el stack completo corriendo.
- Un unit test de `CompanyService` mockeando el `DbContext` verificaría que el método "llama a `.Add()`", no que el endpoint devuelve 201 con el body correcto. Ruido, poca señal.

### ¿Por qué no confiar solo en los k6?

- k6 verifica **rendimiento** (latencia, throughput, errores bajo carga). No verifica **corrección funcional**.
- Los k6 actuales necesitan credenciales reales, smtp4dev corriendo, secretos TOTP — son caros de ejecutar y no caben en CI.
- Los tests de integración corren en cada commit, los k6 se lanzan puntualmente antes de un release.

---

## 2. Fase D previa — por qué falló

Hubo un intento anterior de añadir tests que se descartó. El problema: en el transporte in-memory de `TestServer` (el `HttpClient` que expone `WebApplicationFactory`), las cookies no se propagaban automáticamente entre peticiones. Como todo el auth del proyecto va por cookie `HttpOnly`, ningún test pasaba del login.

**La solución que no se probó en su momento:** `WebApplicationFactoryClientOptions { HandleCookies = true }` al crear el cliente:

```csharp
var client = factory.CreateClient(new WebApplicationFactoryClientOptions
{
    HandleCookies = true,
    AllowAutoRedirect = false,
});
```

Con esa opción, el `HttpClient` mantiene un `CookieContainer` por instancia y adjunta las cookies de vuelta en peticiones posteriores, exactamente como haría un navegador.

La carpeta `ClientManager.Tests/` del intento previo ya se borró (estaba vacía, solo tenía `obj/` de build anterior y no figuraba en el `.sln`).

---

## 3. Stack elegido

| Paquete | Versión | Por qué |
|---|---|---|
| **xUnit** | 2.9.x | Framework de tests estándar en .NET. Soporta `IAsyncLifetime` para setup/teardown async, que Testcontainers necesita. |
| **Microsoft.AspNetCore.Mvc.Testing** | 10.0.x | Expone `WebApplicationFactory<TEntryPoint>` — arranca la API en memoria con toda la DI real, sin abrir puerto TCP. |
| **Testcontainers.PostgreSql** | 3.x | Arranca un Postgres real en un contenedor Docker temporal por cada corrida de tests. Base de datos efímera, misma versión que producción. |
| **Respawn** | 6.x | Limpia tablas entre tests sin tener que hacer drop/create del esquema. Mantiene la estructura, vacía datos. |
| **FluentAssertions** | 7.x | `response.Should().Be(HttpStatusCode.Unauthorized)` — lectura más clara que `Assert.Equal`. Opcional pero recomendado. |

**Prerrequisito en la máquina:** Docker Desktop (o cualquier engine compatible) corriendo. Testcontainers habla con el daemon para arrancar el Postgres.

### Alternativas descartadas

- **Sqlite en memoria** — no soporta features de Postgres (tipos `jsonb`, `timestamptz`, generated columns). Las migraciones reales podrían fallar y no nos enteraríamos.
- **`UseInMemoryDatabase` de EF** — no es una base de datos relacional real, no ejecuta migraciones. Inútil para verificar constraints, índices, transacciones reales.
- **Postgres dockerizado "manual"** (docker-compose) — funciona, pero obliga al dev a recordar levantar el contenedor antes de `dotnet test`. Testcontainers lo hace transparente.

---

## 4. Plan en 3 fases

### Fase 1 — Infraestructura + un test trivial ✅ objetivo inmediato

**Entregable:** `dotnet test` arranca Postgres en Docker, levanta la API en memoria, hace una petición, la API responde 401. Verde.

Pasos:

1. Crear proyecto `AplicacionAPI/ClientManager.Tests/` (xUnit).
2. Añadirlo al `.sln` (`dotnet sln add ...`).
3. Referenciar `ClientManager.API` desde `ClientManager.Tests.csproj`.
4. Instalar NuGets: `xunit`, `xunit.runner.visualstudio`, `Microsoft.AspNetCore.Mvc.Testing`, `Testcontainers.PostgreSql`, `Respawn`, `FluentAssertions`.
5. Crear `CustomWebApplicationFactory : WebApplicationFactory<Program>, IAsyncLifetime`:
   - En `InitializeAsync()`: arranca el contenedor Postgres y expone la connection string.
   - En `ConfigureWebHost()`: reemplaza la connection string de `DefaultConnection` por la del contenedor.
   - En `DisposeAsync()`: para el contenedor.
6. Crear clase base `IntegrationTestBase` con el `HttpClient` ya configurado con `HandleCookies = true`.
7. Escribir un solo test:

   ```csharp
   [Fact]
   public async Task Get_Companies_Without_Auth_Returns_401()
   {
       var response = await _client.GetAsync("/api/companies");
       response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
   }
   ```

**Cambio único en código de producción:** añadir al final de `Program.cs`:

```csharp
public partial class Program { }
```

Esto hace visible la clase `Program` (que con top-level statements es `internal`) para que `WebApplicationFactory<Program>` pueda encontrarla. Es idiomático y no afecta en nada al runtime.

### Fase 2 — Flujos de autenticación

Una vez Fase 1 esté en verde, se cubren:

- Login con credenciales válidas → 200 + cookie `accessToken` + cookie `refreshToken`.
- Login con credenciales inválidas → 401, mensaje genérico (no revela si el email existe).
- Lockout: 5 intentos fallidos → 423 / mensaje de bloqueo durante 15 min.
- Rate limiter: 6 peticiones seguidas a `/auth/login` desde la misma IP → 429.
- Forgot password con email que existe y email que no: misma respuesta (anti-enumeración).
- Refresh token: rotación correcta + invalidación del anterior.
- Logout revoca la cookie.
- MFA: tras login, el endpoint exige el segundo factor antes de emitir la cookie final.

### Fase 3 — CRUD con autorización por rol

- SuperAdmin autenticado puede hacer CRUD de companies/users.
- Cliente autenticado recibe 403 al pedir `/api/companies`.
- Cliente autenticado recibe 200 al pedir `/api/clients/me`.
- Ningún rol puede acceder sin cookie.
- Validación: payloads inválidos devuelven 400 con problema detalle.

---

## 5. Helpers que van a hacer falta

En `IntegrationTestBase` o en una clase `AuthHelper`:

```csharp
// Crea un SuperAdmin, hace login, resuelve MFA, devuelve un HttpClient con cookies listas.
Task<HttpClient> AuthenticateAsSuperAdminAsync();

// Crea un Cliente con empresa asociada, hace login, resuelve OTP por email, devuelve cliente.
Task<HttpClient> AuthenticateAsClienteAsync();
```

El email OTP se leerá directamente de la tabla `EmailOtpCodes` en lugar de levantar smtp4dev — es más rápido y determinista en tests. El TOTP se calculará con `Otp.NET` (ya referenciado por la API) usando el `TotpSecret` que acabamos de escribir en BD.

---

## 6. Estado antes de empezar

| Elemento | Estado |
|---|---|
| Carpeta `ClientManager.Tests/` | No existe (se borró el intento previo) |
| `.sln` referencia solo `ClientManager.API.csproj` | ✅ confirmado |
| `Program.cs` con `public partial class Program { }` | ❌ pendiente |
| Docker Desktop corriendo | ❓ a confirmar con el usuario |
| k6 tests funcionando (paralelo) | ✅ corregidos en sesión previa |

---

## 7. Próxima acción concreta

1. Confirmar con el usuario que tiene Docker instalado y corriendo.
2. Ejecutar Fase 1 — entregable único: 1 test verde.
3. Hacer commit con mensaje tipo `Add integration test infrastructure (Phase 1)`.
4. Revisar con el usuario antes de seguir con Fase 2.

**Filosofía:** cambios mínimos, una fase cerrada por commit, enseñar lo que se va añadiendo en cada paso.
