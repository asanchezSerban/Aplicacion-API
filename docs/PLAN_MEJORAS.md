# Plan de mejoras — ClientManager

> Objetivo: pasar de **7.7 → 10 / 10** (excluyendo tests y documentación operacional).
> Estimación total: **18-25 días-persona** distribuidos en 4 fases.

---

## Resumen por sección

| Sección | Nota actual | Objetivo | Δ pts ponderados |
|---|---:|---:|---:|
| Seguridad backend | 7.5 | 10 | +0.47 |
| Arquitectura backend | 7.5 | 10 | +0.31 |
| Calidad código backend | 7.0 | 10 | +0.38 |
| Persistencia / EF Core | 8.0 | 10 | +0.25 |
| Arquitectura frontend Angular 21 | 9.0 | 10 | +0.13 |
| Seguridad frontend | 8.0 | 10 | +0.25 |
| UX / UI / Accesibilidad | 8.0 | 10 | +0.13 |
| Performance frontend | 7.5 | 10 | +0.16 |
| Deuda técnica | 6.5 | 10 | +0.22 |
| **Total** | **7.7** | **10.0** | **+2.3** |

---

# FASE 1 — Hardening de seguridad crítico (5-7 días)

> Bloquea la exposición a internet. Imprescindible antes de producción.

## 1.1 Cabeceras de seguridad HTTP

**Archivo:** `Program.cs:221-228`

Añadir middleware que inyecte:
- `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' fonts.googleapis.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Resource-Policy: same-origin`

**Implementación:** middleware custom o paquete `NetEscapades.AspNetCore.SecurityHeaders`.

## 1.2 SMTP con TLS y autenticación

**Archivo:** `Services/EmailService.cs:31`

- Cambiar `SecureSocketOptions.None` → `StartTlsWhenAvailable`
- Añadir `client.AuthenticateAsync(user, password)`
- Mover credenciales a User Secrets (`Email:Username`, `Email:Password`)
- Configurar `Email:RequireTls = true` para fallar explícitamente si el servidor no la soporta en producción

## 1.3 Hash de OTP y backup codes con pepper

**Archivos:** `Services/AuthService.cs:103, 218, 252, 343`

- Añadir clave `Otp:Pepper` (256 bits) a User Secrets
- Reemplazar `SHA256.HashData(bytes)` por `HMACSHA256.HashData(pepperKey, bytes)`
- Para backup codes considerar `IDataProtector` de ASP.NET (rotable, con purpose strings)
- Migración: marcar OTPs/codes existentes como inválidos (forzar regeneración)

## 1.4 Rate limiting particionado por email + IP

**Archivo:** `Program.cs:172-183`

- Política compuesta: aplicar límite por IP **y** por email (cualquier de los dos dispara)
- Sliding window en lugar de fixed window (evita ráfagas en el filo de la ventana)
- Añadir política independiente para `/forgot-password` (más estricta: 3/hora por email)

## 1.5 Mensajes de error neutros

**Archivos:** `Services/AuthService.cs:258-261, 49-53`

- Eliminar "Te quedan N intentos" → mensaje genérico "Código incorrecto"
- Unificar respuesta para cuenta inexistente y cuenta bloqueada → mismo 401 con mismo cuerpo
- Aplicar lockout silencioso también a emails inexistentes (cubo virtual) para neutralizar fingerprinting

## 1.6 TOTP secret en columna pendiente

**Archivo:** `Services/AuthService.cs:307`

- Modelo `ApplicationUser`: añadir `TotpSecretPending`, `TotpPendingCreatedAt`
- `TotpSetupAsync` escribe en `TotpSecretPending` (no toca `TotpSecret`)
- `TotpConfirmAsync` mueve `Pending → Active` solo si verifica
- Limpieza periódica: `CleanupHostedService` purga pending > 1 h

## 1.7 SignInManager.PasswordSignInAsync con lockout integrado

**Archivo:** `Services/AuthService.cs:55-63`

- Reemplazar `CheckPasswordAsync` + `AccessFailedAsync` manual por `SignInManager.PasswordSignInAsync(user, password, isPersistent: false, lockoutOnFailure: true)`
- Centraliza lockout, resetCount y eventos de Identity

