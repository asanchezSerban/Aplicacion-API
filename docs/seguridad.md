# Documentación de Seguridad — ClientManager

## Índice
1. [Visión general de capas](#1-visión-general-de-capas)
2. [Gestión de tokens — JWT en cookie HttpOnly](#2-gestión-de-tokens--jwt-en-cookie-httponly)
3. [Flujo de autenticación completo](#3-flujo-de-autenticación-completo)
4. [MFA diferenciado por rol](#4-mfa-diferenciado-por-rol)
5. [Rate limiting](#5-rate-limiting)
6. [Lockout de cuentas](#6-lockout-de-cuentas)
7. [Refresh token con rotación](#7-refresh-token-con-rotación)
8. [Autorización y guards](#8-autorización-y-guards)
9. [Protección contra enumeración de usuarios](#9-protección-contra-enumeración-de-usuarios)
10. [CORS y configuración de red](#10-cors-y-configuración-de-red)
11. [Validación de subida de ficheros](#11-validación-de-subida-de-ficheros)
12. [Contraseñas y recuperación](#12-contraseñas-y-recuperación)
13. [Limpieza automática de BD](#13-limpieza-automática-de-bd)
14. [Gestión de secretos y configuración](#14-gestión-de-secretos-y-configuración)
15. [Cómo se articulan las capas entre sí](#15-cómo-se-articulan-las-capas-entre-sí)

---

## 1. Visión general de capas

```
Usuario
  │
  ├─ CAPA 1: Red / HTTP
  │    └─ CORS estricto (solo localhost:4200 en dev)
  │    └─ SameSite=Strict en cookies
  │    └─ Límite de tamaño de petición (10 MB)
  │
  ├─ CAPA 2: Rate Limiting
  │    └─ 5 req/min por IP en /api/auth/*
  │
  ├─ CAPA 3: Autenticación
  │    ├─ JWT firmado con HMAC-SHA256
  │    ├─ Token viaja en cookie HttpOnly (no accesible desde JS)
  │    └─ Validación de issuer, audience, lifetime, firma
  │
  ├─ CAPA 4: MFA
  │    ├─ SuperAdmin → TOTP (Google Authenticator)
  │    └─ Cliente    → OTP de 6 dígitos por email (TTL: 60 s)
  │
  ├─ CAPA 5: Autorización
  │    ├─ [Authorize(Roles = "SuperAdmin")] en controladores CRUD
  │    └─ Guards Angular (adminGuard, authGuard, guestGuard)
  │
  └─ CAPA 6: Protección de datos
       ├─ OTPs almacenados como hash SHA-256 (nunca en claro)
       ├─ Refresh tokens como GUID opaco en BD
       ├─ Contraseñas hasheadas por ASP.NET Identity (PBKDF2)
       └─ Secrets en User Secrets de .NET (nunca en appsettings.json)
```

---

## 2. Gestión de tokens — JWT en cookie HttpOnly

### Qué hace
El access token JWT y el refresh token viajan exclusivamente en cookies con los atributos `HttpOnly`, `Secure` y `SameSite=Strict`. Nunca se almacenan en `localStorage` ni `sessionStorage` ni se devuelven en el body de la respuesta.

### Dónde está implementado
- **Backend** — `AuthController.cs`, métodos `SetAccessTokenCookie` y `SetRefreshTokenCookie`:
  ```csharp
  // Access token: 15 minutos
  Response.Cookies.Append("accessToken", token, new CookieOptions {
      HttpOnly = true,
      Secure   = true,
      SameSite = SameSiteMode.Strict,
      Expires  = DateTimeOffset.UtcNow.AddMinutes(15)
  });

  // Refresh token: 24 horas
  Response.Cookies.Append("refreshToken", token, new CookieOptions {
      HttpOnly = true,
      Secure   = true,
      SameSite = SameSiteMode.Strict,
      Expires  = DateTimeOffset.UtcNow.AddHours(24)
  });
  ```
- **Backend** — `Program.cs`, evento `OnMessageReceived` del middleware JWT:
  ```csharp
  // Lee el token desde la cookie en lugar del header Authorization
  OnMessageReceived = ctx => {
      var cookie = ctx.Request.Cookies["accessToken"];
      if (!string.IsNullOrEmpty(cookie)) ctx.Token = cookie;
      return Task.CompletedTask;
  }
  ```
- **Frontend** — `auth.service.ts`: la identidad del usuario se guarda en un `signal<Identity|null>` en memoria. Nada sensible toca el storage del navegador.
- **Frontend** — `APP_INITIALIZER` en `app.config.ts`: llama a `GET /api/auth/me` al arrancar para hidratar el estado desde la cookie existente sin requerir re-login.

### Flujo
```
Login exitoso → servidor emite Set-Cookie (HttpOnly)
Browser guarda cookie automáticamente
Cada petición siguiente → browser envía cookie automáticamente
Interceptor Angular añade withCredentials: true a cada request
Servidor valida la cookie en OnMessageReceived → middleware JWT la procesa
```

### De qué protege
| Atributo       | Ataque bloqueado                                     |
|----------------|------------------------------------------------------|
| `HttpOnly`     | XSS — el JS malicioso no puede leer la cookie        |
| `Secure`       | Man-in-the-middle — la cookie no viaja por HTTP      |
| `SameSite=Strict` | CSRF — peticiones de otros dominios no llevan la cookie |
| Sin localStorage | XSS — aunque el ataque inyecte JS, no hay token que robar |

---

## 3. Flujo de autenticación completo

### Login de Cliente (Email OTP)

```
1. Usuario: POST /api/auth/login { email, password }
       │
       ├─ Rate limiter: ¿más de 5 req/min desde esta IP? → 429
       ├─ ¿usuario existe? → si no, lanza misma excepción que password inválida
       ├─ ¿cuenta en lockout? → 423 con mensaje genérico
       ├─ ¿password correcta? → si no, incrementa failedAttempts → 401
       └─ Password OK → invalidar OTPs anteriores pendientes
                      → generar OTP con RandomNumberGenerator.Fill()
                      → hash SHA-256 del OTP → guardar en EmailOtpCodes
                      → enviar email con el código (60 s de TTL)
                      → devolver { requiresMfa: true, mfaType: "email", otpExpiresAt }

2. Usuario: POST /api/auth/mfa-verify { email, code }
       │
       ├─ ¿OTP activo y no usado? → si no, 401
       ├─ ¿3 intentos fallidos? → marcar OTP como usado → 401
       ├─ hash(code) == CodeHash? → si no, attempts++ → 401
       └─ OTP válido → IsUsed = true
                     → generar JWT (15 min) + RefreshToken (24 h)
                     → Set-Cookie HttpOnly para ambos
                     → devolver IdentityDto (email, role, totpEnabled)

3. Frontend: identidad guardada en signal<Identity> en memoria
   Cada petición → interceptor añade withCredentials → cookie viaja automáticamente
```

### Login de SuperAdmin (TOTP con Google Authenticator)

```
1. POST /api/auth/login { email, password }
       │
       ├─ (mismas validaciones de rate limit, lockout, password)
       └─ ES SuperAdmin CON TOTP activado → devolver { requiresMfa: true, mfaType: "totp" }

2. POST /api/auth/mfa-verify { email, code }
       │
       ├─ user.TotpEnabled == true → rama TOTP
       ├─ Otp.NET verifica: HMAC-SHA1(secret, counter) con ventana RFC
       └─ Válido → JWT + RefreshToken en cookies → IdentityDto

SuperAdmin SIN TOTP configurado (primer arranque):
   → login devuelve JWT directamente (requiresMfa: false)
   → adminGuard detecta totpEnabled: false → redirige a /configurar-totp
   → /configurar-totp genera QR, usuario escanea y confirma
   → POST /api/auth/totp/confirm verifica el primer código
   → TotpEnabled = true en BD
   → Se emiten nuevos tokens con claim totpEnabled: true
   → adminGuard ahora permite acceso a /empresas, /usuarios
```

### Reconexión (APP_INITIALIZER)

```
App Angular arranca → APP_INITIALIZER → GET /api/auth/me
   │
   ├─ Cookie accessToken válida → 200 { email, role, totpEnabled }
   │    └─ _identity signal hidratado → isLoggedIn = true → router navega
   └─ Sin cookie o expirada → 401
        └─ _identity = null → isLoggedIn = false → guards redirigen a /login
```

---

## 4. MFA diferenciado por rol

### SuperAdmin — TOTP (RFC 6238)

**Cómo funciona:**
- El servidor genera una semilla aleatoria de 160 bits (20 bytes) con `KeyGeneration.GenerateRandomKey(20)`.
- La semilla se convierte a Base32 y se devuelve como URI `otpauth://totp/...` para que el frontend genere el QR.
- El usuario escanea el QR con Google Authenticator.
- En cada login, la app genera un código de 6 dígitos basado en HMAC-SHA1 de la semilla + timestamp / 30 s.
- El servidor verifica con `Otp.NET` usando `VerificationWindow.RfcSpecifiedNetworkDelay` (±1 ventana de 30 s tolerada).
- La semilla se guarda cifrada en `ApplicationUser.TotpSecret` (columna en BD).

**Ficheros relevantes:**
- `Models/ApplicationUser.cs` — campos `TotpSecret`, `TotpEnabled`
- `Services/AuthService.cs` — `TotpSetupAsync`, `TotpConfirmAsync`, `MfaVerifyAsync`
- `Controllers/AuthController.cs` — endpoints `/totp/status`, `/totp/setup`, `/totp/confirm`, `/totp/disable`
- `pages/configurar-totp/` — página frontend con QR + entrada manual

**De qué protege:**
- Phishing de contraseña — aunque roben las credenciales, necesitan el teléfono físico
- Acceso desde dispositivos no autorizados
- Contraseñas comprometidas en brechas de datos

### Cliente — Email OTP

**Cómo funciona:**
- Se genera un número de 6 dígitos con `RandomNumberGenerator.Fill()` (CSPRNG, no `Random`).
- Se almacena solo el hash SHA-256 del código en la tabla `EmailOtpCodes` (nunca el código en claro).
- TTL: 60 segundos.
- Máximo 3 intentos de verificación; al tercer fallo el OTP se marca como usado.
- El frontend sincroniza el temporizador con el `otpExpiresAt` devuelto por el servidor (evita desajustes de reloj).
- Botón "Reenviar" con cooldown de 30 s: invalida el OTP anterior y genera uno nuevo.

**Ficheros relevantes:**
- `Services/AuthService.cs` — `LoginAsync` (generación), `ResendOtpAsync`, `MfaVerifyAsync` (verificación)
- `Data/ApplicationDbContext.cs` — tabla `EmailOtpCodes`
- `pages/mfa-verificar/` — UI con countdown timer y reenvío

**De qué protege:**
- Acceso con contraseña comprometida
- Ataques de fuerza bruta al OTP (máx. 3 intentos + TTL de 60 s)
- Reutilización de códigos (IsUsed = true tras primer uso válido)

---

## 5. Rate Limiting

### Configuración
```csharp
// Program.cs
options.AddPolicy("auth", httpContext =>
    RateLimitPartition.GetFixedWindowLimiter(
        partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        factory: _ => new FixedWindowRateLimiterOptions {
            PermitLimit = 5,
            Window      = TimeSpan.FromMinutes(1),
            QueueLimit  = 0   // sin cola — rechaza inmediatamente
        }
    ));
```

```csharp
// AuthController.cs — aplica a toda la clase
[EnableRateLimiting("auth")]
public class AuthController : ControllerBase { ... }

// Excepto GET /auth/me — lectura pura sin efecto secundario
[DisableRateLimiting]
public IActionResult Me() { ... }
```

### Qué cubre
Todos los endpoints de `/api/auth/*`:
`/login`, `/mfa-verify`, `/refresh`, `/logout`, `/resend-otp`, `/forgot-password`, `/reset-password`, `/totp/*`

### Resultado
- Más de 5 peticiones desde la misma IP en 60 s → **HTTP 429 Too Many Requests**
- Partición por IP: un atacante con una IP no afecta a otros usuarios

### De qué protege
- Ataques de fuerza bruta a contraseñas
- Enumeración masiva de emails en forgot-password
- Spray de OTPs desde una sola IP

---

## 6. Lockout de cuentas

### Configuración
```csharp
// Program.cs — Identity options
options.Lockout.DefaultLockoutTimeSpan  = TimeSpan.FromMinutes(15);
options.Lockout.MaxFailedAccessAttempts = 5;
options.Lockout.AllowedForNewUsers      = true;
```

### Flujo
```
Intento fallido → UserManager.AccessFailedAsync(user) → failedAttempts++
5 intentos fallidos → cuenta bloqueada 15 minutos automáticamente
Login durante lockout → IsLockedOutAsync() → 423 Locked (mensaje genérico)
Login exitoso → ResetAccessFailedCountAsync(user) → contador a 0
```

### Mensaje de error
La respuesta 423 devuelve un mensaje genérico que no especifica si el bloqueo es por lockout o por credenciales incorrectas (previene enumeración del estado de la cuenta).

### De qué protege
- Ataques de fuerza bruta a contraseñas de cuentas concretas
- Credential stuffing (uso de contraseñas de otras brechas)

---

## 7. Refresh token con rotación

### Cómo funciona
```
Access token expira (15 min) → interceptor recibe 401
   │
   ├─ Primera petición en fallar: isRefreshing = true
   │    → POST /api/auth/refresh (cookie refreshToken)
   │    → servidor valida token en RefreshTokens table
   │    → genera nuevo accessToken + nuevo refreshToken
   │    → REVOCA el token antiguo (RevokedAt = now, ReplacedByToken = nuevo)
   │    → emite Set-Cookie con ambos tokens nuevos
   │    └─ reintenta la petición original → éxito transparente para el usuario
   │
   └─ Peticiones concurrentes: esperan en cola (BehaviorSubject)
        → cuando refreshResult$ emite true, reintentan con las nuevas cookies
```

### Propiedades del token de refresco
| Campo           | Valor              | Propósito                              |
|-----------------|--------------------|----------------------------------------|
| Token           | GUID (opaco)       | No predecible, no contiene datos       |
| ExpiresAt       | now + 24 h         | TTL de la sesión                       |
| RevokedAt       | null / timestamp   | Token inválido si no es null           |
| ReplacedByToken | null / GUID        | Trazabilidad de rotación               |
| IsActive (computed) | ExpiresAt > now && RevokedAt == null | Estado efectivo |

### Al cambiar contraseña
```csharp
// AuthService.ResetPasswordAsync — todos los refreshTokens activos se revocan
await activeTokens.ForEachAsync(t => t.RevokedAt = DateTime.UtcNow);
```

### De qué protege
- Robo de refresh token: si se usa un token robado, el token legítimo queda revocado simultáneamente (el servidor detecta que alguien intenta reusar un token ya rotado)
- Sesiones zombi: TTL de 24 h + revocación en logout
- Sesiones activas tras cambio de contraseña: todas revocadas

---

## 8. Autorización y guards

### Backend — Controladores
```csharp
// CompaniesController, UsersController — solo SuperAdmin
[Authorize(Roles = "SuperAdmin")]

// AuthController — público por defecto, excepto:
[Authorize]                 // GET /auth/me — cualquier usuario autenticado
[Authorize(Roles = "SuperAdmin")] // /totp/* — solo SuperAdmin
```

### Frontend — Guards

#### `authGuard`
```typescript
// Bloquea el acceso a rutas privadas si no hay sesión activa
if (authService.isLoggedIn()) return true;
return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
```

#### `adminGuard`
```typescript
// Se ejecuta siempre DESPUÉS de authGuard (el usuario ya está autenticado)
// Si el rol no es SuperAdmin → lleva al usuario a su página propia (/perfil)
// Si es SuperAdmin sin TOTP → fuerza /configurar-totp
if (authService.userRole() !== ROLES.SUPER_ADMIN)
    return router.createUrlTree(['/perfil']);
if (!authService.totpEnabled())
    return router.createUrlTree(['/configurar-totp']);
return true;
```

#### `guestGuard`
```typescript
// Evita que usuarios ya logados accedan a /login, /mfa-verificar, etc.
// Redirige al home correcto según el rol (evita bucles de redirección)
if (!authService.isLoggedIn()) return true;
const home = authService.userRole() === ROLES.SUPER_ADMIN ? '/empresas' : '/perfil';
return router.createUrlTree([home]);
```

#### Protección anti-redirect-loop
El triple de guards está diseñado para no crear bucles:
- Si un Cliente intenta ir a `/empresas` → `adminGuard` → `/perfil` (no a `/login`)
- Si un usuario logado va a `/login` → `guestGuard` → `/empresas` o `/perfil` según rol
- Solo `authGuard` redirige a `/login`, y solo cuando el usuario NO está logado

#### `returnUrl` con whitelist
```typescript
// login.ts y mfa-verificar.ts preservan el returnUrl entre pasos
// auth.service.mfaVerify() valida que sea una URL interna y no de auth
isSafeReturnUrl(url: string): boolean {
    if (!url.startsWith('/')) return false;  // bloquea URLs externas
    const blocked = ['/login', '/mfa-verificar', '/recuperar-password', '/reset-password'];
    return !blocked.some(b => url.startsWith(b));
}
```

De qué protege: open redirect (redirigir al usuario a un sitio externo malicioso tras el login).

---

## 9. Protección contra enumeración de usuarios

**Problema:** si el endpoint devuelve mensajes diferentes para "email no existe" vs "contraseña incorrecta", un atacante puede enumerar qué emails tienen cuenta.

**Solución aplicada en todos los endpoints sensibles:**

| Endpoint          | Comportamiento                                               |
|-------------------|--------------------------------------------------------------|
| `POST /login`     | Misma excepción y mensaje para "email no existe" y "password incorrecta" |
| `POST /forgot-password` | Devuelve 200 aunque el email no exista             |
| `POST /resend-otp` | Devuelve 200 aunque el email no exista o sea SuperAdmin  |
| `POST /login` (lockout) | Mensaje genérico que no indica si hay lockout o no |
| `POST /resend-otp` | Calcula el `expiresAt` ANTES de buscar al usuario — el TTL en la respuesta es siempre real |

---

## 10. CORS y configuración de red

### Configuración
```csharp
// Program.cs — origen leído de config (no hardcodeado)
var corsOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? throw new InvalidOperationException("Cors:AllowedOrigins es obligatorio.");

policy.WithOrigins(corsOrigins)   // lista blanca explícita
    .AllowAnyMethod()
    .AllowAnyHeader()
    .AllowCredentials();          // necesario para que el browser envíe cookies
```

```json
// appsettings.json
"Cors": {
    "AllowedOrigins": ["http://localhost:4200"]
}
```

### Límite de tamaño de petición
```csharp
options.Limits.MaxRequestBodySize = 10 * 1024 * 1024; // 10 MB
```

### De qué protege
- CORS estricto: peticiones de dominios no autorizados reciben 403 en el preflight
- `SameSite=Strict` en cookies: CSRF — las cookies no se envían en peticiones cross-site
- Límite de 10 MB: previene ataques de agotamiento de memoria/disco vía uploads gigantes

---

## 11. Validación de subida de ficheros

### Problema
Confiar solo en la extensión del fichero (`.jpg`) para validar imágenes es inseguro — un atacante puede renombrar un script PHP como `.jpg`.

### Solución — validación de magic bytes
```csharp
// CompanyService.SaveLogoAsync — lee los primeros 12 bytes del stream
var header = new byte[12];
await stream.ReadAsync(header.AsMemory(0, 12), ct);

// Compara contra firmas conocidas (magic bytes reales)
var isValid =
    header[0..2]  is [0xFF, 0xD8]              ||  // JPEG
    header[0..8]  is [0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A] ||  // PNG
    header[0..6]  is [0x47,0x49,0x46,0x38,0x37,0x61] ||  // GIF87a
    header[0..6]  is [0x47,0x49,0x46,0x38,0x39,0x61] ||  // GIF89a
    header[0..4]  is [0x52,0x49,0x46,0x46];    // WebP (RIFF header)
```

### De qué protege
- Subida de ficheros ejecutables disfrazados de imágenes
- Polyglot files (ficheros válidos en dos formatos simultáneamente)

---

## 12. Contraseñas y recuperación

### Política de contraseñas
Configurada en `Program.cs` vía ASP.NET Identity:
- Mínimo 8 caracteres
- Al menos una letra mayúscula
- Al menos una letra minúscula
- Al menos un dígito
- Al menos un carácter especial

### Almacenamiento
PBKDF2 con sal aleatoria — gestionado por ASP.NET Identity. Las contraseñas nunca se almacenan en claro.

### Recuperación de contraseña
```
1. POST /forgot-password { email }
   → Genera token firmado por Identity (tiempo limitado, ~1 h)
   → URL construida desde config Frontend:BaseUrl (no desde cabecera Origin)
   → Email enviado con enlace de reset
   → Siempre devuelve 200 (anti-enumeración)

2. POST /reset-password { email, token, newPassword }
   → Identity valida el token (firma + expiración)
   → Se resetea la contraseña
   → TODOS los refresh tokens activos del usuario se revocan
      (fuerza re-login en todos los dispositivos)
```

### De qué protege
- La URL de reset usa `Frontend:BaseUrl` de configuración — no se puede manipular via cabecera `Origin` (open redirect)
- La revocación de refresh tokens invalida todas las sesiones activas al cambiar contraseña

---

## 13. Limpieza automática de BD

### CleanupHostedService
Servicio en background que corre cada hora y purga registros caducados:
```csharp
// Services/CleanupHostedService.cs
private async Task DoCleanupAsync(CancellationToken ct) {
    var now = DateTime.UtcNow;
    var refreshDeleted = await db.RefreshTokens
        .Where(r => r.ExpiresAt < now)
        .ExecuteDeleteAsync(ct);
    var otpDeleted = await db.EmailOtpCodes
        .Where(o => o.ExpiresAt < now || o.IsUsed)
        .ExecuteDeleteAsync(ct);
}
```

### Índices para eficiencia
```sql
-- Migración Phase10 — los DELETE usan estos índices
CREATE INDEX IX_RefreshTokens_ExpiresAt       ON "RefreshTokens" ("ExpiresAt");
CREATE INDEX IX_EmailOtpCodes_ExpiresAt        ON "EmailOtpCodes" ("ExpiresAt");
CREATE INDEX IX_EmailOtpCodes_ExpiresAt_IsUsed ON "EmailOtpCodes" ("ExpiresAt", "IsUsed");
```

### De qué protege
- Acumulación de tokens expirados que podrían ser consultados o usados si la BD se compromete
- Degradación de rendimiento por tablas con millones de filas obsoletas
- Minimiza la ventana de exposición de datos sensibles (OTP hashes, refresh tokens)

---

## 14. Gestión de secretos y configuración

### Qué NUNCA va en appsettings.json
| Secreto              | Dónde se guarda                    |
|----------------------|------------------------------------|
| `Jwt:SecretKey`      | .NET User Secrets (desarrollo) / Variables de entorno (producción) |
| `SuperAdmin:Password`| .NET User Secrets                  |
| Credenciales SMTP    | .NET User Secrets                  |

### Validación obligatoria al arrancar
```csharp
// Program.cs — si falta alguno, la app no arranca (fail-fast)
var jwtSecretKey = builder.Configuration["Jwt:SecretKey"]
    ?? throw new InvalidOperationException("Jwt:SecretKey es obligatorio.");
var jwtIssuer = builder.Configuration["Jwt:Issuer"]
    ?? throw new InvalidOperationException("Jwt:Issuer es obligatorio.");
var corsOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? throw new InvalidOperationException("Cors:AllowedOrigins es obligatorio.");
```

### .gitignore reforzado
```
appsettings.Development.json
**/cuenta*.txt
**/*.pfx  **/*.pem  **/*.key
.env  .env.*
secrets.json
```

---

## 15. Cómo se articulan las capas entre sí

### Escenario: atacante intenta acceder a la API

```
Ataque de fuerza bruta a contraseña:
  CAPA 2 (Rate limiting): rechaza tras 5 intentos/min → 429
  CAPA 6 (Lockout): bloquea cuenta 15 min tras 5 intentos fallidos → 423
  Resultado: para hacer un ataque efectivo necesitaría ~millones de IPs
              y aún así cada cuenta tiene lockout independiente
```

```
Atacante roba cookie de sesión (XSS hipotético):
  CAPA 2 (HttpOnly): el JS malicioso NO puede leer la cookie
  CAPA 2 (SameSite=Strict): la cookie no viaja a otros dominios
  Resultado: imposible extraer el token vía XSS
```

```
Atacante intenta CSRF (petición desde otro dominio):
  CAPA 1 (CORS): preflight rechazado para orígenes no autorizados
  CAPA 2 (SameSite=Strict): las cookies no se envían en peticiones cross-site
  Resultado: doble barrera independiente
```

```
Atacante usa contraseña comprometida de otra brecha:
  CAPA 4 (MFA obligatorio): aunque tenga la contraseña, necesita el 2º factor
  SuperAdmin → necesita el teléfono físico con Google Authenticator
  Cliente → necesita acceso al email
  Resultado: contraseña sola no es suficiente
```

```
Atacante captura un refresh token en tránsito:
  CAPA 2 (Secure): la cookie solo viaja por HTTPS
  CAPA 7 (Rotación): si usa el token robado, el legítimo queda revocado
  Resultado: ventana de ataque mínima + detección implícita
```

### Diagrama de flujo completo de una sesión segura

```
[Navegador]                    [Angular]                    [API .NET]
    │                              │                              │
    │── Abre la app ──────────────>│                              │
    │                              │── APP_INITIALIZER ──────────>│
    │                              │   GET /auth/me               │
    │                              │<── 401 (sin cookie) ─────────│
    │                              │   _identity = null           │
    │                              │   → redirect /login          │
    │                              │                              │
    │── Introduce email+pass ─────>│                              │
    │                              │── POST /login ──────────────>│
    │                              │          [rate limit check]  │
    │                              │          [lockout check]     │
    │                              │          [password check]    │
    │                              │          [OTP generado]      │
    │                              │<── { requiresMfa: true } ────│
    │                              │   → redirect /mfa-verificar  │
    │                              │                              │
    │<── Email con OTP ────────────│                              │
    │── Introduce OTP ────────────>│                              │
    │                              │── POST /mfa-verify ─────────>│
    │                              │          [hash(OTP) check]  │
    │                              │          [attempts check]   │
    │                              │          [TTL check]        │
    │<── Set-Cookie: accessToken (15m) ───────────────────────────│
    │<── Set-Cookie: refreshToken (24h) ──────────────────────────│
    │                              │<── IdentityDto ─────────────│
    │                              │   _identity signal set       │
    │                              │   → redirect /perfil         │
    │                              │                              │
    │── Petición a /api/users/me ─>│                              │
    │   (cookie enviada automát.)  │── GET /api/users/me ────────>│
    │                              │   (cookie → JWT validado)    │
    │                              │<── 200 perfil ───────────────│
    │                              │                              │
    │  [15 min después]            │                              │
    │── Petición cualquiera ──────>│── GET /api/companies ───────>│
    │                              │<── 401 (token expirado) ─────│
    │                              │   [interceptor actúa]        │
    │                              │── POST /refresh ────────────>│
    │                              │   (refreshToken en cookie)   │
    │<── Set-Cookie: nuevos tokens ────────────────────────────────│
    │                              │   [reintenta petición original]
    │                              │── GET /api/companies ───────>│
    │                              │<── 200 datos ────────────────│
    │                              │                              │
```

---

## Resumen ejecutivo

| Medida                      | Protege contra                        | TTL / Límite         |
|-----------------------------|---------------------------------------|----------------------|
| JWT en cookie HttpOnly      | XSS, robo de token                    | 15 minutos           |
| SameSite=Strict             | CSRF                                  | —                    |
| MFA Email OTP (Clientes)    | Contraseñas comprometidas             | 60 segundos, 3 intentos |
| MFA TOTP (SuperAdmin)       | Phishing, brechas de datos            | 30 segundos (TOTP)   |
| Rate limiting               | Fuerza bruta, enumeración             | 5 req/min por IP     |
| Lockout automático          | Fuerza bruta por cuenta               | 5 intentos → 15 min  |
| Refresh token con rotación  | Robo de sesión larga                  | 24 horas             |
| Revocación en reset-password| Sesiones activas tras compromiso      | Inmediato            |
| Anti-enumeración (200 en forgot/resend) | Descubrimiento de usuarios | —         |
| Validación magic bytes      | Uploads maliciosos disfrazados        | JPEG/PNG/GIF/WebP    |
| Contraseña PBKDF2           | Extracción de contraseñas de la BD    | —                    |
| Secrets en User Secrets     | Exposición de claves en repositorio   | —                    |
| CORS lista blanca           | Peticiones cross-origin no autorizadas| —                    |
| Limpieza automática BD      | Acumulación de tokens expirados       | Cada hora            |
| OTP almacenado como SHA-256 | Extracción de códigos de la BD        | —                    |
| Guards frontend (triple)    | Acceso no autorizado a rutas          | Por rol              |
| returnUrl con whitelist     | Open redirect tras login              | Solo URLs internas   |
