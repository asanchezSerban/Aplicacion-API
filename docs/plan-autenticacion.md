# Plan: Sistema de Autenticación para ClientManager

## Context

ClientManager es una app de gestión de clientes con .NET 10 + PostgreSQL (backend) y Angular 21 + Angular Material (frontend). Actualmente **no tiene autenticación** — todos los endpoints son públicos. Se necesita añadir: login con JWT, MFA mediante código por email (OTP), y recuperación de contraseña.

---

## 1. Decisión: ASP.NET Core Identity vs Implementación propia

### Recomendación: **ASP.NET Core Identity**

**Por qué:**
- Ya incluye: hashing de contraseñas (PBKDF2 con HMAC-SHA256, 100k iteraciones), gestión de usuarios, roles, claims, bloqueo de cuenta por intentos fallidos, tokens de reset de contraseña
- Se integra directamente con EF Core (que ya usamos) — solo hay que añadir `IdentityUser` al DbContext
- No reinventamos la rueda en algo tan crítico como la seguridad
- Mantenido por Microsoft con actualizaciones de seguridad constantes

**Por qué NO implementación propia:**
- Alto riesgo de errores de seguridad (timing attacks, hashing débil, tokens predecibles)
- Más código que mantener sin beneficio real
- Identity ya es modular — podemos usar solo las partes que necesitamos sin arrastrar toda la UI de Identity (no usamos Razor Pages)

**Alternativa descartada: Duende IdentityServer / OpenID Connect**
- Sobredimensionado para esta app — es para escenarios con múltiples clientes OAuth2, SSO federado, etc.
- Añade complejidad innecesaria y licencia comercial
- Si en el futuro se necesita SSO, se puede migrar entonces

---

## 2. Estrategia JWT: Access Token + Refresh Token

### Flujo:
```
Login correcto → { accessToken (15min), refreshToken (7 días) }
Cada request HTTP → Header: Authorization: Bearer <accessToken>
Token expirado → POST /api/auth/refresh con refreshToken → nuevos tokens
Refresh expirado → Redirigir a login
```

### Decisiones clave:

**Duración del Access Token: 15 minutos**
- Suficientemente corto para limitar daño si se compromete
- Suficientemente largo para no molestar al usuario

**Duración del Refresh Token: 7 días**
- Se almacena en BD (tabla RefreshTokens) → se puede revocar
- Rotación: cada uso genera un nuevo refresh token e invalida el anterior (protege contra robo)

**Almacenamiento en frontend: `localStorage`**
- Por qué no httpOnly cookies: complicaría el CORS (necesita `withCredentials`, cambios en CORS policy, problemas con SameSite en desarrollo con puertos diferentes)
- El riesgo de XSS se mitiga porque Angular sanitiza templates por defecto y no usamos `innerHTML` ni `bypassSecurityTrust`
- Es el patrón más común y práctico para SPAs con API separada

**Contenido del JWT (claims):**
```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "role": "Admin",
  "iat": 1234567890,
  "exp": 1234568790
}
```

### Paquetes NuGet necesarios:
- `Microsoft.AspNetCore.Authentication.JwtBearer` — middleware JWT
- `Microsoft.AspNetCore.Identity.EntityFrameworkCore` — Identity + EF Core
- `Microsoft.IdentityModel.Tokens` — firma y validación de tokens

---

## 3. MFA mediante código por email (OTP)

### Por qué código por email y no TOTP/app:
- **Sin apps que instalar**: el usuario solo necesita acceso a su correo
- **Familiar**: es exactamente lo que ya usan bancos y otras webs conocidas
- **Reutiliza infraestructura**: el SMTP ya está planificado para recuperación de contraseña
- **Sin configuración previa**: no hay QR que escanear ni setup inicial

### Flujo de login con MFA:
```
1. POST /api/auth/login (email + password)
2. Credenciales válidas → backend genera código de 6 dígitos aleatorio
3. Guarda el código hasheado en BD con expiración de 10 minutos
4. Envía email: "Tu código de verificación es 847291, válido 10 minutos"
5. Frontend muestra pantalla para introducir el código
6. POST /api/auth/mfa-verify (mfaToken + código de 6 dígitos)
7. Si válido y no expirado → devuelve { accessToken, refreshToken }
8. El código se marca como usado (un solo uso)
```

### Seguridad del OTP:
- Código de 6 dígitos generado con `RandomNumberGenerator` (criptográficamente seguro)
- Expira en 10 minutos
- Un solo uso — se invalida tras verificación correcta
- Máximo 3 intentos fallidos → invalidar el código y requerir nuevo login
- El código se guarda **hasheado** en BD (no en texto plano)

### "Recordar este dispositivo" (30 días):
- Checkbox opcional en la pantalla del código
- Si se marca → se genera un token de dispositivo guardado en cookie + BD
- Siguientes logins desde ese dispositivo saltan el paso del código de email
- Tabla `TrustedDevices` en BD