## 1.8 Hardening de uploads

**Archivos:** `Program.cs:221`, `Services/CompanyService.cs:216-249`

- `UseStaticFiles` con `OnPrepareResponse`: añade `X-Content-Type-Options: nosniff` y `Content-Disposition: inline; filename="..."` controlado
- Re-encoding obligatorio: cargar la imagen con `ImageSharp` o `SkiaSharp` y recodificar a PNG/JPEG → mata polyglots y EXIF malicioso
- Servir uploads desde subdominio o path con CSP propia (`img-src 'self'`)

## 1.9 Tabla de auditoría

**Nuevos archivos:** `Models/AuditLog.cs`, `Services/IAuditService.cs`

- Schema: `Id, UserId, UserEmailHash, Action, EntityType, EntityId, OldValue, NewValue, Timestamp, IpAddress, UserAgent`
- Hook en `CompanyService` y `UserService` para Create/Update/Delete
- Endpoint `/api/audit` solo SuperAdmin con paginación

## 1.10 Correlation ID y filtrado de PII en logs

- Middleware que asigna `TraceId` por request (W3C Trace Context)
- Custom `ILogEnricher` que reemplaza emails en plantillas por hash truncado (`abcd…@dom`)
- Configurar `Serilog` o `Microsoft.Extensions.Logging` con destructuring policy

---

# FASE 2 — Arquitectura backend (4-5 días)

## 2.1 IOptions<T> con validación

**Archivos:** `Program.cs`, `Services/AuthService.cs`, `Services/EmailService.cs`

- Crear `Configuration/JwtOptions.cs`, `EmailOptions.cs`, `SuperAdminOptions.cs`, `CorsOptions.cs`, `OtpOptions.cs`
- `services.AddOptions<JwtOptions>().Bind(config.GetSection("Jwt")).ValidateDataAnnotations().ValidateOnStart()`
- Inyectar `IOptions<JwtOptions>` en lugar de leer `IConfiguration["..."]` en cada llamada

## 2.2 IExceptionHandler en lugar de UseExceptionHandler+switch

**Archivo:** `Program.cs:194-219`

- Implementar `IExceptionHandler` (.NET 8+) por tipo: `ValidationExceptionHandler`, `NotFoundExceptionHandler`, `LockedExceptionHandler`, `UnauthorizedExceptionHandler`, `GlobalExceptionHandler`
- Devolver `ProblemDetails` (RFC 7807) con `type`, `title`, `status`, `detail`, `traceId`

## 2.3 Refactor de Program.cs

**Archivo:** `Program.cs` (533 líneas → ~120)

- `Extensions/ServiceCollectionExtensions.cs`: `AddIdentityWithJwt()`, `AddRateLimiting()`, `AddSwaggerWithJwt()`, `AddCorsPolicy()`
- `Extensions/WebApplicationExtensions.cs`: `MapDevEndpoints()`, `UseSecurityHeaders()`, `MigrateAndSeedAsync()`
- `Endpoints/DevEndpoints.cs`: los `seed-companies`, `seed-users`, `delete-all-users`, `last-otp`

## 2.4 Dividir AuthController

**Archivo:** `Controllers/AuthController.cs` (243 líneas)

- `AuthController`: login, logout, me, refresh
- `MfaController`: mfa-verify, resend-otp
- `TotpController`: status, setup, confirm, disable
- `PasswordController`: forgot-password, reset-password

## 2.5 Capa de URL building fuera del service

**Archivo:** `Services/CompanyService.cs:206-214`

- El service devuelve solo `LogoFileName`
- Crear `IFileUrlBuilder` o resolver en el `ResponseDto` desde el controller

## 2.6 Health checks

**Archivo:** `Program.cs`

- `services.AddHealthChecks().AddDbContextCheck<ApplicationDbContext>().AddCheck<SmtpHealthCheck>("smtp")`
- `app.MapHealthChecks("/healthz", new HealthCheckOptions { Predicate = _ => true })`
- `/healthz/live` (liveness, sin BD) y `/healthz/ready` (readiness, con BD)

---

# FASE 3 — Calidad de código backend y EF Core (3-4 días)

## 3.1 CancellationToken en toda la pipeline async

**Archivos:** `Services/AuthService.cs`, `Services/EmailService.cs`, `Services/IAuthService.cs`, `Controllers/AuthController.cs`

- Añadir `CancellationToken ct = default` a todos los métodos async
- Propagar a `_db.SaveChangesAsync(ct)`, `_emailService.SendAsync(..., ct)`, etc.

## 3.2 Deduplicar generación y plantilla de OTP

**Archivos:** `Services/AuthService.cs:99-114, 161-174` y `:120-132, 179-191`

- Crear `Services/OtpGenerator.cs` con `GenerateAsync(string userId, CancellationToken ct)` → devuelve `(plainCode, expiresAt)`
- Crear `Services/OtpEmailTemplate.cs` con `Render(string code, bool isResend)`
- `LoginAsync` y `ResendOtpAsync` se reducen a 3-4 líneas cada una

## 3.3 IdentityError translator compartido

**Archivos:** `Services/UserService.cs:102-112`, `Services/AuthService.cs:489-497`

- Crear `Services/IdentityErrorTranslator.cs` estático con `Translate(IEnumerable<IdentityError>)` → mensajes en español
- Usar en ambos sitios

## 3.4 SanitizeInput renombrar y limpiar

**Archivo:** `Services/CompanyService.cs:277-282`

- Renombrar a `Normalize` (o eliminar y usar `string.Trim()` directo)
- Eliminar el `HtmlDecode` (revierte cualquier escape previo, induce a error)

## 3.5 Concurrencia optimista

**Archivos:** `Models/Company.cs`, `Models/User.cs`, `Data/ApplicationDbContext.cs`

- Añadir `[Timestamp] public uint Xmin { get; set; }` (PostgreSQL)
- Configurar en `OnModelCreating`: `entity.Property(e => e.Xmin).IsRowVersion().HasColumnName("xmin")`
- Manejar `DbUpdateConcurrencyException` con respuesta 409 Conflict

## 3.6 Migraciones fuera del runtime

**Archivo:** `Program.cs:434-480`

- Eliminar `MigrateAsync()` del arranque
- Crear comando `dotnet run --project ClientManager.Migrate` o flag `--migrate` que aplica y termina
- Documentar en pipeline de despliegue

---

# FASE 4 — Frontend, UX y deuda (3-5 días)

## 4.1 Open redirect: rechazar `//`

**Archivo:** `services/auth.service.ts:99-103`

- `isSafeReturnUrl`: rechazar también `url.startsWith('//')` y validar parseando con `new URL(url, window.location.origin)` y comprobando que el `origin` resultante coincide

## 4.2 setInterval → interval reactivo

**Archivo:** `pages/mfa-verificar/mfa-verificar.ts`

- Reemplazar `setInterval` manual del timer del OTP por `interval(1000).pipe(takeUntilDestroyed(destroyRef), map(...))` convertido a `signal` con `toSignal`

## 4.3 ARIA y accesibilidad

**Archivos:** `pages/mfa-verificar/mfa-verificar.ts`, `pages/configurar-totp/configurar-totp.ts`

- Envolver los 6 inputs OTP en `<fieldset>` con `<legend>` o `aria-labelledby`
- Añadir `aria-live="polite"` a contenedores de mensajes dinámicos (success/error)
- `aria-pressed` en botones toggle (mostrar/ocultar password, dark mode)
- Auditar con axe-core o Lighthouse

## 4.4 Componentes y mixins compartidos

**Archivos:** `index.html`, `pages/login/`, `pages/mfa-verificar/`, `pages/configurar-totp/`, `pages/recuperar-password/`, `pages/reset-password/`

- Componente `<app-brand-mark>` con el SVG del logo (usado en 4+ sitios)
- Componente `<app-auth-shell>` con el layout `.brand-panel + .form-panel` (usado en 5 páginas auth)
- Mixin SCSS `auth-shell-vars` para los `--ink-*`, `--accent-*`