### Nota — cambio a TOTP en el futuro:
Si en el futuro se quiere cambiar a Google Authenticator/TOTP, el cambio está localizado en:
- Backend: sustituir generación OTP por OtpNet + QRCoder, añadir tablas UserMfaSecrets y UserBackupCodes
- Frontend: añadir página mfa-setup con QR, añadir mfa-setup.guard
- Lo demás (JWT, roles, refresh tokens, recuperación de contraseña) no cambia

---

## 4. Recuperación de contraseña

### Flujo:
```
1. Usuario pulsa "He olvidado mi contraseña"
2. Introduce su email → POST /api/auth/forgot-password
3. Backend SIEMPRE responde 200 (no revelar si email existe o no)
4. Si email existe → genera token de reset (expira en 1 hora) → envía email con enlace
5. Usuario abre enlace → frontend con formulario de nueva contraseña
6. POST /api/auth/reset-password (token + nueva contraseña)
7. Backend valida token, cambia contraseña, invalida todos los refresh tokens del usuario
```

### Servicio de email: **SMTP con MailKit**
- Paquete: `MailKit` (NuGet) — la librería de email más robusta para .NET
- Configuración en appsettings: host SMTP, puerto, credenciales
- Para desarrollo: usar **Ethereal** (smtp.ethereal.email) o **MailHog** (captura emails en local sin enviarlos de verdad)
- Para producción: cualquier SMTP (Gmail, SendGrid, Amazon SES)
- El mismo EmailService sirve tanto para el OTP del MFA como para el reset de contraseña

### Seguridad del reset:
- Token generado por `Identity.GeneratePasswordResetTokenAsync()` (firmado, un solo uso)
- Expira en 1 hora
- Al cambiar contraseña → revocar todos los refresh tokens activos (cierra todas las sesiones)

---

## 5. Esquema de Base de Datos (nuevas tablas)

Identity crea estas tablas automáticamente con la migración:

```
AspNetUsers          → Usuarios (Id, Email, PasswordHash, UserName, etc.)
AspNetRoles          → Roles (Admin, User) — seed data con ambos roles
AspNetUserRoles      → Relación usuarios-roles
AspNetUserTokens     → Tokens de Identity
AspNetUserClaims     → Claims por usuario
AspNetRoleClaims     → Claims por rol
AspNetUserLogins     → Logins externos (no lo usaremos por ahora)
```

Tablas adicionales propias:
```
RefreshTokens        → Token, UserId, ExpiresAt, CreatedAt, RevokedAt, ReplacedByToken
EmailOtpCodes        → UserId, CodeHash, ExpiresAt, IsUsed, Attempts, CreatedAt
TrustedDevices       → UserId, DeviceToken, DeviceName, ExpiresAt, CreatedAt
```

### Roles y permisos:
- **Admin**: CRUD completo (crear, leer, editar, eliminar clientes, cambiar estado)
- **User**: Solo lectura (ver listado y detalle de clientes)
- El primer usuario registrado se asigna como Admin automáticamente
- Nuevos usuarios se registran como User por defecto
- Un Admin puede promover a otros usuarios a Admin

### MFA obligatorio:
- Todos los usuarios deben pasar el segundo factor en cada login (salvo dispositivos de confianza)
- No hay setup previo — el código llega automáticamente al email tras hacer login
- No hay página /mfa-setup ni guard especial de configuración

---

## 6. Arquitectura Backend — Nuevos componentes

### Nuevos archivos:
```
Controllers/
  AuthController.cs          → Login, Register, Refresh, Logout, ForgotPassword, ResetPassword, MfaVerify

Models/
  ApplicationUser.cs         → Extiende IdentityUser
  RefreshToken.cs            → Entidad para refresh tokens
  EmailOtpCode.cs            → Entidad para códigos OTP de email
  TrustedDevice.cs           → Entidad para dispositivos de confianza

DTOs/
  AuthDtos.cs                → LoginDto, RegisterDto, TokenResponseDto, MfaVerifyDto, etc.

Services/
  IAuthService.cs            → Interfaz de autenticación
  AuthService.cs             → Login, registro, JWT, refresh, OTP generation/verify
  IEmailService.cs           → Interfaz de email
  EmailService.cs            → Envío de emails con MailKit (OTP + reset password)
```

### Cambios en archivos existentes:
- **Program.cs**: Añadir Identity, JWT Bearer, servicios de auth, políticas de autorización por rol
- **ApplicationDbContext.cs**: Heredar de `IdentityDbContext<ApplicationUser>` en vez de `DbContext`
- **ClientsController.cs**: `[Authorize]` en todo + `[Authorize(Roles = "Admin")]` en POST/PUT/PATCH/DELETE
- **appsettings.json**: Sección Jwt (Key, Issuer, Audience, tiempos) + sección Email (SMTP)

### Endpoints nuevos:
```
POST   /api/auth/register          → Registro
POST   /api/auth/login             → Login (envía código OTP por email)
POST   /api/auth/mfa-verify        → Verificar código OTP → devuelve JWT
POST   /api/auth/refresh           → Renovar tokens
POST   /api/auth/logout            → Revocar refresh token
POST   /api/auth/forgot-password   → Solicitar reset de contraseña
POST   /api/auth/reset-password    → Cambiar contraseña con token
```

---

## 7. Arquitectura Frontend — Nuevos componentes

### Nuevos archivos:
```
services/
  auth.service.ts            → Login, register, refresh, logout, mfa-verify, estado de sesión

guards/
  auth.guard.ts              → CanActivate: redirige a /login si no autenticado

interceptors/
  auth.interceptor.ts        → Añade Bearer token + maneja 401 con refresh automático

models/
  auth.model.ts              → LoginRequest, TokenResponse, MfaVerifyRequest, etc.

pages/
  login/                     → Formulario de login (email + contraseña)
  register/                  → Formulario de registro
  mfa-verify/                → Pantalla para introducir el código recibido por email
  forgot-password/           → Formulario de email para solicitar reset
  reset-password/            → Formulario de nueva contraseña (con token en query param)
```

### Cambios en archivos existentes:
- **app.config.ts**: `provideHttpClient(withInterceptors([authInterceptor]))`
- **app.routes.ts**: Nuevas rutas + `canActivate: [authGuard]` en rutas protegidas
- **navbar/**: Mostrar usuario logueado, rol (Admin/User), botón logout
- **client-list/**: Ocultar botones crear/editar/eliminar si rol = User

### Nuevas rutas:
```
/login                  → LoginComponent (pública)
/registro               → RegisterComponent (pública)
/mfa-verificar          → MfaVerifyComponent (solo durante login, código por email)
/recuperar-password     → ForgotPasswordComponent (pública)
/reset-password         → ResetPasswordComponent (pública, con token en query param)

Rutas existentes (/clientes/*) → protegidas con authGuard
```

---

## 8. Seguridad adicional

- **Rate limiting** en endpoints de auth: `System.Threading.RateLimiting` (built-in en .NET 8+) — limitar a 5 intentos de login por minuto por IP
- **Account lockout**: Identity lo incluye — 5 intentos fallidos = bloqueo 15 min
- **OTP máximo 3 intentos**: código se invalida tras 3 intentos fallidos
- **Validación de contraseña**: mínimo 8 caracteres, mayúscula, minúscula, número, carácter especial
- **HTTPS obligatorio** en producción
- **Secrets**: JWT signing key en User Secrets (desarrollo) o variables de entorno (producción), NUNCA en appsettings.json

---

## 9. Paquetes a instalar (resumen)

**Backend (NuGet):**
- `Microsoft.AspNetCore.Identity.EntityFrameworkCore`
- `Microsoft.AspNetCore.Authentication.JwtBearer`
- `MailKit` (email — OTP + reset password)

**Frontend (npm):**
- No se necesita ningún paquete adicional

---

## 10. Orden de implementación

1. **Identity + JWT básico** — Modelo ApplicationUser, DbContext con Identity, registro, login, JWT, proteger endpoints con `[Authorize]`
2. **Roles (Admin/User)** — Seed de roles, asignación en registro, políticas de autorización, `[Authorize(Roles = "Admin")]` en endpoints de escritura
3. **Refresh tokens** — Entidad RefreshToken, rotación, endpoint /refresh, renovación automática
4. **Frontend auth** — Login/registro pages, interceptor HTTP, auth guard, navbar con sesión y rol
5. **MFA por email (OTP)** — EmailService con MailKit, generación/validación de códigos, página mfa-verify, "recordar dispositivo"
6. **Recuperación de contraseña** — Reutilizar EmailService, forgot/reset password, flujo completo
7. **Pulido** — Rate limiting, lockout tuning, ocultar botones por rol en frontend, UX

---

## Verificación

- Registrar usuario → login → llega email con código de 6 dígitos → introducir código → acceso
- Login desde dispositivo de confianza (recordado) → email + contraseña → acceso directo sin código
- Usuario con rol User → puede ver listado y detalle, NO puede crear/editar/eliminar
- Primer usuario registrado → rol Admin → CRUD completo
- Token expirado → refresh automático transparente para el usuario
- Olvidar contraseña → recibir email → cambiar contraseña → login con nueva
- 5 intentos fallidos de login → cuenta bloqueada temporalmente
- 3 intentos fallidos de código OTP → código invalidado, repetir login
- Request sin token a /api/clients → 401 Unauthorized
- Request de User a DELETE /api/clients/1 → 403 Forbidden