## 4.5 trackBy explícito en @for

**Archivos:** todos los `*.html` con listas

- `@for (c of companies(); track c.id)` en company-list, user-list, notif-list
- Verificar con grep que ningún `@for` queda sin `track`

## 4.6 Self-host de fuentes y eliminación de Google Fonts

**Archivo:** `index.html:9-13`, `styles.scss`

- Descargar Inter, Roboto y Material Icons al `public/fonts/`
- `@font-face` con `font-display: swap`
- Eliminar los `<link>` a `fonts.googleapis.com` y `fonts.gstatic.com`
- Mejora LCP/FCP, evita round-trip a Google, simplifica CSP

## 4.7 ErrorHandler global

**Archivo nuevo:** `app/services/global-error-handler.ts`

- `ErrorHandler` custom que recibe excepciones no manejadas
- Loggear a backend (endpoint `/api/client-errors`) o a un sumidero (Application Insights, Sentry)
- Notificar al usuario con snackbar genérico

## 4.8 Migración a zoneless change detection

**Archivos:** `main.ts`, `app.config.ts`, `package.json`

- Eliminar `import 'zone.js'` de `main.ts`
- Reemplazar `provideZoneChangeDetection({ eventCoalescing: true })` por `provideExperimentalZonelessChangeDetection()`
- Eliminar `zone.js` de `package.json`
- Auditar componentes que dependan de `setTimeout`/`setInterval` para que disparen CD
- Bundle más ligero (~40 KB) y rendering más predecible

## 4.9 Source maps explícitamente desactivados en producción

**Archivo:** `angular.json:60-72`

- Añadir `"sourceMap": false` en la configuración `production` (defensa explícita)

## 4.10 Limpieza de workspace

- Añadir `publish/`, `PracticasAdrianGestorDeEmpresaspublishapi/` a `.gitignore`
- Eliminar `obj/`, `bin/` rastreados si los hubiera
- Mover password de tests (`CustomWebApplicationFactory.cs:32`) a variable de entorno `TEST_DB_CONN`

---

# Cronograma sugerido

| Semana | Foco | Entregables |
|---|---|---|
| **1** | Fase 1.1 a 1.5 | Cabeceras, SMTP TLS, pepper, rate limiting, mensajes neutros |
| **2** | Fase 1.6 a 1.10 | TOTP pendiente, SignInManager, uploads, audit log, correlation ID |
| **3** | Fase 2 completa | IOptions, IExceptionHandler, refactor Program, split controllers, healthchecks |
| **4** | Fase 3 completa | CT, dedup OTP, translator, concurrencia optimista, migraciones fuera |
| **5** | Fase 4 completa | Open redirect, ARIA, componentes compartidos, self-host fuentes, zoneless |

---

# Criterios de aceptación

Para considerar el proyecto en **10/10**:

- [ ] `securityheaders.com` → A+ en producción
- [ ] `observatory.mozilla.org` → A+ en producción
- [ ] No hay `IConfiguration["..."]` directo en services
- [ ] `Program.cs` < 150 líneas
- [ ] Cero duplicación de plantillas HTML del email
- [ ] Cero duplicación de mapeo de IdentityError
- [ ] Todo método async acepta y propaga `CancellationToken`
- [ ] OTP/backup codes hasheados con HMAC + pepper
- [ ] Health checks `/healthz/live` y `/healthz/ready` operativos
- [ ] CSP estricta sin `'unsafe-inline'` ni `'unsafe-eval'`
- [ ] SMTP fallaría si TLS no está disponible en producción
- [ ] Audit log completo para Create/Update/Delete
- [ ] Todos los `@for` con `track`
- [ ] Self-host de fuentes (cero llamadas a `fonts.googleapis.com`)
- [ ] zone.js eliminado del bundle
- [ ] `isSafeReturnUrl` rechaza `//evil.com`
- [ ] Concurrencia optimista activa en Company y User
- [ ] Auditoría axe-core sin errores en páginas críticas (login, MFA, TOTP, formularios)
